import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";

/**
 * Icon button that copies `value` and briefly shows a check. Pass `onCopy`
 * when the app owns the clipboard; otherwise the browser clipboard is used.
 */
export function CopyButton({
  value,
  label,
  onCopy,
}: {
  value: string;
  label: string;
  onCopy?: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label={copied ? "Copied" : label}
          onClick={() => {
            if (onCopy) onCopy(value);
            else void navigator.clipboard?.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
    </Tooltip>
  );
}
