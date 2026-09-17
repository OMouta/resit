import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Kbd } from "@resit/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { shortcutLabel } from "@resit/ui/lib/keys";
import { cn } from "@resit/ui/lib/utils";

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  onAttach?: () => void;
  /** A turn is in progress: Send becomes Stop. */
  busy?: boolean;
  /** Why sending is unavailable, for example "Connect a provider to send". */
  disabledReason?: string | undefined;
  placeholder?: string;
  /** Scope summary or attachment chips rendered above the field. */
  children?: ReactNode;
  defaultValue?: string;
  className?: string;
}

/** Message field with attach, send, and stop. Enter sends; Shift+Enter adds a line. */
export function Composer({
  onSend,
  onStop,
  onAttach,
  busy = false,
  disabledReason,
  placeholder = "Ask about what you are studying…",
  children,
  defaultValue = "",
  className,
}: ComposerProps) {
  const [value, setValue] = useState(defaultValue);
  const disabled = Boolean(disabledReason);
  const canSend = !disabled && !busy && value.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
    if (event.key === "Escape" && busy) onStop?.();
  };

  return (
    <div
      data-slot="composer"
      className={cn(
        "flex flex-col gap-2 rounded-panel border border-control-border bg-control p-2 shadow-control transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        disabled && "opacity-80",
        className,
      )}
    >
      {children ? <div className="px-1 pt-1">{children}</div> : null}
      <textarea
        aria-label="Message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabledReason ?? placeholder}
        disabled={disabled}
        rows={1}
        className="field-sizing-content max-h-48 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed"
      />
      <div className="flex items-center gap-1">
        {onAttach ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon"
                aria-label="Attach resource, selection, or region"
                onClick={onAttach}
                disabled={disabled}
              >
                <PaperclipIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach</TooltipContent>
          </Tooltip>
        ) : null}
        <span className="ml-auto hidden items-center gap-1 text-2xs text-subtle-foreground sm:flex">
          {shortcutLabel("Shift+Enter").map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
          new line
        </span>
        {busy ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onStop}
            aria-label="Stop the current turn"
            className="gap-1.5"
          >
            <SquareIcon className="size-3 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUpIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
