import { parse, stringify } from "yaml";

import { t } from "../i18n";
import { sha256 } from "./files";

const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

export type ParsedNote =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; message: string };

/** Splits a Markdown file into its YAML frontmatter and body. */
export function parseNote(text: string): ParsedNote {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const match = FRONTMATTER.exec(source);
  if (!match) return { ok: true, data: {}, body: source };
  let data: unknown;
  try {
    data = parse(match[1] ?? "");
  } catch (error) {
    return {
      ok: false,
      message: t("The frontmatter is not valid YAML: {problem}", {
        problem: error instanceof Error ? error.message : String(error),
      }),
    };
  }
  if (data === null || data === undefined) data = {};
  if (typeof data !== "object" || Array.isArray(data))
    return {
      ok: false,
      message: t("The frontmatter is not a YAML mapping."),
    };
  return {
    ok: true,
    data: data as Record<string, unknown>,
    body: source.slice(match[0].length).replace(/^\r?\n/, ""),
  };
}

/** Writes frontmatter followed by the body. Field order is kept. */
export function serializeNote(
  data: Record<string, unknown>,
  body: string,
): string {
  const yaml = stringify(data, { lineWidth: 0 }).trimEnd();
  const text = body.replace(/^\n+/, "");
  return `---\n${yaml}\n---\n\n${text.endsWith("\n") || text === "" ? text : `${text}\n`}`;
}

/**
 * A note's revision covers its body only, so metadata changes such as a
 * rename never look like a conflicting edit.
 */
export function noteRevision(text: string): string {
  const parsed = parseNote(text);
  return sha256(parsed.ok ? parsed.body : text);
}
