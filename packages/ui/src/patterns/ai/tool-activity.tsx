import {
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import type { ToolCall } from "@resit/ui/patterns/ai/types";

function ToolRow({ call }: { call: ToolCall }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const Icon =
    call.status === "running"
      ? Loader2Icon
      : call.status === "failed"
        ? XIcon
        : CheckIcon;
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        disabled={!call.detail}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent disabled:hover:bg-transparent"
      >
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            call.status === "running" && "animate-spin text-primary",
            call.status === "done" && "text-success",
            call.status === "failed" && "text-destructive",
          )}
          aria-label={
            call.status === "running"
              ? t("Running")
              : call.status === "failed"
                ? t("Failed")
                : t("Done")
          }
        />
        <span className="min-w-0 flex-1 truncate text-foreground/90">
          {call.summary}
        </span>
        <code className="hidden shrink-0 font-mono text-2xs text-subtle-foreground sm:inline">
          {call.name}
        </code>
        {call.durationMs !== undefined ? (
          <span className="shrink-0 tabular-nums text-subtle-foreground">
            {(call.durationMs / 1000).toFixed(1)}s
          </span>
        ) : null}
        {call.detail ? (
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-subtle-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        ) : null}
      </button>
      {open && call.detail ? (
        <p
          className={cn(
            "mx-2 mb-1 rounded-md bg-muted px-2 py-1.5 text-xs",
            call.status === "failed" && "text-destructive",
          )}
        >
          {call.detail}
        </p>
      ) : null}
    </li>
  );
}

/** Collapsible list of tool calls made during a turn. */
export function ToolActivity({
  calls,
  className,
}: {
  calls: ToolCall[];
  className?: string;
}) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  if (calls.length === 0) return null;
  const running = calls.some((call) => call.status === "running");
  const failed = calls.filter((call) => call.status === "failed").length;
  return (
    <div
      data-slot="tool-activity"
      className={cn("rounded-lg border bg-surface-raised/60", className)}
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <WrenchIcon className="size-3.5" />
        <span className="flex-1 text-left">
          {running
            ? t("Working…")
            : calls.length === 1
              ? t("1 tool call")
              : t("{count} tool calls", { count: calls.length })}
          {failed > 0 ? (
            <span className="text-destructive">
              {" · "}
              {t("{count} failed", { count: failed })}
            </span>
          ) : null}
        </span>
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform",
            !collapsed && "rotate-90",
          )}
        />
      </button>
      {!collapsed ? (
        <ul className="flex flex-col gap-px border-t px-1 py-1">
          {calls.map((call) => (
            <ToolRow key={call.id} call={call} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
