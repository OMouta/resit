import {
  FileTextIcon,
  FolderKanbanIcon,
  ImageIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type {
  ProjectInfo,
  ResourceKind,
  WorkspaceSnapshot,
} from "../../../shared/workspace";

const icons: Record<ResourceKind, typeof FileTextIcon> = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
      {children}
    </h2>
  );
}

/** What a project holds, and a way to ask about all of it. */
export function ProjectView({
  project,
  snapshot,
  onOpenResource,
  onRevealSubject,
  onAsk,
  onEdit,
  onDelete,
}: {
  project: ProjectInfo | undefined;
  snapshot: WorkspaceSnapshot;
  onOpenResource: (resourceId: string) => void;
  onRevealSubject: (subjectId: string) => void;
  onAsk: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  if (!project)
    return (
      <EmptyState
        className="h-full"
        icon={<FolderKanbanIcon />}
        title={t("This project is no longer in the workspace")}
        description={t("It was moved to the trash or deleted outside resit.")}
      />
    );
  const subjects = snapshot.subjects.filter((subject) =>
    project.subjectIds.includes(subject.id),
  );
  const files = snapshot.resources.filter((resource) =>
    project.resourceIds.includes(resource.id),
  );
  const names = new Map(
    snapshot.subjects.map((subject) => [subject.id, subject.name]),
  );
  const counts = new Map<string, number>();
  for (const resource of snapshot.resources)
    counts.set(resource.subjectId, (counts.get(resource.subjectId) ?? 0) + 1);

  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-8 pt-12 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-[-0.025em]">
              {project.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "A conversation about this project reads these subjects and files.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onAsk}>
              <MessageSquareIcon /> {t("Ask about this project")}
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <PencilIcon /> {t("Edit")}
            </Button>
            <Button
              variant="subtle"
              size="icon"
              aria-label={t("Delete project")}
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          </div>
        </header>

        {subjects.length === 0 && files.length === 0 ? (
          <EmptyState
            icon={<FolderKanbanIcon />}
            title={t("Nothing in this project yet")}
            description={t("Choose the subjects and files it covers.")}
            actions={
              <Button variant="outline" onClick={onEdit}>
                {t("Choose subjects and files")}
              </Button>
            }
          />
        ) : null}

        {subjects.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={t("Subjects")}>
            <SectionTitle>Subjects · {subjects.length}</SectionTitle>
            <ul className="flex flex-col">
              {subjects.map((subject) => (
                <li key={subject.id}>
                  <button
                    type="button"
                    onClick={() => onRevealSubject(subject.id)}
                    className="flex h-row w-full items-center gap-2.5 rounded-control px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        subjectColorClasses[subject.color].dot,
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {subject.name}
                    </span>
                    <span className="text-xs tabular-nums text-subtle-foreground">
                      {counts.get(subject.id) ?? 0}{" "}
                      {counts.get(subject.id) === 1 ? "file" : "files"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {files.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={t("Files")}>
            <SectionTitle>Files · {files.length}</SectionTitle>
            <ul className="flex flex-col">
              {files.map((resource) => {
                const Icon = icons[resource.kind];
                return (
                  <li key={resource.id}>
                    <button
                      type="button"
                      onClick={() => onOpenResource(resource.id)}
                      className="flex h-row w-full items-center gap-2.5 rounded-control px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <Icon className="size-4 shrink-0 text-subtle-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {resource.title}
                      </span>
                      <span className="text-xs text-subtle-foreground">
                        {names.get(resource.subjectId) ?? ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
