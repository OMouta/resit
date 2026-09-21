import { PencilIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Skeleton } from "@resit/ui/components/skeleton";
import { Switch } from "@resit/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { Textarea } from "@resit/ui/components/textarea";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";
import { EvidenceRow } from "@resit/ui/patterns/study/evidence-row";
import { LevelChip } from "@resit/ui/patterns/study/level-chip";
import { ProfileProposal } from "@resit/ui/patterns/study/profile-proposal";

import {
  topicKey,
  type Detail,
  type Topic,
  type TopicEvidence,
  type TopicLevel,
} from "../../../shared/learner";
import type { SubjectInfo, WorkspaceSnapshot } from "../../../shared/workspace";
import { api } from "../lib/api";
import { evidenceLine, useLearner } from "../lib/learner";
import { useNotices } from "../lib/notices";
import { SettingRow } from "../settings/settings-dialog";

const NO_SUBJECT = "none";
const LEVEL_LABELS: Record<TopicLevel, string> = {
  gap: msg("Gap"),
  developing: msg("Developing"),
  secure: msg("Secure"),
};

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-control items-center justify-between gap-2">
      <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

interface TopicRequest {
  topic?: Topic;
  initial?: { name: string; subjectId?: string };
}

/** How the student likes to learn and how well they know each topic. */
export function ProfileView({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const { t } = useLocale();
  const notices = useNotices();
  const { profile, error } = useLearner();
  const [topicRequest, setTopicRequest] = useState<TopicRequest | null>(null);
  const [about, setAbout] = useState("");
  const [goals, setGoals] = useState("");

  const subjects = useMemo(
    () => new Map(snapshot.subjects.map((subject) => [subject.id, subject])),
    [snapshot.subjects],
  );
  const preferences = profile?.file.preferences;
  useEffect(() => {
    setAbout(preferences?.about ?? "");
    setGoals(preferences?.goals ?? "");
  }, [preferences?.about, preferences?.goals]);

  if (error && !profile)
    return (
      <EmptyState
        className="h-full"
        icon={<UserRoundIcon />}
        title={t("The profile could not be read")}
        description={error}
      />
    );
  if (!profile || !preferences)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8 pt-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-row w-96" />
      </div>
    );

  const { file, evidence } = profile;
  const evidenceFor = (name: string, subjectId: string | undefined) =>
    evidence.find(
      (entry) =>
        topicKey(entry.topic, entry.subjectId) === topicKey(name, subjectId),
    );
  const waiting = file.proposals.filter(
    (proposal) => proposal.status === "proposed",
  );
  const known = new Set(
    file.topics.map((topic) => topicKey(topic.name, topic.subjectId)),
  );
  const unlisted = evidence.filter(
    (entry) => !known.has(topicKey(entry.topic, entry.subjectId)),
  );

  const save = async (patch: Parameters<typeof api.updatePreferences>[0]) => {
    try {
      await api.updatePreferences(patch);
    } catch (reason) {
      notices.fail(t("The preference was not saved"), reason);
    }
  };

  const subjectName = (id: string | undefined) =>
    id ? (subjects.get(id)?.name ?? t("Deleted subject")) : t("No subject");

  return (
    <>
      <ScrollArea className="h-full bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-8 pt-12 pb-24">
          <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-64 flex-1 flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-[-0.025em]">
                {t("Learner profile")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {file.personalization
                  ? t(
                      "The assistant reads what you accept here, for the subjects in each conversation.",
                    )
                  : t(
                      "The assistant reads nothing from here and cannot suggest changes.",
                    )}
              </p>
            </div>
            <label className="flex h-control items-center gap-2 text-sm">
              {t("Share with the assistant")}
              <Switch
                checked={file.personalization}
                onCheckedChange={(checked) =>
                  void api
                    .setPersonalization(checked)
                    .catch((reason: unknown) =>
                      notices.fail(t("The setting was not saved"), reason),
                    )
                }
              />
            </label>
          </header>

          {waiting.length > 0 ? (
            <section
              aria-label={t("Suggestions")}
              className="flex flex-col gap-3"
            >
              <SectionTitle>
                {t("Waiting for you · {count}", { count: waiting.length })}
              </SectionTitle>
              {waiting.map((proposal) => {
                const current = proposal.topicId
                  ? file.topics.find((topic) => topic.id === proposal.topicId)
                  : undefined;
                const found = evidenceFor(proposal.name, proposal.subjectId);
                const line = evidenceLine(found, t);
                return (
                  <ProfileProposal
                    key={proposal.id}
                    id={proposal.id}
                    conceptName={proposal.name}
                    subjectName={subjectName(proposal.subjectId)}
                    change={proposal.reason}
                    from={current?.level ?? "unknown"}
                    to={proposal.level}
                    evidenceCount={line ? 1 : 0}
                    status="proposed"
                    proposedAt={proposal.createdAt}
                    onAccept={(id, level) =>
                      void api
                        .resolveTopicProposal({
                          id,
                          accept: true,
                          ...(level !== "unknown" ? { level } : {}),
                        })
                        .catch((reason: unknown) =>
                          notices.fail(
                            t("The suggestion was not accepted"),
                            reason,
                          ),
                        )
                    }
                    onReject={(id) =>
                      void api
                        .resolveTopicProposal({ id, accept: false })
                        .catch((reason: unknown) =>
                          notices.fail(
                            t("The suggestion was not rejected"),
                            reason,
                          ),
                        )
                    }
                  >
                    {line && found ? (
                      <EvidenceRow
                        kind={found.answered > 0 ? "quiz" : "flashcard"}
                        outcome="observed"
                        summary={line}
                        sourceTitle={t("Your practice in the last 30 days")}
                        at={found.lastAt ?? proposal.createdAt}
                      />
                    ) : null}
                  </ProfileProposal>
                );
              })}
            </section>
          ) : null}

          <section
            aria-label={t("Preferences")}
            className="flex flex-col gap-4"
          >
            <SectionTitle>{t("How you like to learn")}</SectionTitle>
            <div className="flex flex-col gap-4 px-2">
              <SettingRow label={t("Explanations")}>
                <Tabs
                  value={preferences.detail}
                  onValueChange={(value) =>
                    void save({ detail: value as Detail })
                  }
                >
                  <TabsList aria-label={t("Explanations")}>
                    <TabsTrigger value="brief">{t("Brief")}</TabsTrigger>
                    <TabsTrigger value="standard">{t("Standard")}</TabsTrigger>
                    <TabsTrigger value="thorough">{t("Thorough")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </SettingRow>
              <SettingRow
                label={t("Hints before solutions")}
                description={t("Asking for the solution still gets it.")}
                htmlFor="hints-first"
              >
                <Switch
                  id="hints-first"
                  checked={preferences.hintsFirst}
                  onCheckedChange={(checked) =>
                    void save({ hintsFirst: checked })
                  }
                />
              </SettingRow>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-about">{t("About you")}</Label>
                <Textarea
                  id="profile-about"
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  onBlur={() => {
                    if (about.trim() !== (preferences.about ?? ""))
                      void save({ about });
                  }}
                  placeholder={t(
                    "First year of Electrical Engineering. Resitting Calculus I.",
                  )}
                  className="min-h-16"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-goals">{t("Goals")}</Label>
                <Textarea
                  id="profile-goals"
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                  onBlur={() => {
                    if (goals.trim() !== (preferences.goals ?? ""))
                      void save({ goals });
                  }}
                  placeholder={t(
                    "Pass the resit in January with time to spare.",
                  )}
                  className="min-h-16"
                />
              </div>
            </div>
          </section>

          <section aria-label={t("Topics")} className="flex flex-col gap-1">
            <SectionTitle
              action={
                <Button variant="subtle" onClick={() => setTopicRequest({})}>
                  <PlusIcon /> {t("Add topic")}
                </Button>
              }
            >
              Topics · {file.topics.length}
            </SectionTitle>
            {file.topics.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                {t("Add the topics you find hard or know well.")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {[...file.topics]
                  .sort(
                    (a, b) =>
                      subjectName(a.subjectId).localeCompare(
                        subjectName(b.subjectId),
                      ) || a.name.localeCompare(b.name),
                  )
                  .map((topic) => (
                    <TopicRow
                      key={topic.id}
                      name={topic.name}
                      subject={
                        topic.subjectId
                          ? subjects.get(topic.subjectId)
                          : undefined
                      }
                      level={topic.level}
                      evidence={evidenceFor(topic.name, topic.subjectId)}
                      note={topic.note}
                      onEdit={() => setTopicRequest({ topic })}
                      onDelete={() =>
                        void api
                          .deleteTopic(topic.id)
                          .catch((reason: unknown) =>
                            notices.fail(
                              t("The topic was not removed"),
                              reason,
                            ),
                          )
                      }
                    />
                  ))}
              </ul>
            )}
          </section>

          {unlisted.length > 0 ? (
            <section
              aria-label={t("From your practice")}
              className="flex flex-col gap-1"
            >
              <SectionTitle>{t("From your practice")}</SectionTitle>
              <ul className="flex flex-col">
                {unlisted.map((entry) => (
                  <TopicRow
                    key={`${entry.subjectId}/${entry.topic}`}
                    name={entry.topic}
                    subject={subjects.get(entry.subjectId)}
                    evidence={entry}
                    onAdd={() =>
                      setTopicRequest({
                        initial: {
                          name: entry.topic,
                          subjectId: entry.subjectId,
                        },
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </ScrollArea>
      <TopicDialog
        request={topicRequest}
        subjects={snapshot.subjects.filter((subject) => !subject.archived)}
        onClose={() => setTopicRequest(null)}
      />
    </>
  );
}

function TopicRow({
  name,
  subject,
  level,
  evidence,
  note,
  onEdit,
  onDelete,
  onAdd,
}: {
  name: string;
  subject: SubjectInfo | undefined;
  level?: TopicLevel;
  evidence: TopicEvidence | undefined;
  note?: string | undefined;
  onEdit?: () => void;
  onDelete?: () => void;
  onAdd?: () => void;
}) {
  const { t, relative } = useLocale();
  const line = evidenceLine(evidence, t);
  return (
    <li className="group/topic flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          subject
            ? subjectColorClasses[subject.color].dot
            : "bg-muted-foreground",
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {[
            subject?.name,
            line || (level ? t("No practice on it lately") : null),
            evidence?.lastAt ? relative(evidence.lastAt) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {note ? (
          <span className="truncate text-xs text-subtle-foreground">
            {note}
          </span>
        ) : null}
      </span>
      {level ? <LevelChip level={level} /> : null}
      {onAdd ? (
        <Button variant="secondary" onClick={onAdd}>
          <PlusIcon /> {t("Add")}
        </Button>
      ) : null}
      {onEdit || onDelete ? (
        <span className="flex items-center opacity-0 group-focus-within/topic:opacity-100 group-hover/topic:opacity-100">
          {onEdit ? (
            <ToolbarButton label={t("Edit {name}", { name })} onClick={onEdit}>
              <PencilIcon />
            </ToolbarButton>
          ) : null}
          {onDelete ? (
            <ToolbarButton
              label={t("Remove {name}", { name })}
              onClick={onDelete}
            >
              <Trash2Icon />
            </ToolbarButton>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

function TopicDialog({
  request,
  subjects,
  onClose,
}: {
  request: TopicRequest | null;
  subjects: SubjectInfo[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState(NO_SUBJECT);
  const [level, setLevel] = useState<TopicLevel>("gap");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const existing = request?.topic;

  useEffect(() => {
    if (!request) return;
    setName(request.topic?.name ?? request.initial?.name ?? "");
    setSubjectId(
      request.topic?.subjectId ??
        request.initial?.subjectId ??
        subjects[0]?.id ??
        NO_SUBJECT,
    );
    setLevel(request.topic?.level ?? "gap");
    setNote(request.topic?.note ?? "");
    // Only when the dialog opens.
  }, [request]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.saveTopic({
        ...(existing ? { id: existing.id } : {}),
        name: name.trim(),
        ...(subjectId !== NO_SUBJECT ? { subjectId } : {}),
        level,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onClose();
    } catch (reason) {
      notices.fail(t("The topic was not saved"), reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {existing ? t("Edit topic") : t("Add a topic")}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic-name">{t("Topic")}</Label>
              <Input
                id="topic-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("Limits")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic-subject">{t("Subject")}</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="topic-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_SUBJECT}>{t("No subject")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t("How well you know it")}
              </span>
              <Tabs
                value={level}
                onValueChange={(value) => setLevel(value as TopicLevel)}
              >
                <TabsList aria-label={t("How well you know it")}>
                  {(Object.keys(LEVEL_LABELS) as TopicLevel[]).map((entry) => (
                    <TabsTrigger key={entry} value={entry}>
                      {t(LEVEL_LABELS[entry])}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic-note">{t("Note")}</Label>
              <Textarea
                id="topic-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("I mix up the squeeze theorem and L'Hôpital.")}
                className="min-h-14"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {existing ? t("Save") : t("Add topic")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
