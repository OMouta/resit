import { useCallback, useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { Progress } from "@resit/ui/components/progress";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type { TextRecognition } from "../../../shared/ipc";
import type { ResourceInfo } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";

/**
 * Offers to read the text of a PDF's scanned pages, so search and the
 * assistant can find what they say, and shows the reading as it goes.
 */
export function TextRecognitionBanner({
  resource,
}: {
  resource: ResourceInfo;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [state, setState] = useState<TextRecognition | null>(null);
  const { id, revision } = resource;

  const load = useCallback(
    () => api.getTextRecognition(id).then(setState, () => setState(null)),
    [id],
  );

  // A new revision is a new file, with its own pages to read.
  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "ocr-progress" && event.resourceId === id) {
          const { type: _type, ...running } = event;
          setState((current) => (current ? { ...current, running } : current));
        }
        if (event.type !== "ocr-finished" || event.resourceId !== id) return;
        void load();
        if (event.status === "failed")
          notices.notify({
            tone: "error",
            title: t("The text was not recognized"),
            ...(event.message ? { detail: event.message } : {}),
          });
        else if (event.status === "done" && event.recognized > 0)
          notices.notify({
            tone: "success",
            title:
              event.recognized === 1
                ? t("Recognized the text on {count} page", { count: 1 })
                : t("Recognized the text on {count} pages", {
                    count: event.recognized,
                  }),
          });
      }),
    [t, id, load, notices],
  );

  if (!state) return null;
  const { running } = state;
  if (running) {
    const downloading = running.phase === "downloading";
    const fraction = running.total > 0 ? running.done / running.total : 0;
    return (
      <InlineMessage
        tone="info"
        className="mx-3 mt-3"
        title={
          downloading
            ? t("Downloading text recognition data")
            : t("Recognizing text")
        }
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void api.stopTextRecognition()}
          >
            {t("Stop")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            {downloading
              ? t("Once, for each language. The PDF stays on this computer.")
              : running.total > 0
                ? t("Page {page} of {total}", {
                    page: Math.min(running.done + 1, running.total),
                    total: running.total,
                  })
                : t("Looking for pages without text")}
          </p>
          <Progress
            value={fraction * 100}
            indeterminate={running.total === 0}
            aria-label={
              downloading ? t("Download progress") : t("Pages recognized")
            }
          />
        </div>
      </InlineMessage>
    );
  }
  if (state.waiting === 0) return null;
  return (
    <InlineMessage
      tone="info"
      className="mx-3 mt-3"
      actions={
        <Button
          size="sm"
          onClick={() =>
            void api.recognizeText(id).then(
              // Until the first progress arrives.
              () =>
                setState((current) =>
                  current
                    ? {
                        ...current,
                        running: current.running ?? {
                          resourceId: id,
                          phase: "reading",
                          done: 0,
                          total: 0,
                        },
                      }
                    : current,
                ),
              (error: unknown) =>
                notices.fail(t("Text recognition did not start"), error),
            )
          }
        >
          {t("Recognize text")}
        </Button>
      }
    >
      <p>
        {state.waiting === state.pageCount
          ? t("This PDF is scanned, so search cannot find what it says.")
          : state.waiting === 1
            ? t(
                "{count} page has no text, so search cannot find what it says.",
                { count: 1 },
              )
            : t(
                "{count} pages have no text, so search cannot find what they say.",
                { count: state.waiting },
              )}
      </p>
    </InlineMessage>
  );
}
