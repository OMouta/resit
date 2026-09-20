import {
  GraduationCapIcon,
  SparklesIcon,
  SunMoonIcon,
  type LucideIcon,
} from "lucide-react";
import { useRef, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { useRovingFocus } from "@resit/ui/hooks/use-roving-focus";
import { cn } from "@resit/ui/lib/utils";

export const SETTINGS_TOPICS = [
  { id: "appearance", label: "Appearance", icon: SunMoonIcon },
  { id: "providers", label: "AI providers", icon: SparklesIcon },
  { id: "moodle", label: "Moodle", icon: GraduationCapIcon },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

export type SettingsTopic = (typeof SETTINGS_TOPICS)[number]["id"];

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Machine settings. Nothing here is written into the workspace. */
export function SettingsDialog({
  open,
  onOpenChange,
  topic,
  onTopicChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: SettingsTopic;
  onTopicChange: (topic: SettingsTopic) => void;
  /** The open topic's settings. */
  children?: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useRovingFocus(list, {
    itemSelector: "[role=tab]",
    loop: true,
  });
  const current =
    SETTINGS_TOPICS.find((entry) => entry.id === topic) ?? SETTINGS_TOPICS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(38rem,85vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-56 shrink-0 flex-col border-r bg-sidebar p-2">
            <DialogHeader className="gap-0.5 px-2 pt-1.5 pb-2.5 text-left">
              <DialogTitle className="text-sm font-semibold">
                Settings
              </DialogTitle>
              <DialogDescription className="text-xs">
                These apply to this computer only.
              </DialogDescription>
            </DialogHeader>
            <div
              ref={list}
              role="tablist"
              aria-label="Settings"
              aria-orientation="vertical"
              onKeyDown={onKeyDown}
              className="flex flex-col gap-px"
            >
              {SETTINGS_TOPICS.map((entry) => {
                const active = entry.id === current.id;
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    id={`settings-tab-${entry.id}`}
                    aria-selected={active}
                    aria-controls={`settings-panel-${entry.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => onTopicChange(entry.id)}
                    onFocus={() => onTopicChange(entry.id)}
                    className={cn(
                      "flex h-row items-center gap-2 rounded-md px-2 text-left text-sm outline-none",
                      "hover:bg-accent focus-visible:shadow-focus",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-foreground/85",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-subtle-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {entry.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-toolbar shrink-0 items-center border-b px-5">
              <h2 className="text-sm font-medium">{current.label}</h2>
            </header>
            <ScrollArea className="min-h-0 flex-1">
              <div
                role="tabpanel"
                id={`settings-panel-${current.id}`}
                aria-labelledby={`settings-tab-${current.id}`}
                className="flex flex-col gap-5 p-5"
              >
                {children}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
