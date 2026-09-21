import {
  ChevronRightIcon,
  EyeOffIcon,
  PackageCheckIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";

import { Progress } from "@resit/ui/components/progress";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export interface ContextSection {
  kind: string;
  items: string[];
}

export interface ContextInspectorProps {
  included: ContextSection[];
  retrieved: { title: string; detail: string; via: string }[];
  excluded: { title: string; reason: string }[];
  tokens: { prompt: number; retrieved: number; budget: number };
  className?: string;
}

function Group({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof SearchIcon;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        <Icon className="size-3.5" />
        {title}
        <span className="ml-auto tabular-nums">{count}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-1 pb-2 pl-7">{children}</div>
      ) : null}
    </section>
  );
}

/** What a turn included, what the agent retrieved afterwards, and what was left out. */
export function ContextInspector({
  included,
  retrieved,
  excluded,
  tokens,
  className,
}: ContextInspectorProps) {
  const { number, percent, t } = useLocale();
  const used = tokens.prompt + tokens.retrieved;
  return (
    <div
      data-slot="context-inspector"
      className={cn("flex flex-col gap-1 text-sm", className)}
    >
      <div className="flex flex-col gap-1.5 px-2 pb-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{t("Context budget")}</span>
          <span className="tabular-nums text-muted-foreground">
            {t("{used} / {budget} tokens", {
              used: number(used),
              budget: number(tokens.budget),
            })}{" "}
            · {percent(used / tokens.budget)}
          </span>
        </div>
        <Progress
          value={(used / tokens.budget) * 100}
          aria-label={t("Context budget used")}
        />
        <p className="text-2xs text-subtle-foreground">
          {t("Prompt {prompt} · retrieved {retrieved}", {
            prompt: number(tokens.prompt),
            retrieved: number(tokens.retrieved),
          })}
        </p>
      </div>
      <Group
        title={t("Included in the prompt")}
        icon={PackageCheckIcon}
        count={included.reduce((sum, section) => sum + section.items.length, 0)}
      >
        {included.map((section) => (
          <div key={section.kind} className="flex flex-col gap-0.5">
            <p className="text-2xs font-medium tracking-wide text-subtle-foreground uppercase">
              {section.kind}
            </p>
            {section.items.map((item) => (
              <p key={item} className="text-xs text-foreground/90">
                {item}
              </p>
            ))}
          </div>
        ))}
      </Group>
      <Group
        title={t("Retrieved during the turn")}
        icon={SearchIcon}
        count={retrieved.length}
      >
        {retrieved.map((item) => (
          <p key={item.title} className="text-xs">
            <span className="text-foreground/90">{item.title}</span>
            <span className="text-muted-foreground">
              {" "}
              · {item.detail} ·{" "}
              <code className="font-mono text-2xs">{item.via}</code>
            </span>
          </p>
        ))}
      </Group>
      <Group
        title={t("Left out")}
        icon={EyeOffIcon}
        count={excluded.length}
        defaultOpen={false}
      >
        {excluded.map((item) => (
          <p key={item.title} className="text-xs">
            <span className="text-foreground/80">{item.title}</span>
            <span className="text-muted-foreground"> · {item.reason}</span>
          </p>
        ))}
      </Group>
    </div>
  );
}
