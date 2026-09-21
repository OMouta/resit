import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { messages as desktop } from "../apps/desktop/src/shared/i18n/pt-PT";
import { messages as ui } from "../packages/ui/src/i18n/pt-PT";

const root = fileURLToPath(new URL("..", import.meta.url));
const UI_SOURCES = ["packages/ui/src"];
const DESKTOP_SOURCES = [
  "apps/desktop/src/renderer/src",
  "apps/desktop/src/main",
  "apps/desktop/src/shared",
];

/** `t("…")`, `tx("…")`, or `msg("…")` with a plain string, in any quotes. */
const CALL =
  /(?<![\w$.])(?:t|tx|msg)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*)`)/g;
/** Text built with `${}` cannot be looked up; it needs `{name}` values. */
const BUILT = /(?<![\w$.])(?:t|tx|tc|msg|msgc)\(\s*`[^`]*\$\{/g;
/** `tc("context", "…")` or `msgc(…)`, keyed as gettext keys context. */
const CONTEXT_CALL =
  /(?<![\w$.])(?:tc|msgc)\(\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g;

async function files(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, directory), {
    withFileTypes: true,
  })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") found.push(...(await files(path)));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
      found.push(path);
  }
  return found;
}

/** Reads a string literal's contents the way JavaScript would. */
function unquote(double?: string, single?: string, template?: string): string {
  if (double !== undefined) return JSON.parse(`"${double}"`) as string;
  const raw = (single ?? template ?? "")
    .replace(/\\(['`$])/g, "$1")
    .replace(/"/g, '\\"');
  return JSON.parse(`"${raw}"`) as string;
}

async function texts(directories: string[]) {
  const found = new Map<string, string>();
  const built: string[] = [];
  for (const directory of directories)
    for (const path of await files(directory)) {
      const source = await readFile(join(root, path), "utf8");
      for (const match of source.matchAll(CALL))
        found.set(unquote(match[1], match[2], match[3]), path);
      for (const match of source.matchAll(CONTEXT_CALL))
        found.set(`${unquote(match[1])}\u0004${unquote(match[2])}`, path);
      for (const match of source.matchAll(BUILT))
        built.push(`${path}: ${match[0]}`);
    }
  return { found, built };
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("European Portuguese", () => {
  it("translates every text the interface shows", async () => {
    const shared = await texts(UI_SOURCES);
    const own = await texts(DESKTOP_SOURCES);
    const missing = [
      ...[...shared.found].filter(([text]) => !(text in ui)),
      ...[...own.found].filter(([text]) => !(text in ui) && !(text in desktop)),
    ].map(([text, path]) => `${path}: ${text}`);
    expect(missing).toEqual([]);
    expect([...shared.built, ...own.built]).toEqual([]);
  });

  it("keeps no translation that nothing uses", async () => {
    const shared = await texts(UI_SOURCES);
    const own = await texts(DESKTOP_SOURCES);
    expect(Object.keys(ui).filter((text) => !shared.found.has(text))).toEqual(
      [],
    );
    expect(Object.keys(desktop).filter((text) => !own.found.has(text))).toEqual(
      [],
    );
    // The desktop app loads both, so a text lives in one of them.
    expect(Object.keys(desktop).filter((text) => text in ui)).toEqual([]);
  });

  it("keeps each placeholder in the translation", () => {
    const wrong = Object.entries({ ...ui, ...desktop })
      .filter(
        ([text, translation]) =>
          placeholders(text).join() !== placeholders(translation).join(),
      )
      .map(([text]) => text);
    expect(wrong).toEqual([]);
  });
});
