import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Label } from "@resit/ui/components/label";
import { Textarea } from "@resit/ui/components/textarea";
import { MathBlock, MathInline } from "@resit/ui/patterns/document/math";
import { useLocale } from "@resit/ui/hooks/use-locale";

export interface MathRequest {
  display: boolean;
  latex: string;
  /** Existing node position, or null to insert a new expression. */
  pos: number | null;
}

/** Edits a LaTeX expression with a live preview. */
export function MathDialog({
  request,
  onSubmit,
  onDelete,
  onClose,
}: {
  request: MathRequest | null;
  onSubmit: (request: MathRequest) => void;
  onDelete: (request: MathRequest) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [latex, setLatex] = useState("");

  useEffect(() => {
    if (request) setLatex(request.latex);
  }, [request]);

  const submit = () => {
    if (!request || !latex.trim()) return;
    onSubmit({ ...request, latex: latex.trim() });
    onClose();
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {request.display ? t("Math block") : t("Inline math")}
              </DialogTitle>
              <DialogDescription>
                {t("Write LaTeX. Press Ctrl+Enter to apply.")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="math-source">LaTeX</Label>
              <Textarea
                id="math-source"
                autoFocus
                value={latex}
                onChange={(event) => setLatex(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="\lim_{x \to 0} \frac{\sin x}{x} = 1"
                className="min-h-24 font-mono text-sm"
                spellCheck={false}
              />
            </div>
            <div
              aria-label={t("Preview")}
              className="flex min-h-16 items-center justify-center overflow-x-auto rounded-lg border bg-background px-4 py-3"
            >
              {latex.trim() ? (
                request.display ? (
                  <MathBlock>{latex}</MathBlock>
                ) : (
                  <MathInline>{latex}</MathInline>
                )
              ) : (
                <span className="text-sm text-subtle-foreground">
                  {t("Preview")}
                </span>
              )}
            </div>
            <DialogFooter>
              {request.pos !== null ? (
                <Button
                  type="button"
                  variant="destructive-outline"
                  className="mr-auto"
                  onClick={() => {
                    onDelete(request);
                    onClose();
                  }}
                >
                  {t("Remove")}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={!latex.trim()}>
                {request.pos === null ? t("Insert") : t("Apply")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
