import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setImmediate as yieldToEvents } from "node:timers/promises";

import type { ResourceInfo } from "../../shared/workspace";
import { readablePages } from "./ocr";
import { hasReadableText, readableText } from "./text";
import { readNote, type OpenWorkspace } from "./workspace";

export interface SearchHit {
  resourceId: string;
  title: string;
  kind: ResourceInfo["kind"];
  subjectId: string;
  /** One-based page for PDF hits. */
  page?: number;
  snippet: string;
}

/** Lowercased text without accents, with a map back to original offsets. */
function fold(text: string): { folded: string; offsets: number[] } {
  let folded = "";
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      folded +=
        code >= 0x41 && code <= 0x5a ? text[index]!.toLowerCase() : text[index];
      offsets.push(index);
      continue;
    }
    const plain = text[index]!.normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    for (const char of plain) {
      folded += char;
      offsets.push(index);
    }
  }
  return { folded, offsets };
}

export function foldText(text: string): string {
  return fold(text).folded;
}

/** Finds every term in `text`; returns a snippet around the first one. */
function match(text: string, terms: string[]): string | null {
  const { folded, offsets } = fold(text);
  let first = -1;
  for (const term of terms) {
    const at = folded.indexOf(term);
    if (at === -1) return null;
    if (first === -1 || at < first) first = at;
  }
  const start = offsets[Math.max(0, first - 80)] ?? 0;
  const end = offsets[Math.min(folded.length - 1, first + 160)] ?? text.length;
  return `${start > 0 ? "…" : ""}${text
    .slice(start, end + 1)
    .replace(/\s+/g, " ")
    .trim()}${end < text.length - 1 ? "…" : ""}`;
}

const noteCache = new Map<string, { revision: string; text: string }>();

/** A note's text, kept until the note's revision changes. */
export async function noteText(
  workspace: OpenWorkspace,
  resource: ResourceInfo,
): Promise<string> {
  const cached = noteCache.get(resource.id);
  if (cached && cached.revision === resource.revision) return cached.text;
  const note = await readNote(workspace, resource.id);
  noteCache.set(resource.id, { revision: note.revision, text: note.body });
  return note.body;
}

/**
 * Bumped when the tables change shape or what goes into them. An index
 * from another version is thrown away and built again.
 */
const INDEX_VERSION = 1;
/** Text rows read per search, before the scope and limit cut them down. */
const MAX_ROWS = 400;

/**
 * The full-text index in `.resit/cache/index.sqlite`. It holds a copy of
 * every note's text and every PDF page, so it can be deleted and rebuilt.
 */
interface SearchIndex {
  db: DatabaseSync;
  /** The update in progress, which searches wait for. */
  running: Promise<void> | null;
  /** Something changed during the update, so it runs once more. */
  again: boolean;
  closed: boolean;
}

const indexes = new Map<string, SearchIndex>();

function createTables(db: DatabaseSync): void {
  const version = (
    db.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  if (version !== INDEX_VERSION) {
    db.exec(`
      DROP TABLE IF EXISTS pages_fts;
      DROP TABLE IF EXISTS pages;
      DROP TABLE IF EXISTS indexed;
      PRAGMA user_version = ${INDEX_VERSION};
    `);
  }
  // Text lives in an ordinary table, indexed by file, so replacing one
  // file's text does not scan the rest. The FTS table indexes it by row.
  db.exec(`
    CREATE TABLE IF NOT EXISTS indexed (
      id TEXT PRIMARY KEY,
      revision TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pages (
      rowid INTEGER PRIMARY KEY,
      resource_id TEXT NOT NULL,
      page INTEGER,
      body TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pages_by_resource ON pages (resource_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      body,
      content = 'pages',
      content_rowid = 'rowid',
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER IF NOT EXISTS pages_added AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts (rowid, body) VALUES (new.rowid, new.body);
    END;
    CREATE TRIGGER IF NOT EXISTS pages_removed AFTER DELETE ON pages BEGIN
      INSERT INTO pages_fts (pages_fts, rowid, body)
        VALUES ('delete', old.rowid, old.body);
    END;
  `);
}

function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    createTables(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function indexFor(workspace: OpenWorkspace): SearchIndex {
  const existing = indexes.get(workspace.root);
  if (existing) return existing;
  const directory = join(workspace.root, ".resit", "cache");
  const path = join(directory, "index.sqlite");
  let db: DatabaseSync;
  try {
    mkdirSync(directory, { recursive: true });
    db = openDatabase(path);
  } catch {
    // A damaged index is only a cache: start it again, or keep this
    // session's in memory when the file cannot be replaced.
    try {
      for (const suffix of ["", "-wal", "-shm"])
        rmSync(`${path}${suffix}`, { force: true });
      db = openDatabase(path);
    } catch {
      db = openDatabase(":memory:");
    }
  }
  const index: SearchIndex = { db, running: null, again: false, closed: false };
  indexes.set(workspace.root, index);
  return index;
}

/** Closes a workspace's index, such as when another workspace opens. */
export function closeSearchIndex(workspace: OpenWorkspace): void {
  const index = indexes.get(workspace.root);
  if (!index) return;
  indexes.delete(workspace.root);
  index.closed = true;
  index.db.close();
}

/** Replaces what the index holds for one file. Empty pages are left out. */
function store(
  index: SearchIndex,
  resourceId: string,
  revision: string,
  pages: string[],
  paged: boolean,
): void {
  const { db } = index;
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM pages WHERE resource_id = ?").run(resourceId);
    const insert = db.prepare(
      "INSERT INTO pages (resource_id, page, body) VALUES (?, ?, ?)",
    );
    pages.forEach((text, page) => {
      if (text.trim()) insert.run(resourceId, paged ? page + 1 : null, text);
    });
    db.prepare(
      "INSERT OR REPLACE INTO indexed (id, revision) VALUES (?, ?)",
    ).run(resourceId, revision);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function forget(index: SearchIndex, resourceId: string): void {
  index.db.prepare("DELETE FROM pages WHERE resource_id = ?").run(resourceId);
  index.db.prepare("DELETE FROM indexed WHERE id = ?").run(resourceId);
}

/** Brings the index in line with the workspace's notes and PDFs. */
async function sync(
  workspace: OpenWorkspace,
  index: SearchIndex,
): Promise<void> {
  const indexed = new Map(
    (
      index.db.prepare("SELECT id, revision FROM indexed").all() as {
        id: string;
        revision: string;
      }[]
    ).map((row) => [row.id, row.revision]),
  );
  for (const id of indexed.keys())
    if (!workspace.resources.has(id)) forget(index, id);

  // Notes first: they are quick, and a PDF can take seconds.
  const stale = [...workspace.resources.values()]
    .map((entry) => entry.info)
    .filter(
      (info) =>
        (info.kind === "note" ||
          info.kind === "pdf" ||
          hasReadableText(info)) &&
        indexed.get(info.id) !== info.revision,
    )
    .sort((a, b) => Number(a.kind === "pdf") - Number(b.kind === "pdf"));
  for (const info of stale) {
    if (index.closed) return;
    const current = workspace.resources.get(info.id)?.info;
    if (!current || current.revision !== info.revision) continue;
    let pages: string[] = [];
    let revision = info.revision;
    try {
      if (info.kind === "note") {
        const note = await readNote(workspace, info.id);
        pages = [note.body];
        revision = note.revision;
      } else if (info.kind === "pdf") {
        pages = await readablePages(workspace, info.id);
      } else {
        pages = [(await readableText(workspace, info.id)) ?? ""];
      }
    } catch {
      // Recorded with no text, so an unreadable file is not read again
      // until it changes. The file view reports the problem.
    }
    if (index.closed) return;
    store(index, info.id, revision, pages, info.kind === "pdf");
    await yieldToEvents();
  }
}

/** Reads one file into the index again, such as when its pages were read. */
export function reindexResource(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<void> {
  forget(indexFor(workspace), resourceId);
  return updateSearchIndex(workspace);
}

/**
 * Updates the index, or joins the update already running and makes sure it
 * goes round once more to catch anything that changed since it started.
 */
export function updateSearchIndex(workspace: OpenWorkspace): Promise<void> {
  const index = indexFor(workspace);
  if (index.running) {
    index.again = true;
    return index.running;
  }
  index.running = (async () => {
    do {
      index.again = false;
      await sync(workspace, index);
    } while (index.again && !index.closed);
  })().finally(() => {
    index.running = null;
  });
  return index.running;
}

/** An FTS query that needs every term, each as the start of a word. */
function ftsQuery(terms: string[]): string {
  return terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" ");
}

/**
 * Accent- and case-insensitive search over note text, PDF pages, and
 * titles. `allow` filters resources before any text is read, so excluded
 * files never produce snippets.
 */
export async function searchWorkspace(
  workspace: OpenWorkspace,
  query: string,
  options: { allow: (resource: ResourceInfo) => boolean; limit: number },
): Promise<SearchHit[]> {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const allowed = new Map(
    [...workspace.resources.values()]
      .map((entry) => entry.info)
      .filter(options.allow)
      .map((info) => [info.id, info]),
  );
  if (allowed.size === 0) return [];
  await updateSearchIndex(workspace);
  const index = indexFor(workspace);

  let rows: {
    rowid: number;
    resource_id: string;
    page: number | null;
    revision: string;
  }[] = [];
  try {
    rows = index.db
      .prepare(
        `SELECT p.rowid, p.resource_id, p.page, i.revision
           FROM pages_fts
           JOIN pages p ON p.rowid = pages_fts.rowid
           JOIN indexed i ON i.id = p.resource_id
          WHERE pages_fts MATCH ?
            AND p.resource_id IN (SELECT value FROM json_each(?))
          ORDER BY pages_fts.rank
          LIMIT ${MAX_ROWS}`,
      )
      .all(ftsQuery(terms), JSON.stringify([...allowed.keys()])) as typeof rows;
  } catch {
    // Terms FTS cannot parse find no text; titles still match.
  }

  // Text matches in rank order: a note once, a PDF once per page.
  const textRows: typeof rows = [];
  const noteRows = new Map<string, number>();
  const pdfsWithPages = new Set<string>();
  for (const row of rows) {
    const resource = allowed.get(row.resource_id);
    // A file changed since it was read is left out until it is read again.
    if (!resource || resource.revision !== row.revision) continue;
    if (row.page === null) {
      if (noteRows.has(resource.id)) continue;
      noteRows.set(resource.id, row.rowid);
    } else pdfsWithPages.add(resource.id);
    textRows.push(row);
  }

  // Title matches come first. A PDF with matching pages is listed by page.
  const titled = [...allowed.values()].filter(
    (resource) =>
      !pdfsWithPages.has(resource.id) && match(resource.title, terms) !== null,
  );
  const titledIds = new Set(titled.map((resource) => resource.id));
  const chosen = [
    ...titled.map((resource) => ({
      resource,
      page: undefined,
      rowid: noteRows.get(resource.id),
    })),
    ...textRows
      .filter((row) => row.page !== null || !titledIds.has(row.resource_id))
      .map((row) => ({
        resource: allowed.get(row.resource_id)!,
        page: row.page ?? undefined,
        rowid: row.rowid as number | undefined,
      })),
  ].slice(0, options.limit);

  // Snippets only for what is returned: folding long pages is the slow part.
  const body = index.db.prepare("SELECT body FROM pages WHERE rowid = ?");
  return chosen.map(({ resource, page, rowid }) => {
    const text =
      rowid === undefined
        ? undefined
        : (body.get(rowid) as { body: string } | undefined)?.body;
    const snippet =
      (text === undefined ? null : match(text, terms)) ??
      match(resource.title, terms) ??
      `${(text ?? resource.title).slice(0, 240).replace(/\s+/g, " ").trim()}…`;
    return {
      resourceId: resource.id,
      title: resource.title,
      kind: resource.kind,
      subjectId: resource.subjectId,
      ...(page === undefined ? {} : { page }),
      snippet,
    };
  });
}
