import { FileQuestionIcon } from "lucide-react";
import type { Dispatch } from "react";

import { EmptyState } from "@resit/ui/components/empty-state";
import {
  DocumentTabs,
  tabsNeedingSubject,
  type DocumentTabItem,
} from "@resit/ui/patterns/navigation/document-tabs";
import {
  PaneEmpty,
  PaneHeader,
} from "@resit/ui/patterns/navigation/pane-header";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type { MoodleConnection } from "../../../shared/moodle";
import {
  extensionOf,
  isMediaFile,
  isOfficeFile,
  isTextFile,
  type ResourceInfo,
  type SubjectInfo,
  type WorkspaceSnapshot,
} from "../../../shared/workspace";
import { NoteView } from "../editor/note-view";
import type { CardRequest } from "../practice/card-dialog";
import type { QuizEditorRequest } from "../practice/quiz-editor";
import { ActivityView } from "../views/activity-view";
import { CourseView } from "../views/course-view";
import { AttachmentView, ImageView, MediaView } from "../views/file-views";
import { NotebookView } from "../views/notebook-view";
import { OfficeView } from "../views/office-view";
import { TextView } from "../views/text-view";
import { GraphView } from "../views/graph-view";
import { PdfView } from "../views/pdf-view";
import { PracticeView } from "../views/practice-view";
import { ProfileView } from "../views/profile-view";
import { ProjectView } from "../views/project-view";
import { QuizView } from "../views/quiz-view";
import { ScheduleView } from "../views/schedule-view";
import { requestReview, type DocumentTarget } from "../views/view-registry";
import {
  activityTabId,
  courseTabId,
  GRAPH_TAB_ID,
  parseActivityTabId,
  parseCourseTabId,
  parseQuizTabId,
  PRACTICE_TAB_ID,
  parseProjectTabId,
  PROFILE_TAB_ID,
  projectTabId,
  quizTabId,
  SCHEDULE_TAB_ID,
  type LayoutAction,
  type Pane,
  type Tab,
} from "./layout";

export interface PaneProps {
  pane: Pane;
  snapshot: WorkspaceSnapshot;
  focused: boolean;
  canSplit: boolean;
  canClose: boolean;
  resources: ReadonlyMap<string, ResourceInfo>;
  subjects: ReadonlyMap<string, SubjectInfo>;
  moodle: MoodleConnection;
  dispatch: Dispatch<LayoutAction>;
  onRename: (resourceId: string, title: string) => Promise<void>;
  onOpenLink: (resourceId: string, target: DocumentTarget) => void;
  onCite: (markdown: string) => void;
  onOpenSettings: () => void;
  /** The dialog that follows a Moodle course and downloads its files. */
  onOpenMoodle: (subjectId: string) => void;
  /** Opens a file, at a PDF page when one is given. */
  onOpenResource: (resourceId: string, page?: number) => void;
  onEditCard: (request: CardRequest) => void;
  onEditQuiz: (request: QuizEditorRequest) => void;
  /** What a project's tab can do. */
  projectActions: {
    ask: (projectId: string) => void;
    edit: (projectId: string) => void;
    remove: (projectId: string) => void;
    revealSubject: (subjectId: string) => void;
    /** Files made here go into the subject and join the project. */
    newNote: (projectId: string, subjectId: string) => void;
    importFiles: (projectId: string, subjectId: string) => void;
  };
}

function ResourceView({
  resource,
  subject,
  active,
  onRename,
  onOpenLink,
  onCite,
}: {
  resource: ResourceInfo;
  subject: SubjectInfo | undefined;
  active: boolean;
  onRename: (title: string) => Promise<void>;
  onOpenLink: (resourceId: string, target: DocumentTarget) => void;
  onCite: (markdown: string) => void;
}) {
  switch (resource.kind) {
    case "note":
      return (
        <NoteView
          resource={resource}
          subject={subject}
          onRename={onRename}
          onOpenLink={onOpenLink}
        />
      );
    case "pdf":
      return <PdfView resource={resource} active={active} onCite={onCite} />;
    case "image":
      return <ImageView resource={resource} />;
    case "attachment":
      return isTextFile(resource.path) ? (
        <TextView resource={resource} />
      ) : isMediaFile(resource.path) ? (
        <MediaView resource={resource} />
      ) : isOfficeFile(resource.path) ? (
        <OfficeView resource={resource} />
      ) : extensionOf(resource.path) === ".ipynb" ? (
        <NotebookView resource={resource} />
      ) : (
        <AttachmentView resource={resource} />
      );
  }
}

/** One pane: its tab strip and the open views. Inactive views stay mounted. */
export function WorkspacePane({
  pane,
  snapshot,
  focused,
  canSplit,
  canClose,
  resources,
  subjects,
  moodle,
  dispatch,
  onRename,
  onOpenLink,
  onCite,
  onOpenSettings,
  onOpenMoodle,
  onOpenResource,
  onEditCard,
  onEditQuiz,
  projectActions,
}: PaneProps) {
  const { t } = useLocale();
  const openResource = (resourceId: string) => {
    const target = resources.get(resourceId);
    if (target) dispatch({ type: "open", resourceId, title: target.title });
  };
  const openActivity = (
    subjectId: string,
    activity: { moduleId: number; name: string },
  ) =>
    dispatch({
      type: "open",
      resourceId: activityTabId(subjectId, activity.moduleId),
      title: activity.name,
    });

  const items: DocumentTabItem[] = pane.tabs.map((tab) => {
    if (tab.resourceId === GRAPH_TAB_ID)
      return { id: tab.id, title: t("Graph"), kind: "graph" };
    if (tab.resourceId === SCHEDULE_TAB_ID)
      return { id: tab.id, title: t("Schedule"), kind: "schedule" };
    if (tab.resourceId === PRACTICE_TAB_ID)
      return { id: tab.id, title: t("Practice"), kind: "practice" };
    if (tab.resourceId === PROFILE_TAB_ID)
      return { id: tab.id, title: t("Learner profile"), kind: "profile" };
    const projectId = parseProjectTabId(tab.resourceId);
    if (projectId)
      return {
        id: tab.id,
        title:
          snapshot.projects.find((project) => project.id === projectId)
            ?.title ?? tab.title,
        kind: "project",
      };
    const quiz = parseQuizTabId(tab.resourceId);
    if (quiz) {
      const subject = subjects.get(quiz.subjectId);
      return {
        id: tab.id,
        title: tab.title,
        kind: "quiz",
        ...(subject
          ? { subject: { name: subject.name, color: subject.color } }
          : {}),
      };
    }
    const course = parseCourseTabId(tab.resourceId);
    const activity = parseActivityTabId(tab.resourceId);
    if (course ?? activity) {
      const subject = subjects.get(course ?? activity?.subjectId ?? "");
      return {
        id: tab.id,
        title: tab.title,
        kind: "activity",
        ...(subject
          ? { subject: { name: subject.name, color: subject.color } }
          : {}),
      };
    }
    const resource = resources.get(tab.resourceId);
    const subject = resource ? subjects.get(resource.subjectId) : undefined;
    return {
      id: tab.id,
      title: resource?.title ?? tab.title,
      kind: resource?.kind ?? "note",
      ...(subject
        ? { subject: { name: subject.name, color: subject.color } }
        : {}),
      ...(resource ? {} : { missing: true }),
    };
  });
  const collisions = tabsNeedingSubject(items);

  const tabContent = (
    tab: Tab,
    resource: ResourceInfo | undefined,
    active: boolean,
  ) => {
    if (tab.resourceId === GRAPH_TAB_ID)
      return <GraphView snapshot={snapshot} onOpenResource={openResource} />;
    if (tab.resourceId === SCHEDULE_TAB_ID)
      return (
        <ScheduleView
          snapshot={snapshot}
          moodle={moodle}
          active={active}
          onOpenActivity={openActivity}
          onOpenProject={(projectId) =>
            dispatch({
              type: "open",
              resourceId: projectTabId(projectId),
              title:
                snapshot.projects.find((project) => project.id === projectId)
                  ?.title ?? t("Project"),
            })
          }
          onOpenCourse={(subjectId) =>
            dispatch({
              type: "open",
              resourceId: courseTabId(subjectId),
              title: subjects.get(subjectId)?.moodle?.fullname ?? t("Course"),
            })
          }
          onOpenSettings={onOpenSettings}
          onOpenResource={onOpenResource}
          onOpenQuiz={(subjectId, quiz) =>
            dispatch({
              type: "open",
              resourceId: quizTabId(subjectId, quiz.id),
              title: quiz.title,
            })
          }
          onReview={(subjectId) => {
            dispatch({
              type: "open",
              resourceId: PRACTICE_TAB_ID,
              title: t("Practice"),
            });
            requestReview({ subjectId });
          }}
        />
      );
    if (tab.resourceId === PRACTICE_TAB_ID)
      return (
        <PracticeView
          snapshot={snapshot}
          active={active}
          onOpenQuiz={(subjectId, quiz) =>
            dispatch({
              type: "open",
              resourceId: quizTabId(subjectId, quiz.id),
              title: quiz.title,
            })
          }
          onOpenSource={onOpenResource}
          onEditCard={onEditCard}
          onNewQuiz={(subjectId) => onEditQuiz(subjectId ? { subjectId } : {})}
        />
      );
    if (tab.resourceId === PROFILE_TAB_ID)
      return <ProfileView snapshot={snapshot} />;
    const projectId = parseProjectTabId(tab.resourceId);
    if (projectId)
      return (
        <ProjectView
          project={snapshot.projects.find(
            (project) => project.id === projectId,
          )}
          snapshot={snapshot}
          onOpenResource={openResource}
          onRevealSubject={projectActions.revealSubject}
          onAsk={() => projectActions.ask(projectId)}
          onNewNote={(subjectId) =>
            projectActions.newNote(projectId, subjectId)
          }
          onImport={(subjectId) =>
            projectActions.importFiles(projectId, subjectId)
          }
          onOpenActivity={openActivity}
          onEdit={() => projectActions.edit(projectId)}
          onDelete={() => projectActions.remove(projectId)}
        />
      );
    const quiz = parseQuizTabId(tab.resourceId);
    if (quiz)
      return (
        <QuizView
          subject={subjects.get(quiz.subjectId)}
          subjectId={quiz.subjectId}
          quizId={quiz.quizId}
          onEdit={(file) =>
            onEditQuiz({ quiz: file, subjectId: quiz.subjectId })
          }
          onDeleted={() =>
            dispatch({ type: "close-resource", resourceId: tab.resourceId })
          }
        />
      );
    const course = parseCourseTabId(tab.resourceId);
    if (course)
      return (
        <CourseView
          subject={subjects.get(course)}
          onOpenActivity={openActivity}
          onOpenResource={openResource}
          onOpenMoodle={onOpenMoodle}
        />
      );
    const activity = parseActivityTabId(tab.resourceId);
    if (activity)
      return (
        <ActivityView
          subject={subjects.get(activity.subjectId)}
          moduleId={activity.moduleId}
          onOpenResource={openResource}
        />
      );
    if (resource)
      return (
        <ResourceView
          resource={resource}
          subject={subjects.get(resource.subjectId)}
          active={active}
          onRename={(title) => onRename(resource.id, title)}
          onOpenLink={onOpenLink}
          onCite={onCite}
        />
      );
    return (
      <EmptyState
        className="h-full"
        icon={<FileQuestionIcon />}
        title={t("{title} is no longer in the workspace", {
          title: tab.title,
        })}
        description={t("It was moved to the trash or deleted outside resit.")}
      />
    );
  };

  return (
    <section
      aria-label={t("Pane")}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      onPointerDownCapture={() => dispatch({ type: "focus", paneId: pane.id })}
      onFocusCapture={() => dispatch({ type: "focus", paneId: pane.id })}
    >
      <PaneHeader
        focused={focused && canClose}
        {...(canSplit
          ? {
              onSplitHorizontal: () =>
                dispatch({ type: "split", paneId: pane.id }),
            }
          : {})}
        {...(canClose
          ? { onClose: () => dispatch({ type: "close-pane", paneId: pane.id }) }
          : {})}
      >
        <DocumentTabs
          className="min-w-0 flex-1 border-b-0"
          tabs={items.map((item) => ({
            ...item,
            showSubject: collisions.has(item.id),
          }))}
          activeId={pane.activeTabId ?? undefined}
          onActivate={(tabId) =>
            dispatch({ type: "activate", paneId: pane.id, tabId })
          }
          onClose={(tabId) =>
            dispatch({ type: "close", paneId: pane.id, tabId })
          }
          onReorder={(from, to) =>
            dispatch({ type: "reorder", paneId: pane.id, from, to })
          }
          onDragOut={(tabId) =>
            dispatch({ type: "move-to-other-pane", paneId: pane.id, tabId })
          }
        />
      </PaneHeader>
      <div className="relative min-h-0 flex-1 bg-background">
        {pane.tabs.length === 0 ? (
          <PaneEmpty
            description={t(
              "Pick a note or document from the sidebar, or press Ctrl+K to find one.",
            )}
          />
        ) : null}
        {pane.tabs.map((tab) => {
          const resource = resources.get(tab.resourceId);
          const active = tab.id === pane.activeTabId;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              aria-label={resource?.title ?? tab.title}
              hidden={!active}
              className="absolute inset-0 flex flex-col"
            >
              {tabContent(tab, resource, active)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
