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

import type { ResourceInfo, SubjectInfo } from "../../../shared/workspace";
import { NoteView } from "../editor/note-view";
import { AttachmentView, ImageView } from "../views/file-views";
import { PdfView } from "../views/pdf-view";
import type { LayoutAction, Pane } from "./layout";

export interface PaneProps {
  pane: Pane;
  focused: boolean;
  canSplit: boolean;
  canClose: boolean;
  resources: ReadonlyMap<string, ResourceInfo>;
  subjects: ReadonlyMap<string, SubjectInfo>;
  dispatch: Dispatch<LayoutAction>;
  onRename: (resourceId: string, title: string) => Promise<void>;
}

function ResourceView({
  resource,
  subject,
  active,
  onRename,
}: {
  resource: ResourceInfo;
  subject: SubjectInfo | undefined;
  active: boolean;
  onRename: (title: string) => Promise<void>;
}) {
  switch (resource.kind) {
    case "note":
      return (
        <NoteView resource={resource} subject={subject} onRename={onRename} />
      );
    case "pdf":
      return <PdfView resource={resource} active={active} />;
    case "image":
      return <ImageView resource={resource} />;
    case "attachment":
      return <AttachmentView resource={resource} />;
  }
}

/** One pane: its tab strip and the open views. Inactive views stay mounted. */
export function WorkspacePane({
  pane,
  focused,
  canSplit,
  canClose,
  resources,
  subjects,
  dispatch,
  onRename,
}: PaneProps) {
  const items: DocumentTabItem[] = pane.tabs.map((tab) => {
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

  return (
    <section
      aria-label="Pane"
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
          <PaneEmpty description="Pick a note or document from the sidebar, or press Ctrl+K to find one." />
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
              {resource ? (
                <ResourceView
                  resource={resource}
                  subject={subjects.get(resource.subjectId)}
                  active={active}
                  onRename={(title) => onRename(resource.id, title)}
                />
              ) : (
                <EmptyState
                  className="h-full"
                  icon={<FileQuestionIcon />}
                  title={`${tab.title} is no longer in the workspace`}
                  description="It was moved to the trash or deleted outside resit. Close this tab to continue."
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
