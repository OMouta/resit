import { ListTreeIcon, PanelRightCloseIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { cn } from "@resit/ui/lib/utils";
import { Composer, type ComposerProps } from "@resit/ui/patterns/ai/composer";
import {
  ContextInspector,
  type ContextInspectorProps,
} from "@resit/ui/patterns/ai/context-inspector";
import { EditPreview } from "@resit/ui/patterns/ai/edit-preview";
import { AssistantMessage, UserMessage } from "@resit/ui/patterns/ai/message";
import {
  ProviderModelSelect,
  type ProviderModelSelectProps,
} from "@resit/ui/patterns/ai/provider-select";
import {
  ScopeChipList,
  type ScopeChipListProps,
} from "@resit/ui/patterns/ai/scope-chips";
import {
  TurnStatusBar,
  type PanelStatus,
} from "@resit/ui/patterns/ai/turn-status";
import type { Citation, Turn } from "@resit/ui/patterns/ai/types";

export interface AiPanelProps {
  title?: string;
  provider: ProviderModelSelectProps;
  scope: ScopeChipListProps;
  turns: Turn[];
  status: PanelStatus;
  composer: Omit<ComposerProps, "children">;
  context?: ContextInspectorProps | undefined;
  /** Rendered above the transcript, for example a scope mismatch notice. */
  notice?: ReactNode;
  onStop?: () => void;
  onRetry?: () => void;
  onResume?: (turnId: string) => void;
  onAcceptEdit?: (editId: string) => void;
  onRejectEdit?: (editId: string) => void;
  onOpenCitation?: (citation: Citation) => void;
  onInsert?: (text: string) => void;
  onCopy?: (text: string) => void;
  onNewConversation?: () => void;
  onCollapse?: () => void;
  onConnect?: () => void;
  emptyState?: ReactNode;
  className?: string;
}

/** The collapsible AI panel: header, scope, transcript, status bar, composer. */
export function AiPanel({
  title = "Conversation",
  provider,
  scope,
  turns,
  status,
  composer,
  context,
  notice,
  onStop,
  onRetry,
  onResume,
  onAcceptEdit,
  onRejectEdit,
  onOpenCitation,
  onInsert,
  onCopy,
  onNewConversation,
  onCollapse,
  onConnect,
  emptyState,
  className,
}: AiPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastTurn = turns.at(-1);
  const streamingText = lastTurn?.role === "assistant" ? lastTurn.text : "";

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [turns.length, streamingText]);

  const providerName =
    provider.providers.find((entry) => entry.id === provider.providerId)
      ?.name ?? "Assistant";

  return (
    <section
      data-slot="ai-panel"
      aria-label={title}
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground @container",
        className,
      )}
    >
      <header className="flex h-toolbar shrink-0 items-center gap-1 border-b px-2">
        <ProviderModelSelect {...provider} className="min-w-0 flex-1" />
        {context ? (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label="Context inspector"
                  >
                    <ListTreeIcon />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>What the turn included</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-80 p-2">
              <ContextInspector {...context} />
            </PopoverContent>
          </Popover>
        ) : null}
        {onNewConversation ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon"
                aria-label="New conversation"
                onClick={onNewConversation}
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New conversation</TooltipContent>
          </Tooltip>
        ) : null}
        {onCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon"
                aria-label="Collapse panel"
                onClick={onCollapse}
              >
                <PanelRightCloseIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse</TooltipContent>
          </Tooltip>
        ) : null}
      </header>
      <div className="shrink-0 border-b px-3 py-2">
        <ScopeChipList {...scope} />
      </div>
      {notice ? <div className="shrink-0 px-3 pt-3">{notice}</div> : null}
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
        <div className="flex flex-col gap-5 px-3 py-4">
          {turns.length === 0
            ? (emptyState ?? (
                <div className="flex flex-col items-center gap-1 py-12 text-center">
                  <p className="text-sm font-medium">
                    Ask about what you are reading
                  </p>
                  <p className="max-w-60 text-xs text-muted-foreground">
                    The conversation sees only what is in its scope. Attach a
                    page, a selection, or a note to be precise.
                  </p>
                </div>
              ))
            : null}
          {turns.map((turn) =>
            turn.role === "user" ? (
              <UserMessage
                key={turn.id}
                text={turn.text}
                attachments={turn.attachments}
                at={turn.at}
              />
            ) : (
              <AssistantMessage
                key={turn.id}
                status={turn.status}
                text={turn.text}
                providerName={providerName}
                tools={turn.tools}
                citations={turn.citations}
                error={turn.error}
                at={turn.at}
                {...(onStop ? { onStop } : {})}
                {...(onRetry ? { onRetry } : {})}
                {...(onResume ? { onResume: () => onResume(turn.id) } : {})}
                {...(onOpenCitation ? { onOpenCitation } : {})}
                {...(onInsert ? { onInsert } : {})}
                {...(onCopy ? { onCopy } : {})}
              >
                {turn.edit ? (
                  <EditPreview
                    edit={turn.edit}
                    {...(onAcceptEdit ? { onAccept: onAcceptEdit } : {})}
                    {...(onRejectEdit ? { onReject: onRejectEdit } : {})}
                  />
                ) : null}
              </AssistantMessage>
            ),
          )}
        </div>
      </ScrollArea>
      <TurnStatusBar
        status={status}
        className="shrink-0 border-t"
        {...(onStop ? { onStop } : {})}
        {...(onRetry ? { onRetry } : {})}
        {...(onConnect ? { onConnect } : {})}
      />
      <div className="shrink-0 px-3 pb-3">
        <Composer {...composer} />
      </div>
    </section>
  );
}
