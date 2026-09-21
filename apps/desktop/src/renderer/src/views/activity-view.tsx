import {
  ClipboardListIcon,
  ExternalLinkIcon,
  PaperclipIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";

import type { SubjectInfo } from "../../../shared/workspace";
import { ChatMarkdown } from "../chat/markdown";
import { api } from "../lib/api";
import {
  activityType,
  checkedLabel,
  dateLabel,
  isDeadline,
  useMoodleActivities,
} from "../lib/moodle-activities";
import { useNotices } from "../lib/notices";

/**
 * A Moodle activity's brief, dates, and attached files, as resit last read
 * them. Anything that changes the activity happens in Moodle.
 */
export function ActivityView({
  subject,
  moduleId,
  onOpenResource,
}: {
  subject: SubjectInfo | undefined;
  moduleId: number;
  onOpenResource: (resourceId: string) => void;
}) {
  const { t, dateTime, relative } = useLocale();
  const notices = useNotices();
  const records = useMoodleActivities();
  const [downloading, setDownloading] = useState<string | null>(null);

  const record = records?.find((entry) => entry.subjectId === subject?.id);
  const activity = record?.activities.find(
    (entry) => entry.moduleId === moduleId,
  );

  if (records === null)
    return (
      <div className="mx-auto flex w-full max-w-measure flex-col gap-3 px-8 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-row w-1/3" />
      </div>
    );
  if (!subject || !record || !activity)
    return (
      <EmptyState
        className="h-full"
        icon={<ClipboardListIcon />}
        title={t("This activity is no longer in the course")}
        description={t("Moodle did not list it the last time resit checked.")}
      />
    );

  const download = async (key: string) => {
    setDownloading(key);
    try {
      const result = await api.downloadMoodleItems({
        subjectId: subject.id,
        keys: [key],
      });
      const failure = result.failures[0];
      if (failure)
        notices.notify({
          tone: "error",
          title: t("{file} was not downloaded", { file: failure.filename }),
          detail: failure.message,
        });
    } catch (error) {
      notices.fail(t("The download stopped"), error);
    } finally {
      setDownloading(null);
    }
  };

  const now = Date.now();
  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-[calc(var(--document-measure)+4rem)] flex-col pb-24">
        <DocumentHeader
          title={activity.name}
          subject={{ name: subject.name, color: subject.color }}
          // Shown as the breadcrumb above the title.
          path={`${[t(activityType(activity.modname)), activity.sectionName].filter(Boolean).join("/")}/`}
        />
        <div className="flex flex-col gap-8 px-8">
          <div className="flex flex-col gap-4">
            {activity.dates.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                {activity.dates.map((entry) => {
                  const at = Date.parse(entry.at);
                  return (
                    <div key={`${entry.type}:${entry.at}`} className="contents">
                      <dt className="text-muted-foreground">
                        {t(dateLabel(entry))}
                      </dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          isDeadline(entry) && at > now && "font-medium",
                        )}
                      >
                        {dateTime(entry.at)}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {relative(entry.at)}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button
                variant="secondary"
                onClick={() =>
                  void api.openExternal(activity.url).catch(() => undefined)
                }
              >
                <ExternalLinkIcon /> {t("Open in Moodle")}
              </Button>
              <p className="text-xs text-subtle-foreground">
                {checkedLabel(record.checkedAt, { t, relative })}
              </p>
            </div>
          </div>

          {activity.attachments?.length ? (
            <section
              aria-label={t("Attached files")}
              className="flex flex-col gap-1"
            >
              {activity.attachments.map((attachment) => (
                <div
                  key={attachment.key}
                  className="-mx-2 flex h-control-lg items-center gap-2.5 rounded-md px-2 hover:bg-accent"
                >
                  <PaperclipIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={attachment.filename}
                  >
                    {attachment.filename}
                  </span>
                  {attachment.resourceId ? (
                    <Button
                      variant="subtle"
                      onClick={() => {
                        if (attachment.resourceId)
                          onOpenResource(attachment.resourceId);
                      }}
                    >
                      {t("Open")}
                    </Button>
                  ) : (
                    <Button
                      variant="subtle"
                      loading={downloading === attachment.key}
                      disabled={downloading !== null}
                      onClick={() => void download(attachment.key)}
                    >
                      {t("Download")}
                    </Button>
                  )}
                </div>
              ))}
            </section>
          ) : null}

          {activity.brief ? (
            <div className="document">
              <ChatMarkdown text={activity.brief} />
            </div>
          ) : null}
        </div>
      </div>
    </ScrollArea>
  );
}
