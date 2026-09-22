import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { protocol } from "electron";

import { extensionOf, isMediaFile, MEDIA_TYPES } from "../shared/workspace";
import { assertInsideWorkspace } from "./workspace/files";
import { resourcePath, type OpenWorkspace } from "./workspace/workspace";

/** `resit-file://<resource id>` streams an audio or video file to the window. */
export const FILE_SCHEME = "resit-file";

/** Must run before the app is ready. */
export function registerFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FILE_SCHEME,
      privileges: { standard: true, secure: true, stream: true },
    },
  ]);
}

/**
 * The bytes a Range header asks for, as inclusive offsets, or null when it
 * asks for none of the file.
 */
export function byteRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return start <= end && start < size ? { start, end } : null;
}

/** Serves the open workspace's audio and video, and nothing else. */
export function handleFileScheme(workspace: () => OpenWorkspace | null): void {
  protocol.handle(FILE_SCHEME, async (request) => {
    const current = workspace();
    const id = new URL(request.url).hostname;
    const entry = current?.resources.get(id);
    if (!current || !entry || !isMediaFile(entry.info.path))
      return new Response(null, { status: 404 });
    const path = resourcePath(current, id);
    await assertInsideWorkspace(current.root, path);
    const { size } = await stat(path);
    const type = MEDIA_TYPES[extensionOf(path)] ?? "application/octet-stream";
    const header = request.headers.get("range");
    const range = header ? byteRange(header, size) : null;
    if (header && !range)
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    const stream = (from: number, to: number) =>
      Readable.toWeb(
        createReadStream(path, { start: from, end: to }),
      ) as ReadableStream<Uint8Array>;
    if (!range)
      return new Response(stream(0, size - 1), {
        headers: {
          "content-type": type,
          "content-length": String(size),
          "accept-ranges": "bytes",
        },
      });
    return new Response(stream(range.start, range.end), {
      status: 206,
      headers: {
        "content-type": type,
        "content-length": String(range.end - range.start + 1),
        "content-range": `bytes ${range.start}-${range.end}/${size}`,
        "accept-ranges": "bytes",
      },
    });
  });
}
