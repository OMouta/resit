import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Checkbox } from "@resit/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Input } from "@resit/ui/components/input";
import { Progress } from "@resit/ui/components/progress";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { cn } from "@resit/ui/lib/utils";

import type {
  MoodleConnection,
  MoodleCourse,
  MoodleCourseContents,
  MoodleItem,
} from "../../../shared/moodle";
import type { SubjectInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";
import { useNotices } from "../lib/notices";

type View =
  | { kind: "loading" }
  | { kind: "courses"; courses: MoodleCourse[] }
  | { kind: "contents"; contents: MoodleCourseContents }
  | { kind: "error"; message: string };

/** New files need no label: they are the ones ticked and waiting. */
const STATE_LABEL: Record<MoodleItem["state"], string> = {
  new: "",
  updated: "Updated",
  current: "In workspace",
};

function describeSkipped(contents: MoodleCourseContents): string | null {
  const parts = contents.skipped.map((entry) => {
    if (entry.reason === "unsupported")
      return `${entry.count} ${entry.count === 1 ? "activity" : "activities"} resit does not download (${entry.detail})`;
    if (entry.reason === "external")
      return `${entry.count} ${entry.count === 1 ? "file" : "files"} stored on another site`;
    return `${entry.count} ${entry.count === 1 ? "file" : "files"} too large to download`;
  });
  return parts.length > 0 ? `Left out: ${parts.join(", ")}.` : null;
}

/** Follows a Moodle course from a subject, and downloads its files. */
export function MoodleDialog({
  subject,
  connection,
  onOpenChange,
  onOpenSettings,
}: {
  /** The subject the dialog is open for. `null` keeps it closed. */
  subject: SubjectInfo | null;
  connection: MoodleConnection;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  const notices = useNotices();
  const { number } = useLocale();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<{
    filename: string;
    done: number;
    total: number;
  } | null>(null);

  const subjectId = subject?.id ?? null;
  const courseId = subject?.moodle?.courseId ?? null;
  const connected = connection.status === "connected";

  const load = useCallback(async () => {
    if (!subjectId || !connected) return;
    setView({ kind: "loading" });
    try {
      if (courseId === null) {
        setView({ kind: "courses", courses: await api.listMoodleCourses() });
        return;
      }
      const contents = await api.listMoodleItems(subjectId);
      setSelected(
        new Set(
          contents.items
            .filter((item) => item.state !== "current")
            .map((item) => item.key),
        ),
      );
      setView({ kind: "contents", contents });
    } catch (error) {
      setView({ kind: "error", message: errorMessage(error) });
    }
  }, [subjectId, courseId, connected]);

  useEffect(() => {
    setQuery("");
    setProgress(null);
    void load();
  }, [load]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "moodle-progress" && event.subjectId === subjectId)
          setProgress({
            filename: event.filename,
            done: event.done,
            total: event.total,
          });
      }),
    [subjectId],
  );

  const follow = async (course: number) => {
    if (!subjectId) return;
    setView({ kind: "loading" });
    try {
      await api.setMoodleCourse({ subjectId, courseId: course });
    } catch (error) {
      notices.fail("The course was not linked", error);
      setView({ kind: "error", message: errorMessage(error) });
    }
  };

  const download = async () => {
    if (!subjectId || selected.size === 0) return;
    setProgress({ filename: "", done: 0, total: selected.size });
    try {
      const result = await api.downloadMoodleItems({
        subjectId,
        keys: [...selected],
      });
      const saved = result.added + result.replaced;
      notices.notify({
        tone: result.failures.length > 0 ? "error" : "success",
        title:
          saved === 0
            ? "Nothing was downloaded"
            : `${number(saved)} ${saved === 1 ? "file" : "files"} in ${subject?.name ?? "the subject"}`,
        ...(result.failures.length > 0
          ? {
              detail: `${result.failures[0]?.filename}: ${result.failures[0]?.message}`,
            }
          : {}),
      });
      await load();
    } catch (error) {
      notices.fail("The download stopped", error);
    } finally {
      setProgress(null);
    }
  };

  const grouped = useMemo(() => {
    if (view.kind !== "contents") return [];
    const sections = new Map<string, { name: string; items: MoodleItem[] }>();
    for (const item of view.contents.items) {
      const group = sections.get(item.section);
      if (group) group.items.push(item);
      else
        sections.set(item.section, {
          name: item.sectionName || "Course files",
          items: [item],
        });
    }
    return [...sections.entries()];
  }, [view]);

  const waiting =
    view.kind === "contents"
      ? view.contents.items.filter((item) => item.state !== "current")
      : [];
  const updated = waiting.filter((item) => item.state === "updated").length;

  return (
    <Dialog
      open={subject !== null}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="gap-1">
          <DialogTitle className="truncate pr-6" title={subject?.name}>
            {subject?.name ?? "Moodle"}
          </DialogTitle>
          <DialogDescription
            className="truncate"
            title={subject?.moodle?.fullname}
          >
            {subject?.moodle?.fullname ??
              "Choose the Moodle course this subject follows."}
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              Connect your Moodle account to follow a course.
            </p>
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenSettings();
              }}
            >
              Open settings
            </Button>
          </div>
        ) : view.kind === "loading" ? (
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : view.kind === "error" ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-destructive">{view.message}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : view.kind === "courses" ? (
          <CourseList
            courses={view.courses}
            query={query}
            onQueryChange={setQuery}
            onFollow={(course) => void follow(course)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex h-control items-center gap-3 border-b pb-3">
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {waiting.length === 0
                  ? "Everything in this course is already here."
                  : [
                      waiting.length - updated > 0
                        ? `${number(waiting.length - updated)} new`
                        : null,
                      updated > 0 ? `${number(updated)} updated` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
              {waiting.length > 0 ? (
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() =>
                    setSelected(
                      selected.size > 0
                        ? new Set()
                        : new Set(waiting.map((item) => item.key)),
                    )
                  }
                >
                  {selected.size > 0 ? "Select none" : "Select all"}
                </Button>
              ) : null}
            </div>

            <ScrollArea className="-mx-2 max-h-[50vh] px-2">
              <div className="flex flex-col gap-4">
                {grouped.map(([section, group]) => (
                  <section key={section || "root"} className="flex flex-col">
                    <h3
                      className="truncate px-1 pb-1 text-xs font-medium text-subtle-foreground"
                      title={group.name}
                    >
                      {group.name}
                    </h3>
                    <ul className="flex flex-col">
                      {group.items.map((item) => {
                        const here = item.state === "current";
                        const disabled = here || progress !== null;
                        return (
                          <li key={item.key}>
                            <label
                              className={cn(
                                "flex h-row items-center gap-2.5 rounded-md px-1",
                                disabled
                                  ? "cursor-default"
                                  : "cursor-pointer hover:bg-accent",
                                here && "text-muted-foreground",
                              )}
                            >
                              <Checkbox
                                checked={selected.has(item.key)}
                                disabled={disabled}
                                onCheckedChange={(checked) =>
                                  setSelected((current) => {
                                    const next = new Set(current);
                                    if (checked) next.add(item.key);
                                    else next.delete(item.key);
                                    return next;
                                  })
                                }
                              />
                              <span
                                className="min-w-0 flex-1 truncate text-sm"
                                title={item.filename}
                              >
                                {item.name}
                              </span>
                              <span
                                className={cn(
                                  "w-24 shrink-0 text-right text-xs",
                                  item.state === "updated"
                                    ? "text-warning"
                                    : "text-subtle-foreground",
                                )}
                              >
                                {STATE_LABEL[item.state]}
                              </span>
                              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-subtle-foreground">
                                {formatBytes(item.filesize, number)}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                {view.contents.items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    This course has no files resit can download.
                  </p>
                ) : null}
              </div>
            </ScrollArea>

            {describeSkipped(view.contents) ? (
              <p className="text-xs text-subtle-foreground">
                {describeSkipped(view.contents)}
              </p>
            ) : null}

            {progress ? (
              <div className="flex flex-col gap-1.5">
                <Progress
                  value={(progress.done / Math.max(progress.total, 1)) * 100}
                  aria-label="Downloading from Moodle"
                />
                <p
                  className="truncate text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {progress.filename
                    ? `${progress.filename} · ${number(progress.done)} of ${number(progress.total)}`
                    : "Starting…"}
                </p>
              </div>
            ) : null}

            <DialogFooter className="sm:justify-between">
              <Button
                variant="subtle"
                disabled={progress !== null}
                onClick={() => void follow(0)}
              >
                Stop following
              </Button>
              <Button
                disabled={selected.size === 0 || progress !== null}
                onClick={() => void download()}
              >
                {progress !== null
                  ? "Downloading…"
                  : `Download ${number(selected.size)}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CourseList({
  courses,
  query,
  onQueryChange,
  onFollow,
}: {
  courses: MoodleCourse[];
  query: string;
  onQueryChange: (value: string) => void;
  onFollow: (courseId: number) => void;
}) {
  const term = query.trim().toLowerCase();
  const shown = term
    ? courses.filter((course) =>
        `${course.fullname} ${course.shortname}`.toLowerCase().includes(term),
      )
    : courses;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input
          value={query}
          autoFocus
          placeholder="Search your courses"
          className="pl-8"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <ScrollArea className="-mx-2 max-h-[50vh] px-2">
        <ul className="flex flex-col">
          {shown.map((course) => (
            <li
              key={course.id}
              className="flex h-row items-center gap-3 rounded-md px-1 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" title={course.fullname}>
                  {course.fullname}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-subtle-foreground">
                {course.shortname}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onFollow(course.id)}
              >
                Follow
              </Button>
            </li>
          ))}
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {courses.length === 0
                ? "Moodle lists no courses for your account."
                : "No course matches that."}
            </p>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
}
