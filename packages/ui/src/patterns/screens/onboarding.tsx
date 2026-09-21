import {
  ArchiveIcon,
  ArrowRightIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { ResitMark } from "@resit/ui/components/resit-mark";
import { useLocale } from "@resit/ui/hooks/use-locale";
import {
  SUBJECT_COLORS,
  subjectColorClasses,
  subjectColorLabels,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export interface RecentWorkspace {
  id: string;
  name: string;
  path: string;
}

export interface OnboardingProps {
  recent: RecentWorkspace[];
  onCreate: () => void;
  onOpenFolder: () => void;
  /** Archive opening is unavailable until the import path exists. */
  archiveAvailable?: boolean;
  onOpenArchive?: () => void;
  onOpenRecent: (id: string) => void;
  className?: string;
}

function Choice({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
  note,
}: {
  icon: typeof FolderPlusIcon;
  title: string;
  description: string;
  onClick?: (() => void) | undefined;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col gap-3 rounded-panel border bg-control p-5 text-left shadow-control transition-[background-color,box-shadow,transform] duration-(--duration-fast) hover:bg-control-hover hover:shadow-md focus-visible:shadow-focus focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-control",
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-linear-to-b from-primary-top to-primary-bottom text-white shadow-primary group-disabled:from-muted group-disabled:to-muted group-disabled:text-muted-foreground group-disabled:shadow-none">
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
        {note ? <span className="text-xs text-warning">{note}</span> : null}
      </span>
    </button>
  );
}

/** First-launch screen: create, open, or restore a workspace. */
export function Onboarding({
  recent,
  onCreate,
  onOpenFolder,
  archiveAvailable = false,
  onOpenArchive,
  onOpenRecent,
  className,
}: OnboardingProps) {
  const { t } = useLocale();
  return (
    <div
      data-slot="onboarding"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-auto bg-canvas @container",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12 @2xl:py-20">
        <header className="flex flex-col gap-3">
          <ResitMark className="size-12" />
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            {t("Open your study workspace")}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {t("Keep your notes and PDFs in a folder on your computer.")}
          </p>
        </header>
        <div className="grid gap-3 @lg:grid-cols-3">
          <Choice
            icon={FolderPlusIcon}
            title={t("Create workspace")}
            description={t("Choose a folder and add your first subject.")}
            onClick={onCreate}
          />
          <Choice
            icon={FolderOpenIcon}
            title={t("Open folder")}
            description={t("Open an existing workspace.")}
            onClick={onOpenFolder}
          />
          <Choice
            icon={ArchiveIcon}
            title={t("Open .resit archive")}
            description={t(
              "Restore a workspace exported from another computer.",
            )}
            onClick={onOpenArchive}
            disabled={!archiveAvailable}
            {...(!archiveAvailable ? { note: t("Not available yet.") } : {})}
          />
        </div>
        {recent.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {t("Recent")}
            </h2>
            <ul className="overflow-hidden rounded-lg border bg-background">
              {recent.map((workspace) => (
                <li key={workspace.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenRecent(workspace.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {workspace.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {workspace.path}
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 text-subtle-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <SparklesIcon className="size-3.5" />{" "}
          {t("For AI chat, connect a provider in Settings.")}
        </p>
      </div>
    </div>
  );
}

export interface CreateWorkspaceStepProps {
  onBack: () => void;
  onFinish: (values: {
    name: string;
    folder: string;
    subject: { name: string; color: SubjectColor };
  }) => void;
  /** Opens a folder picker. A returned path fills the folder field. */
  onChooseFolder?: () => Promise<string | null> | void;
  defaultFolder?: string;
  className?: string;
}

/** Second step: name, folder, and the first subject. */
export function CreateWorkspaceStep({
  onBack,
  onFinish,
  onChooseFolder,
  defaultFolder = "",
  className,
}: CreateWorkspaceStepProps) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(defaultFolder);
  const [subject, setSubject] = useState("");
  const [color, setColor] = useState<SubjectColor>("blue");
  const valid = name.trim() && folder.trim() && subject.trim();
  return (
    <div
      data-slot="create-workspace"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-auto bg-canvas @container",
        className,
      )}
    >
      <form
        className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-12 @2xl:py-20"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid)
            onFinish({
              name: name.trim(),
              folder: folder.trim(),
              subject: { name: subject.trim(), color },
            });
        }}
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {t("Create a workspace")}
          </h1>
        </header>
        <div className="flex flex-col gap-5 rounded-panel border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">{t("Workspace name")}</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("Studies 2026/27")}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-folder">{t("Folder")}</Label>
            <div className="flex gap-2">
              <Input
                id="ws-folder"
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="D:/Studies 2026-27"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const chosen = await onChooseFolder?.();
                  if (chosen) setFolder(chosen);
                }}
              >
                <FolderOpenIcon /> {t("Choose…")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Your notes and imported files will be saved here.")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-subject">{t("First subject")}</Label>
            <Input
              id="ws-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("Mathematics")}
            />
            <div
              role="radiogroup"
              aria-label={t("Subject colour")}
              className="mt-1 flex flex-wrap gap-1.5"
            >
              {SUBJECT_COLORS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  role="radio"
                  aria-checked={color === entry}
                  aria-label={t(subjectColorLabels[entry])}
                  onClick={() => setColor(entry)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    subjectColorClasses[entry].softBg,
                    color === entry &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-background",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full",
                      subjectColorClasses[entry].dot,
                    )}
                  />
                </button>
              ))}
              <span className="ml-1 self-center text-xs text-muted-foreground">
                {t(subjectColorLabels[color])}
              </span>
            </div>
          </div>
        </div>
        <footer className="flex justify-between">
          <Button type="button" variant="subtle" onClick={onBack}>
            {t("Back")}
          </Button>
          <Button type="submit" disabled={!valid}>
            {t("Create and open")} <ArrowRightIcon />
          </Button>
        </footer>
      </form>
    </div>
  );
}
