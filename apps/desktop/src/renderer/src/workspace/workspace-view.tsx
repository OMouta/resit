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
import { AppShell } from "@resit/ui/patterns/screens/app-shell";

import type { AppSettings } from "../../../shared/settings";
import type {
  RecentWorkspace,
  ResourceInfo,
  SubjectInfo,
  WorkspaceSnapshot,
} from "../../../shared/workspace";
import { PromptDialog, type PromptRequest } from "../components/prompt-dialog";
import type { SettingsTopic } from "../settings/settings-dialog";
import { api } from "../lib/api";
import { insertIntoNote } from "../lib/citations";
import { useNotices } from "../lib/notices";
import {
  flushAllViews,
  onAskRequest,
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
import { activeTab, layoutReducer, restoreLayout, type Layout } from "./layout";
import { WorkspacePane } from "./pane";
import { QuickOpen } from "./quick-open";
import { Sidebar } from "./sidebar";
import { TrashDialog } from "./trash-dialog";

export interface WorkspaceViewProps {
  snapshot: WorkspaceSnapshot;
  savedLayout: unknown;
  recent: RecentWorkspace[];
  settings: AppSettings;
  setSnapshot: Dispatch<SetStateAction<WorkspaceSnapshot>>;
  onSwitchWorkspace: (path: string) => void;
  onCreateWorkspace: () => void;
  onOpenFolder: () => void;
  /** Opens settings, at a topic when the action points at one. */
  onOpenSettings: (topic?: SettingsTopic) => void;
  /** The AI panel, given the layout so it can read the focused tab. */
  renderAiPanel?: (context: {
    layout: Layout;
    resources: ReadonlyMap<string, ResourceInfo>;
    subjects: ReadonlyMap<string, SubjectInfo>;
    setConversation: (conversationId: string | null) => void;
  }) => ReactNode;
}

export function WorkspaceView({
  snapshot,
  savedLayout,
  recent,
  setSnapshot,
  onSwitchWorkspace,
  onCreateWorkspace,
  onOpenFolder,
  onOpenSettings,
  renderAiPanel,
}: WorkspaceViewProps) {
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

  const resources = useMemo(
    () =>
      new Map(snapshot.resources.map((resource) => [resource.id, resource])),
    [snapshot.resources],
  );
  const subjects = useMemo(
    () => new Map(snapshot.subjects.map((subject) => [subject.id, subject])),
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
      }),
    [setSnapshot],
  );

  const focusedTab = activeTab(layout);
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
          title: "That link points to a file that is no longer here",
          detail: "It was renamed outside resit, or moved to the trash.",
        });
        return;
      }
      dispatch({ type: "open", resourceId, title: resource.title });
      showTarget(resourceId, target);
    },
    [resources, notices],
  );

  const refresh = useCallback(
    (next: WorkspaceSnapshot) => setSnapshot(next),
    [setSnapshot],
  );

  const newNote = useCallback(
    (subjectId: string) => {
      const subject = subjects.get(subjectId);
      setPrompt({
        title: "New note",
        ...(subject ? { description: `In ${subject.name}` } : {}),
        label: "Title",
        placeholder: "Limits and continuity",
        submitLabel: "Create note",
        onSubmit: async (title) => {
          try {
            const resource = await api.createNote({ subjectId, title });
            setSnapshot((current) => ({
              ...current,
              resources: [...current.resources, resource],
            }));
            dispatch({ type: "set-expanded", id: subjectId, expanded: true });
            dispatch({ type: "open", resourceId: resource.id, title });
          } catch (error) {
            notices.fail("The note was not created", error);
          }
        },
      });
    },
    [subjects, setSnapshot, notices],
  );

  const importFiles = useCallback(
    async (subjectId: string) => {
      try {
        const imported = await api.importFiles(subjectId);
        if (imported.length === 0) return;
        setSnapshot((current) => ({
          ...current,
          resources: [...current.resources, ...imported],
        }));
        dispatch({ type: "set-expanded", id: subjectId, expanded: true });
        const first = imported[0];
        if (first)
          dispatch({ type: "open", resourceId: first.id, title: first.title });
      } catch (error) {
        notices.fail("Import stopped", error);
      }
    },
    [setSnapshot, notices],
  );

  const addSubject = useCallback(() => {
    setSubjectRequest({
      title: "New subject",
      submitLabel: "Add subject",
      onSubmit: async ({ name, color }) => {
        try {
          const subject = await api.createSubject({ name, color });
          setSnapshot((current) => ({
            ...current,
            subjects: [...current.subjects, subject],
          }));
          dispatch({ type: "set-expanded", id: subject.id, expanded: true });
        } catch (error) {
          notices.fail("The subject was not created", error);
        }
      },
    });
  }, [setSnapshot, notices]);

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
        notices.fail("The file was not renamed", error);
      }
    },
    [setSnapshot, notices],
  );

  const actions = {
    openResource,
    switchWorkspace: (path: string) => {
      void flushAllViews().then(() => onSwitchWorkspace(path));
    },
    createWorkspace: () => {
      void flushAllViews().then(onCreateWorkspace);
    },
    openFolder: () => {
      void flushAllViews().then(onOpenFolder);
    },
    addSubject,
    editSubject: (subjectId: string) => {
      const subject = subjects.get(subjectId);
      if (!subject) return;
      setSubjectRequest({
        title: "Edit subject",
        submitLabel: "Save",
        name: subject.name,
        color: subject.color,
        onSubmit: async ({ name, color }) => {
          try {
            refresh(await api.updateSubject({ id: subjectId, name, color }));
          } catch (error) {
            notices.fail("The subject was not changed", error);
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
        title: `Move ${subject.name} to the trash?`,
        description:
          owned.length === 0
            ? "The subject has no notes or files."
            : `Its ${owned.length} ${owned.length === 1 ? "note or file moves" : "notes and files move"} with it: ${owned
                .slice(0, 5)
                .map((resource) => resource.title)
                .join(
                  ", ",
                )}${owned.length > 5 ? ", …" : ""}. They stay in the workspace's .resit/trash folder.`,
        confirmLabel: "Move to trash",
        onConfirm: async () => {
          try {
            await Promise.all(
              owned.map((resource) => viewFor(resource.id)?.flush?.()),
            );
            refresh(await api.deleteSubject(subjectId));
            for (const resource of owned)
              dispatch({ type: "close-resource", resourceId: resource.id });
          } catch (error) {
            notices.fail("The subject was not moved to the trash", error);
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
          notices.fail("The subjects were not reordered", error);
        }
      })();
    },
    newNote,
    importFiles: (subjectId: string) => void importFiles(subjectId),
    renameResource: (resourceId: string) => {
      const resource = resources.get(resourceId);
      if (!resource) return;
      setPrompt({
        title: "Rename",
        label: "Title",
        initialValue: resource.title,
        submitLabel: "Rename",
        onSubmit: (title) => renameResource(resourceId, title),
      });
    },
    deleteResource: (resourceId: string) => {
      const resource = resources.get(resourceId);
      if (!resource) return;
      setConfirm({
        title: `Move “${resource.title}” to the trash?`,
        description:
          "It moves to the workspace's .resit/trash folder. Links to it will show as missing.",
        confirmLabel: "Move to trash",
        onConfirm: async () => {
          try {
            await viewFor(resourceId)?.flush?.();
            refresh(await api.deleteResource(resourceId));
            dispatch({ type: "close-resource", resourceId });
          } catch (error) {
            notices.fail("The file was not moved to the trash", error);
          }
        },
      });
    },
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
        notices.notify({ tone: "success", title: `Quoted in ${note.title}` });
      else
        notices.notify({
          tone: "info",
          title: "Open a note to quote this highlight",
          detail: "Split the pane with Ctrl+\\ to keep both open.",
        });
    },
    [resources, notices],
  );

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
    setConversation,
  });

  const panes = layout.panes.map((pane) => (
    <WorkspacePane
      key={pane.id}
      pane={pane}
      focused={pane.id === layout.focusedPaneId}
      canSplit={layout.panes.length === 1}
      canClose={layout.panes.length > 1}
      resources={resources}
      subjects={subjects}
      dispatch={dispatch}
      onRename={renameResource}
      onOpenLink={openLink}
      onCite={cite}
    />
  ));

  return (
    <>
      <AppShell
        className="min-h-0 flex-1"
        title={
          <Breadcrumb
            workspace={snapshot.workspace.name}
            subject={
              focusedResource
                ? subjects.get(focusedResource.subjectId)
                : undefined
            }
            title={focusedResource?.title}
          />
        }
        sidebarOpen={layout.sidebarOpen}
        onToggleSidebar={() => dispatch({ type: "toggle-sidebar" })}
        onSearch={() => setQuickOpen(true)}
        sidebar={
          <Sidebar
            snapshot={snapshot}
            recent={recent}
            expanded={layout.expanded}
            onExpandedChange={(id, expanded) =>
              dispatch({ type: "set-expanded", id, expanded })
            }
            activeResourceId={focusedResource?.id}
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
                  label: `New note in ${subjects.get(currentSubjectId)?.name ?? "subject"}`,
                  shortcut: "Ctrl+N",
                  icon: "new-note" as const,
                  run: () => newNote(currentSubjectId),
                },
              ]
            : []),
          {
            id: "new-subject",
            label: "New subject",
            icon: "new-subject",
            run: addSubject,
          },
          {
            id: "settings",
            label: "Settings",
            icon: "settings",
            run: () => onOpenSettings(),
          },
        ]}
      />
      <PromptDialog request={prompt} onClose={() => setPrompt(null)} />
      <SubjectDialog
        request={subjectRequest}
        onClose={() => setSubjectRequest(null)}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        onRestored={refresh}
      />
    </>
  );
}

/** Title bar location: subject and document, or the workspace when nothing is open. */
function Breadcrumb({
  workspace,
  subject,
  title,
}: {
  workspace: string;
  subject: SubjectInfo | undefined;
  title: string | undefined;
}) {
  if (!title)
    return (
      <span className="truncate font-medium text-foreground">{workspace}</span>
    );
  return (
    <nav
      aria-label="Current document"
      className="flex min-w-0 items-center gap-1.5"
    >
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
