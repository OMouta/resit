import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { useLocale } from "@resit/ui/hooks/use-locale";

export interface PromptRequest {
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (value: string) => void | Promise<void>;
}

/** One-field dialog for names, titles, and links. */
export function PromptDialog({
  request,
  onClose,
  children,
}: {
  request: PromptRequest | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request) setValue(request.initialValue ?? "");
  }, [request]);

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) return;
              setBusy(true);
              try {
                await request.onSubmit(trimmed);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
              {request.description ? (
                <DialogDescription>{request.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-field">{request.label}</Label>
              <Input
                id="prompt-field"
                autoFocus
                value={value}
                placeholder={request.placeholder}
                onChange={(event) => setValue(event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </div>
            {children}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={busy || !value.trim()}>
                {request.submitLabel}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
