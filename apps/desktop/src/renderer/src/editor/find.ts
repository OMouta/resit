import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface FindMatch {
  from: number;
  to: number;
}

interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: FindMatch[];
  /** Index of the match the editor is on, or -1 before the first jump. */
  index: number;
  decorations: DecorationSet;
}

interface FindMeta {
  query: string;
  caseSensitive: boolean;
  index?: number;
}

const findKey = new PluginKey<FindState>("resitFind");

/**
 * Every occurrence of `query`, block by block. Inline nodes that carry no
 * text (maths, images) are stepped over so offsets stay true.
 */
function findMatches(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
): FindMatch[] {
  const matches: FindMatch[] = [];
  const needle = caseSensitive ? query : query.toLowerCase();
  if (!needle) return matches;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (!child.isText) return;
      const value = child.text ?? "";
      for (let index = 0; index < value.length; index += 1) {
        text += value[index];
        positions.push(pos + 1 + offset + index);
      }
    });
    const haystack = caseSensitive ? text : text.toLowerCase();
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      const from = positions[at];
      const last = positions[at + needle.length - 1];
      if (from !== undefined && last !== undefined)
        matches.push({ from, to: last + 1 });
      at = haystack.indexOf(needle, at + needle.length);
    }
    return false;
  });
  return matches;
}

function decorate(matches: FindMatch[], index: number, doc: ProseMirrorNode) {
  return DecorationSet.create(
    doc,
    matches.map((match, at) =>
      Decoration.inline(match.from, match.to, {
        class: at === index ? "find-match find-match-current" : "find-match",
      }),
    ),
  );
}

/** Highlights what the find bar is looking for. */
export const Find = Extension.create({
  name: "find",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({
            query: "",
            caseSensitive: false,
            matches: [],
            index: -1,
            decorations: DecorationSet.empty,
          }),
          apply: (transaction, current, _old, state) => {
            const meta = transaction.getMeta(findKey) as FindMeta | undefined;
            if (!meta && !transaction.docChanged) return current;
            const query = meta ? meta.query : current.query;
            const caseSensitive = meta
              ? meta.caseSensitive
              : current.caseSensitive;
            const matches = findMatches(state.doc, query, caseSensitive);
            const index =
              meta?.index ?? Math.min(current.index, matches.length - 1);
            return {
              query,
              caseSensitive,
              matches,
              index,
              decorations: decorate(matches, index, state.doc),
            };
          },
        },
        props: {
          decorations: (state) => findKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

function stateOf(editor: Editor): FindState | undefined {
  return findKey.getState(editor.state);
}

export interface FindStatus {
  count: number;
  /** One-based position of the current match, or 0 when there is none. */
  current: number;
}

export function findStatus(editor: Editor): FindStatus {
  const state = stateOf(editor);
  return {
    count: state?.matches.length ?? 0,
    current: state && state.index >= 0 ? state.index + 1 : 0,
  };
}

/** Moves the selection onto a match so it is visible and replaceable. */
function select(editor: Editor, index: number): void {
  const state = stateOf(editor);
  const match = state?.matches[index];
  if (!state || !match) return;
  const transaction = editor.state.tr;
  transaction.setSelection(
    TextSelection.create(transaction.doc, match.from, match.to),
  );
  transaction.setMeta(findKey, {
    query: state.query,
    caseSensitive: state.caseSensitive,
    index,
  } satisfies FindMeta);
  editor.view.dispatch(transaction.scrollIntoView());
}

/** Starts a search and jumps to the match nearest the cursor. */
export function search(
  editor: Editor,
  query: string,
  caseSensitive = false,
): void {
  const matches = findMatches(editor.state.doc, query, caseSensitive);
  const at = editor.state.selection.from;
  const next = matches.findIndex((match) => match.from >= at);
  const index = matches.length === 0 ? -1 : next === -1 ? 0 : next;
  editor.view.dispatch(
    editor.state.tr.setMeta(findKey, {
      query,
      caseSensitive,
      index,
    } satisfies FindMeta),
  );
}

export function clearSearch(editor: Editor): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(findKey, {
      query: "",
      caseSensitive: false,
      index: -1,
    } satisfies FindMeta),
  );
}

/** Steps to the next match, wrapping around the end of the note. */
export function goToMatch(editor: Editor, step: 1 | -1): void {
  const state = stateOf(editor);
  if (!state || state.matches.length === 0) return;
  const count = state.matches.length;
  const index =
    state.index < 0
      ? step === 1
        ? 0
        : count - 1
      : (state.index + step + count) % count;
  select(editor, index);
}

export function replaceCurrent(editor: Editor, replacement: string): void {
  const state = stateOf(editor);
  if (!state || state.index < 0) {
    goToMatch(editor, 1);
    return;
  }
  const match = state.matches[state.index];
  if (!match) return;
  const transaction = editor.state.tr;
  if (replacement) transaction.insertText(replacement, match.from, match.to);
  else transaction.delete(match.from, match.to);
  editor.view.dispatch(transaction);
  // The document changed, so the matches were recomputed: go to the next one.
  const after = stateOf(editor);
  if (after && after.matches.length > 0) {
    const index = after.matches.findIndex(
      (entry) => entry.from >= match.from + replacement.length,
    );
    select(editor, index === -1 ? 0 : index);
  }
}

/** Replaces every match in one step, so one undo puts them all back. */
export function replaceAll(editor: Editor, replacement: string): number {
  const state = stateOf(editor);
  if (!state || state.matches.length === 0) return 0;
  const transaction = editor.state.tr;
  // Back to front, so earlier positions stay valid.
  for (const match of [...state.matches].reverse()) {
    if (replacement) transaction.insertText(replacement, match.from, match.to);
    else transaction.delete(match.from, match.to);
  }
  editor.view.dispatch(transaction);
  return state.matches.length;
}
