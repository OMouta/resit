import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256, writeFileAtomic } from "../workspace/files";
import type { OpenWorkspace } from "../workspace/workspace";
import { downloadFile, MoodleError, type MoodleSession } from "./client";

/** Where images from course text are kept. They can be fetched again. */
function mediaDir(workspace: OpenWorkspace): string {
  return join(workspace.root, ".resit", "cache", "moodle");
}

/** How the saved images are named: a hash of their address, and a type. */
const MEDIA_NAME = /^[a-f0-9]{64}\.(png|jpg|gif|webp|svg)$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** New images fetched in one read of a course, so a gallery cannot stall it. */
const MAX_NEW_IMAGES = 40;

export const MEDIA_SCHEME = "resit-media:";

/** Markdown images, `![alt](address)`, as `briefMarkdown` writes them. */
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** The image type from its first bytes, or null for anything else. */
function imageType(bytes: Uint8Array): string | null {
  const head = Buffer.from(bytes.subarray(0, 64));
  if (
    head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "webp";
  const text = head.toString("utf8").trimStart();
  if (text.startsWith("<svg") || text.startsWith("<?xml")) return "svg";
  return null;
}

/**
 * A course file's address in the form a token can open. Course text links
 * to `/pluginfile.php`, which wants a browser session.
 */
function tokenAddress(address: string, site: string): string | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.origin !== new URL(site).origin) return null;
  url.pathname = url.pathname.replace(
    /(?<!\/webservice)\/pluginfile\.php\//,
    "/webservice/pluginfile.php/",
  );
  url.search = "";
  return url.toString();
}

/**
 * Replaces the course's own images in Markdown with copies saved in the
 * workspace, so the course page shows them without a browser session.
 * An image that cannot be fetched keeps its address and shows as its
 * description.
 */
export function mediaSaver(
  workspace: OpenWorkspace,
  session: MoodleSession,
): (markdown: string) => Promise<string> {
  let saved: Set<string> | null = null;
  const known = new Map<string, string | null>();
  let fetched = 0;

  const save = async (address: string): Promise<string | null> => {
    const target = tokenAddress(address, session.siteUrl);
    if (!target) return null;
    if (known.has(target)) return known.get(target) ?? null;
    const hash = sha256(target).slice("sha256:".length);
    if (!saved) {
      await mkdir(mediaDir(workspace), { recursive: true });
      saved = new Set(await readdir(mediaDir(workspace)));
    }
    let name = [...saved].find((entry) => entry.startsWith(`${hash}.`)) ?? null;
    if (!name && fetched < MAX_NEW_IMAGES) {
      fetched += 1;
      try {
        const bytes = await downloadFile(session, target, MAX_IMAGE_BYTES);
        const type = imageType(bytes);
        if (type) {
          name = `${hash}.${type}`;
          await writeFileAtomic(join(mediaDir(workspace), name), bytes);
          saved.add(name);
        }
      } catch (error) {
        if (!(error instanceof MoodleError)) throw error;
      }
    }
    known.set(target, name);
    return name;
  };

  return async (markdown) => {
    const names = new Map<string, string | null>();
    for (const match of markdown.matchAll(IMAGE)) {
      const address = match[2] ?? "";
      if (!names.has(address)) names.set(address, await save(address));
    }
    return markdown.replace(IMAGE, (whole, alt: string, address: string) => {
      const name = names.get(address);
      return name ? `![${alt}](${MEDIA_SCHEME}${name})` : whole;
    });
  };
}

/** One saved image, by the name the Markdown gives it. */
export async function readMedia(
  workspace: OpenWorkspace,
  name: string,
): Promise<Uint8Array> {
  if (!MEDIA_NAME.test(name)) throw new Error("That is not a saved image.");
  return readFile(join(mediaDir(workspace), name));
}
