import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import { ScopeChip } from "@resit/ui/patterns/ai/scope-chips";
import { ToolActivity } from "@resit/ui/patterns/ai/tool-activity";
import type {
  Citation,
  ScopeItem,
  ToolCall,
  TurnError,
  TurnStatus,
} from "@resit/ui/patterns/ai/types";
import { MathText } from "@resit/ui/patterns/document/math";

export function UserMessage({
  text,
  attachments,
  at,
  className,
}: {
  text: string;
  attachments?: ScopeItem[] | undefined;
  at: string | Date;
  className?: string;
}) {
  const { time } = useLocale();
  return (
    <article
      data-slot="user-message"
      aria-label="Your message"
      className={cn("flex flex-col items-end gap-1.5", className)}
    >
      {attachments && attachments.length > 0 ? (
        <ul className="flex max-w-[85%] flex-wrap justify-end gap-1">
          {attachments.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <ScopeChip item={item} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-selection px-3.5 py-2 text-base">
        <MathText paragraphClassName="my-0">{text}</MathText>
      </div>
      <time className="text-2xs text-subtle-foreground">{time(at)}</time>
    </article>
  );
}

/** Inline numbered citation marker. */
export function CitationMarker({
  index,
  citation,
  onOpen,
}: {
  index: number;
  citation: Citation;
  onOpen?: (citation: Citation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(citation)}
      aria-label={`Citation ${index}: ${citation.label}`}
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-info-soft px-1 align-text-top text-2xs font-medium text-link hover:underline"
    >
      {index}
    </button>
  );
}

export function CitationList({
  citations,
  onOpen,
}: {
  citations: Citation[];
  onOpen?: (citation: Citation) => void;
}) {
  if (citations.length === 0) return null;
  return (
    <ol aria-label="Sources" className="flex flex-col gap-1 border-t pt-2">
      {citations.map((citation, index) => (
        <li key={citation.id} className="flex items-center gap-2 text-xs">
          <span className="flex h-4 min-w-4 items-center justify-center rounded-sm bg-info-soft px-1 text-2xs font-medium text-link">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onOpen?.(citation)}
            className={cn(
              "flex min-w-0 items-center gap-1 truncate text-left hover:underline",
              citation.missing
                ? "text-muted-foreground line-through decoration-warning/70"
                : "text-foreground",
            )}
          >
            <FileTextIcon className="size-3 shrink-0 text-subtle-foreground" />
            <span className="truncate">{citation.label}</span>
            {citation.page !== undefined ? (
              <span className="shrink-0 text-muted-foreground">
                p. {citation.page}
              </span>
            ) : null}
          </button>
          {citation.missing ? (
            <span className="shrink-0 text-warning">not found</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function TurnErrorCard({
  error,
  onRetry,
  onDiagnostics,
  className,
}: {
  error: TurnError;
  onRetry?: () => void;
  onDiagnostics?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm",
        className,
      )}
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-medium">{error.title}</p>
        <p className="text-muted-foreground">{error.detail}</p>
        <div className="flex gap-2">
          {error.retryable && onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RefreshCwIcon /> Retry
            </Button>
          ) : null}
          {onDiagnostics ? (
            <Button size="sm" variant="subtle" onClick={onDiagnostics}>
              Show diagnostics
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Writing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}

export interface AssistantMessageProps {
  status: TurnStatus;
  text: string;
  providerName?: string;
  tools?: ToolCall[] | undefined;
  citations?: Citation[] | undefined;
  error?: TurnError | undefined;
  at: string | Date;
  /** Edit preview or approval card rendered after the body. */
  children?: ReactNode;
  onStop?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onDiagnostics?: () => void;
  onCopy?: (text: string) => void;
  onInsert?: (text: string) => void;
  onRegenerate?: () => void;
  onOpenCitation?: (citation: Citation) => void;
  className?: string;
}

/** One assistant turn: tool activity, body, sources, and status footer. */
export function AssistantMessage({
  status,
  text,
  providerName = "Assistant",
  tools,
  citations,
  error,
  at,
  children,
  onStop,
  onResume,
  onRetry,
  onDiagnostics,
  onCopy,
  onInsert,
  onRegenerate,
  onOpenCitation,
  className,
}: AssistantMessageProps) {
  const { time } = useLocale();
  const [copied, setCopied] = useState(false);
  return (
    <article
      data-slot="assistant-message"
      data-status={status}
      aria-label={`${providerName} message`}
      aria-busy={status === "streaming"}
      className={cn("group/message flex gap-2.5", className)}
    >
      <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md bg-linear-to-b from-primary-top to-primary-bottom text-white shadow-primary">
        <SparklesIcon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {tools && tools.length > 0 ? <ToolActivity calls={tools} /> : null}
        {text ? (
          <div className="document max-w-none text-base [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
            <MathText>{text}</MathText>
            {status === "streaming" ? (
              <span
                className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle"
                aria-hidden
              />
            ) : null}
          </div>
        ) : status === "streaming" ? (
          <div className="flex h-6 items-center text-sm text-muted-foreground">
            <TypingDots />
          </div>
        ) : null}
        {status === "stopped" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <SquareIcon className="size-3" /> Stopped by you
            {onResume ? (
              <Button size="sm" variant="subtle" onClick={onResume}>
                <PlayIcon /> Resume
              </Button>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <TurnErrorCard
            error={error}
            {...(onRetry ? { onRetry } : {})}
            {...(onDiagnostics ? { onDiagnostics } : {})}
          />
        ) : null}
        {children}
        {citations && citations.length > 0 && status !== "streaming" ? (
          <CitationList
            citations={citations}
            {...(onOpenCitation ? { onOpen: onOpenCitation } : {})}
          />
        ) : null}
        <footer className="flex h-6 items-center gap-1 text-2xs text-subtle-foreground">
          {status === "streaming" ? (
            <>
              <span className="text-muted-foreground">Writing…</span>
              {onStop ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-2"
                  onClick={onStop}
                >
                  <SquareIcon className="size-3 fill-current" /> Stop
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <span>{providerName}</span>
              <span>·</span>
              <time>{time(at)}</time>
              {status === "awaiting-review" ? (
                <span className="ml-1 text-link">· Awaiting your review</span>
              ) : null}
              <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
                {onCopy && text ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="subtle"
                        size="icon-sm"
                        aria-label="Copy message"
                        onClick={() => {
                          onCopy(text);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1200);
                        }}
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                ) : null}
                {onInsert && text ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="subtle"
                        size="icon-sm"
                        aria-label="Insert into note"
                        onClick={() => onInsert(text)}
                      >
                        <FileTextIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert into note</TooltipContent>
                  </Tooltip>
                ) : null}
                {onRegenerate ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="subtle"
                        size="icon-sm"
                        aria-label="Regenerate"
                        onClick={onRegenerate}
                      >
                        <RefreshCwIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regenerate</TooltipContent>
                  </Tooltip>
                ) : null}
              </span>
            </>
          )}
        </footer>
      </div>
    </article>
  );
}
