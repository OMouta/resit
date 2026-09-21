import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { app, net } from "electron";
import { createWorker, OEM, type Worker } from "tesseract.js";

import type { DesktopEvent, TextRecognitionProgress } from "../shared/ipc";
import type { OcrLanguage } from "../shared/settings";
import { renderPdfPage } from "./agent/render";
import { loadSettings } from "./settings";
import { writeFileAtomic } from "./workspace/files";
import { recognizePdf } from "./workspace/ocr";
import { reindexResource } from "./workspace/search";
import { WorkspaceError, type OpenWorkspace } from "./workspace/workspace";

const LANGUAGE_NAMES: Record<OcrLanguage, string> = {
  eng: "English",
  por: "Portuguese",
};
/** About 200 dpi for an A4 page, enough for small print. */
const PAGE_WIDTH = 2000;

/** Language data is the same for every workspace, so it lives with the app. */
function dataDirectory(): string {
  return join(app.getPath("userData"), "ocr");
}

async function download(
  language: OcrLanguage,
  signal: AbortSignal,
  report: (received: number, total: number) => void,
): Promise<void> {
  const response = await net.fetch(
    `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
    { signal },
  );
  if (!response.ok || !response.body)
    throw new WorkspaceError(
      `The ${LANGUAGE_NAMES[language]} text recognition data could not be downloaded (HTTP ${response.status}).`,
    );
  const total = Number(response.headers.get("content-length")) || 0;
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    report(received, total);
  }
  await writeFileAtomic(
    join(dataDirectory(), `${language}.traineddata`),
    gunzipSync(Buffer.concat(chunks)),
  );
}

let job: {
  progress: TextRecognitionProgress;
  controller: AbortController;
} | null = null;

export function textRecognitionProgress(
  resourceId: string,
): TextRecognitionProgress | null {
  return job?.progress.resourceId === resourceId ? job.progress : null;
}

export function stopTextRecognition(): void {
  job?.controller.abort();
}

/**
 * Reads the text of a PDF's scanned pages on this computer, downloading the
 * language data first if it is not here yet. One PDF at a time; progress
 * and the outcome arrive as events.
 */
export async function startTextRecognition(
  workspace: OpenWorkspace,
  resourceId: string,
  options: {
    emit: (event: DesktopEvent) => void;
    /** Whether the workspace is still the one open in the window. */
    stillOpen: () => boolean;
  },
): Promise<void> {
  if (job)
    throw new WorkspaceError(
      "resit is already reading the text of another PDF. Wait for it to finish, or stop it.",
    );
  const info = workspace.resources.get(resourceId)?.info;
  if (!info || info.kind !== "pdf")
    throw new WorkspaceError("That file is not a PDF.");
  const languages = (await loadSettings()).pdf.ocrLanguages;
  const { emit } = options;
  const current = {
    controller: new AbortController(),
    progress: {
      resourceId,
      phase: "downloading",
      done: 0,
      total: 0,
    } as TextRecognitionProgress,
  };
  job = current;
  const { signal } = current.controller;
  const report = (progress: TextRecognitionProgress) => {
    current.progress = progress;
    emit({ type: "ocr-progress", ...progress });
  };

  void (async () => {
    let recognized = 0;
    let status: "done" | "cancelled" | "failed" = "done";
    let message: string | undefined;
    let worker: Worker | undefined;
    const stop = () => void worker?.terminate().catch(() => undefined);
    signal.addEventListener("abort", stop);
    try {
      for (const language of languages) {
        if (existsSync(join(dataDirectory(), `${language}.traineddata`)))
          continue;
        await download(language, signal, (received, total) =>
          report({ resourceId, phase: "downloading", done: received, total }),
        );
      }
      if (signal.aborted) throw new Error("Stopped");
      worker = await createWorker(languages.join("+"), OEM.LSTM_ONLY, {
        langPath: dataDirectory(),
        cachePath: dataDirectory(),
        cacheMethod: "readOnly",
        gzip: false,
      });
      const reader = worker;
      await recognizePdf(workspace, {
        documentId: resourceId,
        languages,
        recognizer: {
          recognize: async (image) =>
            (await reader.recognize(Buffer.from(image))).data.text,
        },
        render: async (page) =>
          Buffer.from(
            (
              await renderPdfPage(emit, {
                resourceId,
                revision: info.revision,
                page,
                maxWidth: PAGE_WIDTH,
              })
            ).data,
            "base64",
          ),
        onProgress: (done, total) => {
          report({ resourceId, phase: "reading", done, total });
          // Each page is searchable as soon as it is read.
          if (done > recognized && options.stillOpen())
            void reindexResource(workspace, resourceId).catch(() => undefined);
          recognized = done;
        },
        signal,
      });
      if (signal.aborted) status = "cancelled";
    } catch (error) {
      if (signal.aborted) status = "cancelled";
      else {
        status = "failed";
        message = error instanceof Error ? error.message : String(error);
      }
    } finally {
      signal.removeEventListener("abort", stop);
      await worker?.terminate().catch(() => undefined);
      job = null;
    }
    emit({
      type: "ocr-finished",
      resourceId,
      status,
      recognized,
      ...(message ? { message } : {}),
    });
  })();
}
