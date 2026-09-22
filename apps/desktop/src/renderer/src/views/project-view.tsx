import {
  ClipboardListIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderKanbanIcon,
  ImageIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { useLocale } from "@resit/ui/hooks/use-locale";

import { localInstant } from "../../../shared/planning";
import type {
  ProjectInfo,
  ResourceKind,
  SubjectInfo,
  WorkspaceSnapshot,
} from "../../../shared/workspace";
import {
  isDeadline,
  isSubmitted,
  submissionLabel,
  useMoodleActivities,
} from "../lib/moodle-activities";

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

/** One subject goes straight through; several ask which. */
function SubjectPicker({
  subjects,
  label,
  menuLabel,
  icon,
  onPick,
}: {
  subjects: SubjectInfo[];
  label: string;
  menuLabel: string;
  icon: React.ReactNode;
  onPick: (subjectId: string) => void;
}) {
  const [only] = subjects;
  if (!only) return null;
  if (subjects.length === 1)
    return (
      <Button variant="outline" onClick={() => onPick(only.id)}>
        {icon} {label}
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {icon} {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        {subjects.map((subject) => (
          <DropdownMenuItem
            key={subject.id}
            onSelect={() => onPick(subject.id)}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                subjectColorClasses[subject.color].dot,
              )}
            />
            {subject.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What a project holds, and a way to ask about all of it. */
export function ProjectView({
  project,
  snapshot,
  onOpenResource,
  onRevealSubject,
  onAsk,
  onNewNote,
  onImport,
  onOpenActivity,
  onEdit,
  onDelete,
}: {
  project: ProjectInfo | undefined;
  snapshot: WorkspaceSnapshot;
  onOpenResource: (resourceId: string) => void;
  onRevealSubject: (subjectId: string) => void;
  onAsk: () => void;
  onNewNote: (subjectId: string) => void;
  onImport: (subjectId: string) => void;
  onOpenActivity: (
    subjectId: string,
    activity: { moduleId: number; name: string },
  ) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, dateTime, date, relative } = useLocale();
  const records = useMoodleActivities();
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
  // Where a new file can go: the project's subjects, or those of its files.
  const homes = snapshot.subjects.filter((subject) =>
    subjects.length > 0
      ? project.subjectIds.includes(subject.id)
      : files.length > 0
        ? files.some((resource) => resource.subjectId === subject.id)
        : !subject.archived,
  );
  const linked = project.activity
    ? records
        ?.find((record) => record.subjectId === project.activity?.subjectId)
        ?.activities.find(
          (entry) => entry.moduleId === project.activity?.moduleId,
        )
    : undefined;
  const moodleDue = linked?.dates.find(isDeadline);
  const due = moodleDue
    ? { at: moodleDue.at, label: dateTime(moodleDue.at) }
    : project.due
      ? {
          at: localInstant(
            project.due.date,
            project.due.time ?? "23:59",
          ).toISOString(),
          label: project.due.time
            ? dateTime(localInstant(project.due.date, project.due.time))
            : date(localInstant(project.due.date, "12:00")),
        }
      : null;
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
            {due ? (
              <p className="text-sm">
                <span className="font-medium">
                  {t("Due {date}", { date: due.label })}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {relative(due.at)}
                </span>
              </p>
            ) : null}
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
            <SubjectPicker
              subjects={homes}
              label={t("New note")}
              menuLabel={t("New note in")}
              icon={<FilePlusIcon />}
              onPick={onNewNote}
            />
            <SubjectPicker
              subjects={homes}
              label={t("Import files…")}
              menuLabel={t("Import into")}
              icon={<UploadIcon />}
              onPick={onImport}
            />
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

        {project.activity && linked ? (
          <section
            className="flex flex-col gap-2"
            aria-label={t("Moodle assignment")}
          >
            <SectionTitle>{t("Moodle assignment")}</SectionTitle>
            <button
              type="button"
              onClick={() =>
                project.activity &&
                onOpenActivity(project.activity.subjectId, linked)
              }
              className="flex min-h-row w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
            >
              <ClipboardListIcon className="size-4 shrink-0 text-subtle-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {linked.name}
              </span>
              {submissionLabel(linked) ? (
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    isSubmitted(linked) ? "text-success" : "text-warning",
                  )}
                >
                  {t(submissionLabel(linked) ?? "")}
                </span>
              ) : null}
            </button>
          </section>
        ) : null}

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
