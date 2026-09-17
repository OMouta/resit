import { CheckIcon, CopyIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import { cn } from "@resit/ui/lib/utils";

/** Monospace diagnostics block. Belongs in diagnostics views, not the transcript. */
export function TerminalOutput({
  text,
  title = "Diagnostics",
  maxHeight = 240,
  onCopy,
  className,
}: {
  text: string;
  title?: string;
  maxHeight?: number;
  onCopy?: (text: string) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      data-slot="terminal-output"
      className={cn(
        "overflow-hidden rounded-lg border bg-[#0b0b0b] text-[#d8d8d8] shadow-hairline",
        className,
      )}
    >
      <div className="flex h-8 items-center gap-2 border-b border-white/10 px-2.5 text-xs text-[#9a9a9a]">
        <TerminalIcon className="size-3.5" />
        {title}
        <Button
          variant="subtle"
          size="icon-sm"
          className="ml-auto text-[#9a9a9a] hover:bg-white/10 hover:text-white"
          aria-label="Copy output"
          onClick={() => {
            onCopy?.(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <pre
        className="scrollbar-thin overflow-auto px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}
