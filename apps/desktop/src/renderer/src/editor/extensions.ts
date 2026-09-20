import { Extension, InputRule, type Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";

import { Find } from "./find";

export interface MathHandlers {
  /** A math node was clicked. */
  onEdit: (display: boolean, latex: string, pos: number) => void;
  /** A math shortcut was used, or `$$` was typed on an empty line. */
  onInsert: (display: boolean) => void;
}

/**
 * Typing `$x^2$` turns the expression into inline math. The closing `$`
 * must follow a non-space character so prices like "$5 and $6" stay text.
 */
function mathTyping(handlers: () => MathHandlers) {
  return Extension.create({
    name: "mathTyping",
    addInputRules() {
      return [
        new InputRule({
          find: /(?<![$\w])\$([^$\s](?:[^$]*[^$\s])?)\$$/,
          handler: ({ state, range, match }) => {
            const type = state.schema.nodes.inlineMath;
            const latex = match[1];
            if (!type || !latex) return null;
            state.tr.replaceWith(range.from, range.to, type.create({ latex }));
          },
        }),
      ];
    },
    addKeyboardShortcuts() {
      return {
        "Mod-m": () => {
          handlers().onInsert(false);
          return true;
        },
        "Mod-Shift-m": () => {
          handlers().onInsert(true);
          return true;
        },
        Enter: ({ editor }) => {
          const { $from, empty } = editor.state.selection;
          if (!empty || $from.parent.textContent !== "$$") return false;
          editor
            .chain()
            .deleteRange({ from: $from.start(), to: $from.end() })
            .run();
          handlers().onInsert(true);
          return true;
        },
      };
    },
  });
}

export function noteExtensions(handlers: () => MathHandlers): Extensions {
  return [
    StarterKit.configure({
      // `resit:` links point at a page or highlight in this workspace, and
      // the note view opens them itself.
      link: {
        openOnClick: false,
        autolink: true,
        protocols: [{ scheme: "resit", optionalSlashes: false }],
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Image.configure({ allowBase64: false }),
    InlineMath.configure({
      katexOptions: { throwOnError: true, strict: "ignore" },
      onClick: (node: ProseMirrorNode, pos: number) =>
        handlers().onEdit(false, String(node.attrs.latex ?? ""), pos),
    }),
    BlockMath.configure({
      katexOptions: { displayMode: true, throwOnError: true, strict: "ignore" },
      onClick: (node: ProseMirrorNode, pos: number) =>
        handlers().onEdit(true, String(node.attrs.latex ?? ""), pos),
    }),
    mathTyping(handlers),
    Find,
    Placeholder.configure({
      placeholder:
        "Write here. Type $x^2$ for math, or $$ and Enter for a block.",
    }),
    Markdown,
  ];
}

/** Letters and digits only, for checking that a round trip lost no text. */
function textSignature(markdown: string): string {
  return markdown.replace(/[^\p{L}\p{N}]+/gu, "");
}

export function roundTripLosesText(
  original: string,
  serialized: string,
): boolean {
  return textSignature(original) !== textSignature(serialized);
}
