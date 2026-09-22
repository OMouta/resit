import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { SplitLayout } from "@resit/ui/patterns/navigation/split-handle";
import { WorkspaceSwitcher } from "@resit/ui/patterns/navigation/workspace-switcher";
import { AppShell } from "@resit/ui/patterns/screens/app-shell";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type { MoodleConnection, MoodleCourse } from "../../../shared/moodle";
import type { AppSettings } from "../../../shared/settings";
import type {
  ProjectInfo,
  RecentWorkspace,
  ResourceInfo,
  SubjectInfo,
  WorkspaceSnapshot,
} from "../../../shared/workspace";
import { PromptDialog, type PromptRequest } from "../components/prompt-dialog";
import type { SettingsTopic } from "../settings/settings-dialog";
import { api } from "../lib/api";
import { insertIntoNote } from "../lib/citations";
import { useLiveContext } from "../lib/live-context";
import { useNotices } from "../lib/notices";
import { startPageRenderer } from "../lib/pdf-render";
import { dueCount, usePractice } from "../lib/practice";
import { CardDialog, type CardRequest } from "../practice/card-dialog";
import { QuizEditor, type QuizEditorRequest } from "../practice/quiz-editor";
import {
  flushAllViews,
  onAskRequest,
  onCardRequest,
  requestProjectChat,
  showTarget,
  viewFor,
  type DocumentTarget,
} from "../views/view-registry";
import {
  ConfirmDialog,
  SubjectDialog,
  type ConfirmRequest,
  type SubjectRequest,
} from "./dialogs";
import {
  activeTab,
  courseTabId,
  GRAPH_TAB_ID,
  layoutReducer,
  parseProjectTabId,
  PRACTICE_TAB_ID,
  PROFILE_TAB_ID,
  projectTabId,
  quizTabId,
  restoreLayout,
  SCHEDULE_TAB_ID,
  type Layout,
} from "./layout";
import { ExportDialog } from "./export-dialog";
import { FileHistory } from "./file-history";
import { ProjectDialog, type ProjectRequest } from "./project-dialog";
import { MoodleDialog } from "./moodle-dialog";
import { WorkspacePane } from "./pane";
import { QuickOpen } from "./quick-open";
import { Sidebar } from "./sidebar";
import { TrashDialog } from "./trash-dialog";

export interface WorkspaceViewProps {
  snapshot: WorkspaceSnapshot;
  savedLayout: unknown;
  recent: RecentWorkspace[];
  settings: AppSettings;
  moodle: MoodleConnection;
  setSnapshot: Dispatch<SetStateAction<WorkspaceSnapshot>>;
  onSwitchWorkspace: (path: string) => void;
  onCreateWorkspace: () => void;
  onOpenFolder: () => void;
  /** Picks a .resit archive to open. */
  onOpenArchive: () => void;
  /** Opens settings, at a topic when the action points at one. */
  onOpenSettings: (topic?: SettingsTopic) => void;
  /** The AI panel, given the layout so it can read the focused tab. */
  renderAiPanel?: (context: {
    layout: Layout;
    resources: ReadonlyMap<string, ResourceInfo>;
    subjects: ReadonlyMap<string, SubjectInfo>;
    projects: ReadonlyMap<string, ProjectInfo>;
    setConversation: (conversationId: string | null) => void;
  }) => ReactNode;
}

export function WorkspaceView({
  snapshot,
  savedLayout,
  recent,
  moodle,
  setSnapshot,
  onSwitchWorkspace,
  onCreateWorkspace,
  onOpenFolder,
  onOpenArchive,
  onOpenSettings,
  renderAiPanel,
}: WorkspaceViewProps) {
  const { t } = useLocale();
  const notices = useNotices();
  const [layout, dispatch] = useReducer(
    layoutReducer,
    savedLayout,
    (saved: unknown) =>
      restoreLayout(
        saved,
        snapshot.subjects.map((subject) => subject.id),
      ),
  );
  const [quickOpen, setQuickOpen] = useState(false);
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [subjectRequest, setSubjectRequest] = useState<SubjectRequest | null>(
    null,
  );
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [projectRequest, setProjectRequest] = useState<ProjectRequest | null>(
    null,
  );
  const [moodleSubjectId, setMoodleSubjectId] = useState<string | null>(null);
  const [cardRequest, setCardRequest] = useState<CardRequest | null>(null);
  const [quizRequest, setQuizRequest] = useState<QuizEditorRequest | null>(
    null,
  );
  const [courses, setCourses] = useState<MoodleCourse[]>();

  const resources = useMemo(
    () =>
      new Map(snapshot.resources.map((resource) => [resource.id, resource])),
    [snapshot.resources],
  );
  const subjects = useMemo(
    () => new Map(snapshot.subjects.map((subject) => [subject.id, subject])),
    [snapshot.subjects],
  );
  const projects = useMemo(
    () => new Map(snapshot.projects.map((project) => [project.id, project])),
    [snapshot.projects],
  );
  const subjectIds = useMemo(
    () => snapshot.subjects.map((subject) => subject.id),
    [snapshot.subjects],
  );
  const { practice } = usePractice(subjectIds);
  const practiceDue = practice ? dueCount(practice) : 0;
  const waitingSuggestions = useWaitingSuggestions();
  const liveSubjects = useMemo(
    () => snapshot.subjects.filter((subject) => !subject.archived),
    [snapshot.subjects],
  );

  // Persist tabs and panes shortly after they change.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      api.saveLayout(layout).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [layout]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "workspace-changed") setSnapshot(event.snapshot);
        // A session reminder was clicked.
        if (event.type === "show-schedule")
          dispatch({
            type: "open",
            resourceId: SCHEDULE_TAB_ID,
            title: t("Schedule"),
          });
      }),
    [t, setSnapshot],
  );

  // Draws the PDF pages the assistant asks to look at.
  useEffect(() => startPageRenderer(), []);
  useLiveContext(layout, resources);

  const focusedTab = activeTab(layout);
  const focusedProjectId = focusedTab
    ? (parseProjectTabId(focusedTab.resourceId) ?? undefined)
    : undefined;
  const focusedResource = focusedTab
    ? resources.get(focusedTab.resourceId)
    : undefined;
  const currentSubjectId =
    focusedResource?.subjectId ?? snapshot.subjects[0]?.id ?? null;

  const openResource = useCallback(
    (resourceId: string, page?: number) => {
      const resource = resources.get(resourceId);
      if (!resource) return;
      dispatch({ type: "open", resourceId, title: resource.title });
      if (page && resource.kind === "pdf") showTarget(resourceId, { page });
    },
    [resources],
  );

  /** Follows a `resit://` link from a note to its source page or highlight. */
  const openLink = useCallback(
    (resourceId: string, target: DocumentTarget) => {
      const resource = resources.get(resourceId);
      if (!resource) {
        notices.notify({
          tone: "info",
          title: t("That link points to a file that is no longer here"),
          detail: t("It was renamed outside resit, or moved to the trash."),
        });
        return;
      }
      dispatch({ type: "open", resourceId, title: resource.title });
      showTarget(resourceId, target);
    },
    [t, resources, notices],
  );

  const refresh = useCallback(
    (next: WorkspaceSnapshot) => setSnapshot(next),
    [setSnapshot],
  );

  /** Opens the subject, and the folder inside it when a file went there. */
  const revealIn = useCallback((subjectId: string, folder?: string) => {
    dispatch({ type: "set-expanded", id: subjectId, expanded: true });
    if (folder)
      dispatch({
        type: "set-expanded",
        id: `${subjectId}/folder/${folder}`,
        expanded: true,
      });
  }, []);

  const newNote = useCallback(
    (subjectId: string, folder?: string) => {
      const subject = subjects.get(subjectId);
      const where = [subject?.name, folder].filter(Boolean).join(" / ");
      setPrompt({
        title: t("New note"),
        ...(where ? { description: t("In {place}", { place: where }) } : {}),
        label: t("Title"),
        placeholder: t("Limits and continuity"),
        submitLabel: t("Create note"),
        onSubmit: async (title) => {
          try {
            const resource = await api.createNote({
              subjectId,
              title,
              ...(folder ? { folder } : {}),
            });
            setSnapshot((current) => ({
              ...current,
              resources: [...current.resources, resource],
            }));
            revealIn(subjectId, folder);
            dispatch({ type: "open", resourceId: resource.id, title });
          } catch (error) {
            notices.fail(t("The note was not created"), error);
          }
        },
      });
    },
    [t, subjects, setSnapshot, notices, revealIn],
  );

  const newFolder = useCallback(
    (subjectId: string, parent?: string) => {
      const subject = subjects.get(subjectId);
      const where = [subject?.name, parent].filter(Boolean).join(" / ");
      setPrompt({
        title: t("New folder"),
        ...(where ? { description: t("In {place}", { place: where }) } : {}),
        label: t("Name"),
        placeholder: t("Worksheets"),
        submitLabel: t("Create folder"),
        onSubmit: async (name) => {
          try {
            const folder = await api.createFolder({
              subjectId,
              name,
              ...(parent ? { parent } : {}),
            });
            setSnapshot((current) => ({
              ...current,
              folders: [...current.folders, folder],
            }));
            revealIn(subjectId, parent);
          } catch (error) {
            notices.fail(t("The folder was not created"), error);
          }
        },
      });
    },
    [t, subjects, setSnapshot, notices, revealIn],
  );

  /** Renames a folder or moves it into another, keeping it open in the tree. */
  const relocateFolder = useCallback(
    async (
      input: {
        subjectId: string;
        path: string;
        name?: string;
        parent?: string;
      },
      failure: string,
    ) => {
      try {
        const { folder, snapshot: next } = await api.updateFolder(input);
        setSnapshot(next);
        revealIn(folder.subjectId, folder.path);
      } catch (error) {
        notices.fail(failure, error);
      }
    },
    [setSnapshot, notices, revealIn],
  );

  const renameFolder = useCallback(
    (subjectId: string, path: string) => {
      setPrompt({
        title: t("Rename folder"),
        label: t("Name"),
        initialValue: path.slice(path.lastIndexOf("/") + 1),
        submitLabel: t("Rename"),
        onSubmit: (name) =>
          relocateFolder(
            { subjectId, path, name },
            t("The folder was not renamed"),
          ),
      });
    },
    [t, relocateFolder],
  );

  const importFiles = useCallback(
    async (subjectId: string, folder?: string) => {
      try {
        const imported = await api.importFiles(subjectId, folder);
        if (imported.length === 0) return;
        setSnapshot((current) => ({
          ...current,
          resources: [...current.resources, ...imported],
        }));
        revealIn(subjectId, folder);
        const first = imported[0];
        if (first)
          dispatch({ type: "open", resourceId: first.id, title: first.title });
      } catch (error) {
        notices.fail(t("Import stopped"), error);
      }
    },
    [t, setSnapshot, notices, revealIn],
  );

  const connected = moodle.status === "connected";

  const addSubject = useCallback(() => {
    // Loading the course list can wait: the picker appears once it arrives.
    if (connected && !courses)
      api.listMoodleCourses().then(setCourses, () => undefined);
    setSubjectRequest({
      title: t("New subject"),
      submitLabel: t("Add subject"),
      linkable: connected,
      onSubmit: async ({ name, color, moodleCourseId }) => {
        try {
          const subject = await api.createSubject({
            name,
            color,
            ...(moodleCourseId ? { moodleCourseId } : {}),
          });
          setSnapshot((current) => ({
            ...current,
            subjects: [...current.subjects, subject],
          }));
          dispatch({ type: "set-expanded", id: subject.id, expanded: true });
        } catch (error) {
          notices.fail(t("The subject was not created"), error);
        }
      },
    });
  }, [t, setSnapshot, notices, connected, courses]);

  const renameResource = useCallback(
    async (resourceId: string, title: string) => {
      try {
        const resource = await api.renameResource({ id: resourceId, title });
        setSnapshot((current) => ({
          ...current,
          resources: current.resources.map((entry) =>
            entry.id === resourceId ? resource : entry,
          ),
        }));
        dispatch({ type: "rename-resource", resourceId, title });
      } catch (error) {
        notices.fail(t("The file was not renamed"), error);
      }
    },
    [t, setSnapshot, notices],
  );

  /** Saves a project's name and contents, new or changed. */
  const editProject = (project?: ProjectInfo) =>
    setProjectRequest({
      title: project ? t("Edit project") : t("New project"),
      submitLabel: project ? t("Save") : t("Create project"),
      ...(project ? { project } : {}),
      onSubmit: async (values) => {
        try {
          const saved = project
            ? await api.updateProject({ id: project.id, ...values })
            : await api.createProject(values);
          setSnapshot((current) => ({
            ...current,
            projects: [
              ...current.projects.filter((entry) => entry.id !== saved.id),
              saved,
            ].sort((a, b) => a.title.localeCompare(b.title)),
          }));
          dispatch({
            type: "open",
            resourceId: projectTabId(saved.id),
            title: saved.title,
          });
          dispatch({
            type: "rename-resource",
            resourceId: projectTabId(saved.id),
            title: saved.title,
          });
        } catch (error) {
          notices.fail(
            project
              ? t("The project was not changed")
              : t("The project was not created"),
            error,
          );
        }
      },
    });

  const projectActions = {
    ask: (projectId: string) => {
      dispatch({ type: "set-ai-open", open: true });
      requestProjectChat(projectId);
    },
    edit: (projectId: string) => editProject(projects.get(projectId)),
    remove: (projectId: string) => {
      const project = projects.get(projectId);
      if (!project) return;
      setConfirm({
        title: t("Delete “{title}”?", { title: project.title }),
        description: t(
          "The project goes to the trash. Its subjects and files stay where they are.",
        ),
        confirmLabel: t("Delete project"),
        onConfirm: async () => {
          try {
            refresh(await api.deleteProject(projectId));
            dispatch({
              type: "close-resource",
              resourceId: projectTabId(projectId),
            });
          } catch (error) {
            notices.fail(t("The project was not deleted"), error);
          }
        },
      });
    },
    revealSubject: (subjectId: string) =>
      dispatch({ type: "set-expanded", id: subjectId, expanded: true }),
  };

  const actions = {
    openResource,
    addProject: () => editProject(),
    openProject: (projectId: string) => {
      const project = projects.get(projectId);
      if (project)
        dispatch({
          type: "open",
          resourceId: projectTabId(projectId),
          title: project.title,
        });
    },
    switchWorkspace: (path: string) => {
      void flushAllViews().then(() => onSwitchWorkspace(path));
    },
    createWorkspace: () => {
      void flushAllViews().then(onCreateWorkspace);
    },
    openFolder: () => {
      void flushAllViews().then(onOpenFolder);
    },
    openArchive: () => {
      void flushAllViews().then(onOpenArchive);
    },
    exportMarkdown: (input: { subjectId: string } | { noteId: string }) =>
      void (async () => {
        try {
          await flushAllViews();
          const result = await api.exportMarkdown(input);
          if (!result) return;
          notices.notify({
            tone: "success",
            title:
              result.notes === 1
                ? t("Exported {count} note as Markdown", { count: 1 })
                : t("Exported {count} notes as Markdown", {
                    count: result.notes,
                  }),
            detail: [
              result.folder,
              result.files === 0
                ? ""
                : result.files === 1
                  ? t("{count} linked file is in its files folder.", {
                      count: 1,
                    })
                  : t("{count} linked files are in its files folder.", {
                      count: result.files,
                    }),
              result.unresolved === 0
                ? ""
                : result.unresolved === 1
                  ? t(
                      "{count} link points to notes that were not exported, so it keeps its resit:// address.",
                      { count: 1 },
                    )
                  : t(
                      "{count} links point to notes that were not exported, so they keep their resit:// address.",
                      { count: result.unresolved },
                    ),
            ]
              .filter(Boolean)
              .join(" "),
          });
        } catch (error) {
          notices.fail(t("The notes were not exported"), error);
        }
      })(),
    addSubject,
    editSubject: (subjectId: string) => {
      const subject = subjects.get(subjectId);
      if (!subject) return;
      setSubjectRequest({
        title: t("Edit subject"),
        submitLabel: t("Save"),
        name: subject.name,
        color: subject.color,
        onSubmit: async ({ name, color }) => {
          try {
            refresh(await api.updateSubject({ id: subjectId, name, color }));
          } catch (error) {
            notices.fail(t("The subject was not changed"), error);
          }
        },
      });
    },
    deleteSubject: (subjectId: string) => {
      const subject = subjects.get(subjectId);
      if (!subject) return;
      const owned = snapshot.resources.filter(
        (resource) => resource.subjectId === subjectId,
      );
      setConfirm({
        title: t("Move {name} to the trash?", { name: subject.name }),
        description:
          owned.length === 0
            ? t("The subject has no notes or files.")
            : owned.length === 1
              ? t(
                  "Its {count} note or file moves with it: {list}. They stay in the workspace's .resit/trash folder.",
                  { count: 1, list: owned[0]?.title ?? "" },
                )
              : t(
                  "Its {count} notes and files move with it: {list}. They stay in the workspace's .resit/trash folder.",
                  {
                    count: owned.length,
                    list: `${owned
                      .slice(0, 5)
                      .map((resource) => resource.title)
                      .join(", ")}${owned.length > 5 ? ", …" : ""}`,
                  },
                ),
        confirmLabel: t("Move to trash"),
        onConfirm: async () => {
          try {
            await Promise.all(
              owned.map((resource) => viewFor(resource.id)?.flush?.()),
            );
            refresh(await api.deleteSubject(subjectId));
            for (const resource of owned)
              dispatch({ type: "close-resource", resourceId: resource.id });
          } catch (error) {
            notices.fail(t("The subject was not moved to the trash"), error);
          }
        },
      });
    },
    moveSubject: (subjectId: string, direction: -1 | 1) => {
      const ordered = snapshot.subjects;
      const index = ordered.findIndex((subject) => subject.id === subjectId);
      const neighbour = ordered[index + direction];
      const subject = ordered[index];
      if (!subject || !neighbour) return;
      void (async () => {
        try {
          await api.updateSubject({
            id: subject.id,
            sortOrder: neighbour.sortOrder,
          });
          refresh(
            await api.updateSubject({
              id: neighbour.id,
              sortOrder: subject.sortOrder,
            }),
          );
        } catch (error) {
          notices.fail(t("The subjects were not reordered"), error);
        }
      })();
    },
    newNote,
    newFolder,
    renameFolder,
    moveFolder: (subjectId: string, path: string, parent?: string) =>
      void relocateFolder(
        { subjectId, path, parent: parent ?? "" },
        t("The folder was not moved"),
      ),
    moveResource: (resourceId: string, subjectId: string, folder?: string) =>
      void (async () => {
        try {
          await viewFor(resourceId)?.flush?.();
          const resource = await api.moveResource({
            id: resourceId,
            subjectId,
            ...(folder ? { folder } : {}),
          });
          setSnapshot((current) => ({
            ...current,
            resources: current.resources.map((entry) =>
              entry.id === resourceId ? resource : entry,
            ),
          }));
          revealIn(subjectId, folder);
        } catch (error) {
          notices.fail(t("The file was not moved"), error);
        }
      })(),
    importFiles: (subjectId: string, folder?: string) =>
      void importFiles(subjectId, folder),
    openMoodle: (subjectId: string) => setMoodleSubjectId(subjectId),
    openCourse: (subjectId: string) =>
      dispatch({
        type: "open",
        resourceId: courseTabId(subjectId),
        title:
          snapshot.subjects.find((subject) => subject.id === subjectId)?.moodle
            ?.fullname ?? t("Course"),
      }),
    deleteFolder: (subjectId: string, path: string) => {
      const folder = snapshot.folders.find(
        (entry) => entry.subjectId === subjectId && entry.path === path,
      );
      if (!folder) return;
      const owned = snapshot.resources.filter(
        (resource) =>
          resource.subjectId === subjectId &&
          (resource.folder === path ||
            resource.folder?.startsWith(`${path}/`) === true),
      );
      setConfirm({
        title: t("Move “{path}” to the trash?", { path }),
        description: folder.moodle
          ? owned.length === 1
            ? t(
                "This folder holds {count} file downloaded from the Moodle course. They move to the workspace's .resit/trash folder, and following the course again downloads them.",
                { count: 1 },
              )
            : t(
                "This folder holds {count} files downloaded from the Moodle course. They move to the workspace's .resit/trash folder, and following the course again downloads them.",
                { count: owned.length },
              )
          : owned.length === 0
            ? t("The folder is empty.")
            : owned.length === 1
              ? t(
                  "Its {count} note or file moves with it. They stay in the workspace's .resit/trash folder.",
                  { count: 1 },
                )
              : t(
                  "Its {count} notes and files move with it. They stay in the workspace's .resit/trash folder.",
                  { count: owned.length },
                ),
        confirmLabel: t("Move to trash"),
        onConfirm: async () => {
          try {
            await Promise.all(
              owned.map((resource) => viewFor(resource.id)?.flush?.()),
            );
            refresh(await api.deleteFolder({ subjectId, path }));
            for (const resource of owned)
              dispatch({ type: "close-resource", resourceId: resource.id });
          } catch (error) {
            notices.fail(t("The folder was not moved to the trash"), error);
          }
        },
      });
    },
    renameResource: (resourceId: string) => {
      const resource = resources.get(resourceId);
      if (!resource) return;
      setPrompt({
        title: t("Rename"),
        label: t("Title"),
        initialValue: resource.title,
        submitLabel: t("Rename"),
        onSubmit: (title) => renameResource(resourceId, title),
      });
    },
    deleteResource: (resourceId: string) => {
      const resource = resources.get(resourceId);
      if (!resource) return;
      setConfirm({
        title: t("Move “{title}” to the trash?", { title: resource.title }),
        description: t(
          "It moves to the workspace's .resit/trash folder. Links to it will show as missing.",
        ),
        confirmLabel: t("Move to trash"),
        onConfirm: async () => {
          try {
            await viewFor(resourceId)?.flush?.();
            refresh(await api.deleteResource(resourceId));
            dispatch({ type: "close-resource", resourceId });
          } catch (error) {
            notices.fail(t("The file was not moved to the trash"), error);
          }
        },
      });
    },
    showFileHistory: (resourceId: string) => setHistoryId(resourceId),
    openGraph: () =>
      dispatch({ type: "open", resourceId: GRAPH_TAB_ID, title: t("Graph") }),
    openSchedule: () =>
      dispatch({
        type: "open",
        resourceId: SCHEDULE_TAB_ID,
        title: t("Schedule"),
      }),
    openPractice: () =>
      dispatch({
        type: "open",
        resourceId: PRACTICE_TAB_ID,
        title: t("Practice"),
      }),
    openProfile: () =>
      dispatch({
        type: "open",
        resourceId: PROFILE_TAB_ID,
        title: t("Learner profile"),
      }),
    openTrash: () => setTrashOpen(true),
    openSettings: () => onOpenSettings(),
  };

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const subjectRef = useRef(currentSubjectId);
  subjectRef.current = currentSubjectId;

  /** Puts a quoted highlight into the note the student is writing in. */
  const cite = useCallback(
    (markdown: string) => {
      const note = insertIntoNote(layoutRef.current, resources, markdown);
      if (note)
        notices.notify({
          tone: "success",
          title: t("Quoted in {title}", { title: note.title }),
        });
      else
        notices.notify({
          tone: "info",
          title: t("Open a note to quote this highlight"),
          detail: t("Split the pane with Ctrl+\\ to keep both open."),
        });
    },
    [t, resources, notices],
  );

  // A highlight made into a flashcard opens the card dialog over the PDF.
  useEffect(() => onCardRequest(setCardRequest), []);

  // Asking about a highlight brings the AI panel out if it is collapsed.
  useEffect(
    () => onAskRequest(() => dispatch({ type: "set-ai-open", open: true })),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if ((key === "k" || key === "p") && !event.shiftKey) {
        event.preventDefault();
        setQuickOpen((open) => !open);
      } else if (key === "w") {
        event.preventDefault();
        const current = layoutRef.current;
        const tab = activeTab(current);
        if (tab)
          dispatch({
            type: "close",
            paneId: current.focusedPaneId,
            tabId: tab.id,
          });
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        if (subjectRef.current) actionsRef.current.newNote(subjectRef.current);
      } else if (key === "\\") {
        event.preventDefault();
        dispatch({ type: "split", paneId: layoutRef.current.focusedPaneId });
      } else if (key === "b" && event.shiftKey === false && event.altKey) {
        event.preventDefault();
        dispatch({ type: "toggle-sidebar" });
      } else if (key === "g" && event.shiftKey) {
        event.preventDefault();
        actionsRef.current.openGraph();
      } else if (key === "j") {
        event.preventDefault();
        dispatch({ type: "set-ai-open", open: !layoutRef.current.aiOpen });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setConversation = useCallback(
    (conversationId: string | null) =>
      dispatch({ type: "set-conversation", conversationId }),
    [],
  );
  const aiPanel = renderAiPanel?.({
    layout,
    resources,
    subjects,
    projects,
    setConversation,
  });

  const panes = layout.panes.map((pane) => (
    <WorkspacePane
      key={pane.id}
      pane={pane}
      snapshot={snapshot}
      focused={pane.id === layout.focusedPaneId}
      canSplit={layout.panes.length === 1}
      canClose={layout.panes.length > 1}
      resources={resources}
      subjects={subjects}
      moodle={moodle}
      dispatch={dispatch}
      onRename={renameResource}
      onOpenLink={openLink}
      onCite={cite}
      onOpenSettings={() => onOpenSettings("moodle")}
      onOpenMoodle={setMoodleSubjectId}
      onOpenResource={openResource}
      onEditCard={setCardRequest}
      onEditQuiz={setQuizRequest}
      projectActions={projectActions}
    />
  ));

  return (
    <>
      <AppShell
        className="min-h-0 flex-1"
        title={
          <div className="flex min-w-0 items-center gap-1">
            <WorkspaceSwitcher
              workspace={{
                id: snapshot.workspace.id,
                name: snapshot.workspace.name,
                path: snapshot.workspace.root,
              }}
              recent={recent}
              onSwitch={(id) => {
                const target = recent.find((entry) => entry.id === id);
                if (target) actions.switchWorkspace(target.path);
              }}
              onCreate={actions.createWorkspace}
              onOpenFolder={actions.openFolder}
              onOpenArchive={actions.openArchive}
              onExport={() => setExportOpen(true)}
            />
            {focusedResource ? (
              <Breadcrumb
                subject={subjects.get(focusedResource.subjectId)}
                title={focusedResource.title}
              />
            ) : null}
          </div>
        }
        sidebarOpen={layout.sidebarOpen}
        onToggleSidebar={() => dispatch({ type: "toggle-sidebar" })}
        onSearch={() => setQuickOpen(true)}
        sidebar={
          <Sidebar
            snapshot={snapshot}
            expanded={layout.expanded}
            onExpandedChange={(id, expanded) =>
              dispatch({ type: "set-expanded", id, expanded })
            }
            activeResourceId={focusedResource?.id}
            activeProjectId={focusedProjectId}
            practiceDue={practiceDue}
            waitingSuggestions={waitingSuggestions}
            actions={actions}
          />
        }
        {...(aiPanel
          ? {
              aiPanel,
              aiPanelOpen: layout.aiOpen,
              onToggleAiPanel: () =>
                dispatch({ type: "set-ai-open", open: !layout.aiOpen }),
            }
          : {})}
      >
        {panes.length === 1 ? (
          panes[0]
        ) : (
          <SplitLayout direction="horizontal" minSize={280}>
            {panes}
          </SplitLayout>
        )}
      </AppShell>
      <QuickOpen
        open={quickOpen}
        onOpenChange={setQuickOpen}
        snapshot={snapshot}
        onOpenResource={openResource}
        commands={[
          ...(currentSubjectId
            ? [
                {
                  id: "new-note",
                  label: t("New note in {subject}", {
                    subject:
                      subjects.get(currentSubjectId)?.name ?? t("subject"),
                  }),
                  shortcut: "Ctrl+N",
                  icon: "new-note" as const,
                  run: () => newNote(currentSubjectId),
                },
              ]
            : []),
          {
            id: "new-subject",
            label: t("New subject"),
            icon: "new-subject",
            run: addSubject,
          },
          {
            id: "graph",
            label: t("Open the graph"),
            shortcut: "Ctrl+Shift+G",
            icon: "graph",
            run: actions.openGraph,
          },
          {
            id: "schedule",
            label: t("Open the schedule"),
            icon: "schedule",
            run: actions.openSchedule,
          },
          {
            id: "practice",
            label: t("Open practice"),
            icon: "practice",
            run: actions.openPractice,
          },
          {
            id: "profile",
            label: t("Open the learner profile"),
            icon: "profile",
            run: actions.openProfile,
          },
          ...(liveSubjects.length > 0
            ? [
                {
                  id: "new-card",
                  label: t("New flashcard"),
                  icon: "practice" as const,
                  run: () =>
                    setCardRequest(
                      currentSubjectId ? { subjectId: currentSubjectId } : {},
                    ),
                },
                {
                  id: "new-quiz",
                  label: t("New quiz"),
                  icon: "quiz" as const,
                  run: () =>
                    setQuizRequest(
                      currentSubjectId ? { subjectId: currentSubjectId } : {},
                    ),
                },
              ]
            : []),
          {
            id: "export",
            label: t("Export workspace"),
            icon: "export",
            run: () => setExportOpen(true),
          },
          {
            id: "settings",
            label: t("Settings"),
            icon: "settings",
            run: () => onOpenSettings(),
          },
        ]}
      />
      <PromptDialog request={prompt} onClose={() => setPrompt(null)} />
      <SubjectDialog
        request={subjectRequest}
        courses={courses}
        onClose={() => setSubjectRequest(null)}
      />
      <MoodleDialog
        subject={
          moodleSubjectId ? (subjects.get(moodleSubjectId) ?? null) : null
        }
        connection={moodle}
        onOpenChange={(open) => !open && setMoodleSubjectId(null)}
        onOpenSettings={() => onOpenSettings("moodle")}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <CardDialog
        request={cardRequest}
        subjects={liveSubjects}
        onClose={() => setCardRequest(null)}
      />
      <QuizEditor
        request={quizRequest}
        subjects={liveSubjects}
        onClose={() => setQuizRequest(null)}
        onSaved={(subjectId, quiz) => {
          const resourceId = quizTabId(subjectId, quiz.id);
          dispatch({ type: "rename-resource", resourceId, title: quiz.title });
          dispatch({ type: "open", resourceId, title: quiz.title });
        }}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ProjectDialog
        request={projectRequest}
        subjects={liveSubjects}
        resources={snapshot.resources}
        onClose={() => setProjectRequest(null)}
      />
      <FileHistory
        resource={historyId ? (resources.get(historyId) ?? null) : null}
        onClose={() => setHistoryId(null)}
      />
      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        onRestored={refresh}
      />
    </>
  );
}

/** How many profile suggestions wait for the student. Read when the profile changes. */
function useWaitingSuggestions(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let current = true;
    const load = () =>
      api.getLearnerProfile().then(
        (profile) => {
          if (current)
            setCount(
              profile.file.proposals.filter(
                (proposal) => proposal.status === "proposed",
              ).length,
            );
        },
        () => undefined,
      );
    void load();
    const stop = api.onEvent((event) => {
      if (event.type === "learner-changed") void load();
    });
    return () => {
      current = false;
      stop();
    };
  }, []);
  return count;
}

/** Title bar location after the workspace: the open document and its subject. */
function Breadcrumb({
  subject,
  title,
}: {
  subject: SubjectInfo | undefined;
  title: string;
}) {
  const { t } = useLocale();
  return (
    <nav
      aria-label={t("Current document")}
      className="flex min-w-0 items-center gap-1.5"
    >
      <span aria-hidden className="text-subtle-foreground">
        /
      </span>
      {subject ? (
        <>
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              subjectColorClasses[subject.color].dot,
            )}
          />
          <span className="max-w-48 shrink truncate">{subject.name}</span>
          <span aria-hidden className="text-subtle-foreground">
            /
          </span>
        </>
      ) : null}
      <span className="min-w-0 truncate font-medium text-foreground">
        {title}
      </span>
    </nav>
  );
}
