import {
  ExternalLinkIcon,
  GraduationCapIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import {
  courseUrl,
  type MoodleAnnouncement,
  type MoodleCourseSection,
  type SubjectActivities,
} from "../../../shared/moodle";
import type { SubjectInfo } from "../../../shared/workspace";
import { ChatMarkdown } from "../chat/markdown";
import { api } from "../lib/api";
import {
  activityType,
  checkedLabel,
  dateLabel,
  gradeLabel,
  hasPage,
  isLabel,
  openInBrowser,
  submissionLabel,
  useMoodleActivities,
} from "../lib/moodle-activities";
import { useNotices } from "../lib/notices";

type Activity = SubjectActivities["activities"][number];

/** Sections for a record saved before resit kept them: runs of one name. */
function sectionsOf(record: SubjectActivities): MoodleCourseSection[] {
  if (record.sections) return record.sections;
  const sections: MoodleCourseSection[] = [];
  for (const activity of record.activities) {
    const last = sections.at(-1);
    if (last?.name === activity.sectionName)
      last.moduleIds.push(activity.moduleId);
    else
      sections.push({
        name: activity.sectionName,
        moduleIds: [activity.moduleId],
      });
  }
  return sections;
}

/**
 * A followed course's page as resit last read it: each section's text, the
 * labels between activities, and the activities themselves.
 */
export function CourseView({
  subject,
  onOpenActivity,
  onOpenMoodle,
}: {
  subject: SubjectInfo | undefined;
  onOpenActivity: (subjectId: string, activity: Activity) => void;
  /** The dialog that downloads the course's files. */
  onOpenMoodle: (subjectId: string) => void;
}) {
  const { t, relative } = useLocale();
  const notices = useNotices();
  const records = useMoodleActivities();
  const [checking, setChecking] = useState(false);

  const record = records?.find((entry) => entry.subjectId === subject?.id);

  if (records === null)
    return (
      <div className="mx-auto flex w-full max-w-measure flex-col gap-3 px-8 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-row w-1/3" />
      </div>
    );
  if (!subject?.moodle || !record)
    return (
      <EmptyState
        className="h-full"
        icon={<GraduationCapIcon />}
        title={t("No course page saved")}
        description={
          subject?.moodle
            ? t("resit has not read this course from Moodle yet.")
            : t("This subject does not follow a Moodle course.")
        }
      />
    );

  const link = subject.moodle;
  const byId = new Map(
    record.activities.map((activity) => [activity.moduleId, activity]),
  );
  const check = async () => {
    setChecking(true);
    try {
      const failures = await api.refreshMoodleActivities();
      const failure = failures.find((entry) => entry.subjectId === subject.id);
      if (failure)
        notices.notify({
          tone: "error",
          title: t("{names} could not be checked.", { names: subject.name }),
          detail: failure.message,
        });
    } catch (error) {
      notices.fail(t("Moodle could not be checked"), error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-[calc(var(--document-measure)+4rem)] flex-col pb-24">
        <DocumentHeader
          title={link.fullname}
          subject={{ name: subject.name, color: subject.color }}
          path="Moodle/"
        />
        <div className="flex flex-col gap-10 px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              variant="secondary"
              onClick={() =>
                void api.openExternal(courseUrl(link)).catch(() => undefined)
              }
            >
              <ExternalLinkIcon /> {t("Open in Moodle")}
            </Button>
            <Button variant="subtle" onClick={() => onOpenMoodle(subject.id)}>
              {t("Course files…")}
            </Button>
            {record.grade ? (
              <p className="text-sm tabular-nums">
                {t("Course grade {grade}", {
                  grade: gradeLabel(record.grade),
                })}
              </p>
            ) : null}
            <p className="text-xs text-subtle-foreground" aria-live="polite">
              {checking
                ? t("Checking Moodle…")
                : checkedLabel(record.checkedAt, { t, relative })}
            </p>
            <ToolbarButton
              label={t("Check Moodle again")}
              disabled={checking}
              onClick={() => void check()}
            >
              <RefreshCwIcon className={cn(checking && "animate-spin")} />
            </ToolbarButton>
          </div>

          {record.announcements?.length ? (
            <Announcements posts={record.announcements} />
          ) : null}

          {sectionsOf(record).map((section, index) => {
            const items = section.moduleIds.flatMap((id) => {
              const activity = byId.get(id);
              return activity ? [activity] : [];
            });
            if (!section.summary && items.length === 0) return null;
            return (
              <section
                key={index}
                aria-label={section.name || t("General")}
                className="flex flex-col gap-3"
              >
                <h2 className="text-xl font-semibold tracking-[-0.01em]">
                  {section.name || t("General")}
                </h2>
                {section.summary ? <Text markdown={section.summary} /> : null}
                {items.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {items.map((activity) =>
                      isLabel(activity) ? (
                        <Text
                          key={activity.moduleId}
                          markdown={activity.brief}
                          className="my-2"
                        />
                      ) : (
                        <ActivityRow
                          key={activity.moduleId}
                          activity={activity}
                          onOpen={() =>
                            hasPage(activity)
                              ? onOpenActivity(subject.id, activity)
                              : openInBrowser(activity)
                          }
                        />
                      ),
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

/** The newest few posts, with the rest a click away. */
function Announcements({ posts }: { posts: MoodleAnnouncement[] }) {
  const { t, relative, dateTime, number } = useLocale();
  const [all, setAll] = useState(false);
  const shown = all ? posts : posts.slice(0, 3);
  return (
    <section aria-label={t("Announcements")} className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-[-0.01em]">
        {t("Announcements")}
      </h2>
      <div className="flex flex-col divide-y rounded-lg border">
        {shown.map((post) => (
          <article key={post.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline gap-3">
              <h3 className="min-w-0 flex-1 text-sm font-semibold">
                {post.subject}
              </h3>
              <time
                dateTime={post.postedAt}
                title={dateTime(post.postedAt)}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {relative(post.postedAt)}
              </time>
            </div>
            <p className="text-xs text-muted-foreground">{post.author}</p>
            <div className="mt-1 text-sm">
              <ChatMarkdown text={post.message} />
            </div>
          </article>
        ))}
      </div>
      {posts.length > 3 ? (
        <Button
          variant="subtle"
          className="self-start"
          onClick={() => setAll((value) => !value)}
        >
          {all
            ? t("Show fewer")
            : t("Show all {count}", { count: number(posts.length) })}
        </Button>
      ) : null}
    </section>
  );
}

function Text({
  markdown,
  className,
}: {
  markdown: string | undefined;
  className?: string;
}): ReactNode {
  if (!markdown) return null;
  return (
    <div className={cn("document", className)}>
      <ChatMarkdown text={markdown} />
    </div>
  );
}

function hostOf(address: string): string | null {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function ActivityRow({
  activity,
  onOpen,
}: {
  activity: Activity;
  onOpen: () => void;
}) {
  const { t, dateTime } = useLocale();
  const next = activity.dates.find(
    (entry) => Date.parse(entry.at) >= Date.now(),
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium" title={activity.name}>
          {activity.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {[
            t(activityType(activity.modname)),
            activity.link ? hostOf(activity.link) : null,
            next ? `${t(dateLabel(next))} ${dateTime(next.at)}` : null,
            submissionLabel(activity)
              ? t(submissionLabel(activity) ?? "")
              : null,
            activity.grade
              ? t("Grade {grade}", { grade: gradeLabel(activity.grade) })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {hasPage(activity) ? null : (
        <ExternalLinkIcon
          aria-label={
            activity.link ? t("Opens in your browser") : t("Opens in Moodle")
          }
          className="size-4 shrink-0 text-subtle-foreground"
        />
      )}
    </button>
  );
}
