import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import {
  EditorToolbar,
  type EditorBlock,
  type EditorMark,
  type TextStyle,
} from "@resit/ui/patterns/document/editor-toolbar";
import {
  SaveStatus,
  type SaveState,
} from "@resit/ui/patterns/files/save-status";

import type { NoteDocument } from "../../../shared/ipc";
import type { ResourceInfo, SubjectInfo } from "../../../shared/workspace";
import { PromptDialog, type PromptRequest } from "../components/prompt-dialog";
import { api, errorMessage } from "../lib/api";
import { useWidth } from "../lib/use-width";
import { registerView } from "../views/view-registry";
import {
  noteExtensions,
  roundTripLosesText,
  type MathHandlers,
} from "./extensions";
import { MathDialog, type MathRequest } from "./math-dialog";

const SAVE_DELAY_MS = 800;
const MARKS: readonly EditorMark[] = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
];
const BLOCKS: readonly EditorBlock[] = [
  "bulletList",
  "orderedList",
  "taskList",
  "mathInline",
  "mathBlock",
  "link",
];

export interface NoteViewProps {
  resource: ResourceInfo;
  subject: SubjectInfo | undefined;
  onRename: (title: string) => Promise<void>;
}

/** Loads a note and remounts the editor whenever the text is replaced from disk. */
export function NoteView(props: NoteViewProps) {
  const [document, setDocument] = useState<NoteDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback((next: NoteDocument) => {
    setDocument(next);
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.readNote(props.resource.id).then(
      (next) => {
        if (!cancelled) load(next);
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [props.resource.id, load]);

  if (error)
    return (
      <EmptyState
        className="h-full"
        title="This note could not be opened"
        description={error}
      />
    );
  if (!document)
    return (
      <div className="mx-auto flex w-full max-w-measure flex-col gap-3 px-6 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  return (
    <NoteEditor key={version} {...props} initial={document} onReplace={load} />
  );
}

interface NoteEditorProps extends NoteViewProps {
  initial: NoteDocument;
  onReplace: (document: NoteDocument) => void;
}

function NoteEditor({
  resource,
  subject,
  onRename,
  initial,
  onReplace,
}: NoteEditorProps) {
  const [mode, setMode] = useState<"rich" | "source">("rich");
  const [source, setSource] = useState(initial.body);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string>();
  const [conflict, setConflict] = useState<NoteDocument | null>(null);
  const [lossy, setLossy] = useState(false);
  const [math, setMath] = useState<MathRequest | null>(null);
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);

  const revision = useRef(initial.revision);
  const edits = useRef(0);
  const savedEdits = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const modeRef = useRef(mode);
  const sourceRef = useRef(source);
  const conflictRef = useRef(conflict);
  const bodyRef = useRef<() => string>(() => initial.body);
  modeRef.current = mode;
  sourceRef.current = source;
  conflictRef.current = conflict;

  const save = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    while (saving.current) await saving.current;
    if (edits.current === savedEdits.current || conflictRef.current) return;
    const edit = edits.current;
    const body = bodyRef.current();
    setSaveState("saving");
    const task = (async () => {
      try {
        const result = await api.saveNote({
          id: resource.id,
          body,
          expectedRevision: revision.current,
        });
        if (result.status === "saved") {
          revision.current = result.revision;
          savedEdits.current = edit;
          setSaveError(undefined);
          setSaveState(edits.current === edit ? "saved" : "unsaved");
        } else if (result.status === "conflict") {
          setConflict({
            resource,
            body: result.currentBody,
            revision: result.currentRevision,
          });
          setSaveState("conflict");
        } else {
          setSaveError(
            "The file is no longer in the workspace. Copy your text before closing this tab.",
          );
          setSaveState("error");
        }
      } catch (reason) {
        setSaveError(errorMessage(reason));
        setSaveState("error");
      }
    })();
    saving.current = task;
    await task;
    saving.current = null;
    if (edits.current !== savedEdits.current && !conflictRef.current)
      timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [resource]);

  const saveRef = useRef(save);
  saveRef.current = save;

  const markEdited = useCallback(() => {
    edits.current += 1;
    if (!conflictRef.current) setSaveState("unsaved");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => void saveRef.current(),
      SAVE_DELAY_MS,
    );
  }, []);

  // Declared before the editor so it runs before the editor is destroyed.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (edits.current !== savedEdits.current) void saveRef.current();
    },
    [],
  );

  const handlers = useRef<MathHandlers>({
    onEdit: () => undefined,
    onInsert: () => undefined,
  });

  const editor = useEditor(
    {
      extensions: useMemo(() => noteExtensions(() => handlers.current), []),
      content: initial.body,
      contentType: "markdown",
      editorProps: {
        attributes: {
          class: "document note-content",
          "aria-label": "Note text",
          spellcheck: "true",
        },
      },
      onUpdate: () => markEdited(),
      onBlur: () => void saveRef.current(),
    },
    [],
  );

  bodyRef.current = () =>
    modeRef.current === "source" ? sourceRef.current : editor.getMarkdown();

  handlers.current = {
    onEdit: (display, latex, pos) => setMath({ display, latex, pos }),
    onInsert: (display) => {
      const { from, to } = editor.state.selection;
      setMath({
        display,
        latex: editor.state.doc.textBetween(from, to, " "),
        pos: null,
      });
    },
  };

  // Notes that the rich editor cannot represent faithfully open as source.
  useEffect(() => {
    if (roundTripLosesText(initial.body, editor.getMarkdown())) {
      setLossy(true);
      setMode("source");
    }
  }, [editor, initial.body]);

  // Another program changed the file: reload a clean note, flag a dirty one.
  useEffect(() => {
    if (resource.revision === revision.current || saving.current) return;
    let cancelled = false;
    void api.readNote(resource.id).then((current) => {
      if (cancelled || current.revision === revision.current) return;
      if (edits.current === savedEdits.current) onReplace(current);
      else {
        setConflict(current);
        setSaveState("conflict");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resource.id, resource.revision, onReplace]);

  useEffect(
    () =>
      registerView(resource.id, {
        context: () => {
          if (modeRef.current === "source") {
            const field = window.document.getElementById(
              `source-${resource.id}`,
            ) as HTMLTextAreaElement | null;
            const text = field
              ? field.value.slice(field.selectionStart, field.selectionEnd)
              : "";
            return text.trim() ? { selection: text } : {};
          }
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, "\n");
          return text.trim() ? { selection: text } : {};
        },
        insertMarkdown: (markdown) => {
          if (conflictRef.current) return false;
          if (modeRef.current === "source") {
            setSource((current) => `${current.trimEnd()}\n\n${markdown}\n`);
            markEdited();
          } else {
            editor
              .chain()
              .focus("end")
              .insertContent(`\n\n${markdown}`, { contentType: "markdown" })
              .run();
          }
          return true;
        },
        flush: () => saveRef.current(),
      }),
    [resource.id, editor, markEdited],
  );

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const textStyle: TextStyle = current.isActive("heading", { level: 1 })
        ? "heading1"
        : current.isActive("heading", { level: 2 })
          ? "heading2"
          : current.isActive("heading", { level: 3 })
            ? "heading3"
            : current.isActive("blockquote")
              ? "quote"
              : current.isActive("codeBlock")
                ? "code"
                : "paragraph";
      return {
        textStyle,
        marks: MARKS.filter((mark) => current.isActive(mark)),
        blocks: [
          ...(current.isActive("bulletList") ? ["bulletList" as const] : []),
          ...(current.isActive("orderedList") ? ["orderedList" as const] : []),
          ...(current.isActive("taskList") ? ["taskList" as const] : []),
          ...(current.isActive("link") ? ["link" as const] : []),
        ],
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });

  const setTextStyle = (style: TextStyle) => {
    const chain = editor.chain().focus();
    switch (style) {
      case "paragraph":
        chain.setParagraph().run();
        break;
      case "heading1":
      case "heading2":
      case "heading3":
        chain.setHeading({ level: Number(style.slice(-1)) as 1 | 2 | 3 }).run();
        break;
      case "quote":
        if (!editor.isActive("blockquote")) chain.toggleBlockquote().run();
        break;
      case "code":
        if (!editor.isActive("codeBlock")) chain.toggleCodeBlock().run();
        break;
    }
  };

  const toggleMark = (mark: EditorMark) => {
    const chain = editor.chain().focus();
    const commands = {
      bold: () => chain.toggleBold(),
      italic: () => chain.toggleItalic(),
      underline: () => chain.toggleUnderline(),
      strike: () => chain.toggleStrike(),
      code: () => chain.toggleCode(),
    };
    commands[mark]().run();
  };

  const runBlock = (block: EditorBlock) => {
    switch (block) {
      case "bulletList":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "orderedList":
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "taskList":
        editor.chain().focus().toggleTaskList().run();
        break;
      case "mathInline":
        handlers.current.onInsert(false);
        break;
      case "mathBlock":
        handlers.current.onInsert(true);
        break;
      case "link": {
        const current = editor.getAttributes("link").href as string | undefined;
        setPrompt({
          title: current ? "Edit link" : "Add link",
          label: "Address",
          placeholder: "https://",
          ...(current ? { initialValue: current } : {}),
          submitLabel: current ? "Update" : "Add link",
          onSubmit: (href) => {
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href })
              .run();
          },
        });
        break;
      }
      case "callout":
        break;
    }
  };

  const switchMode = (next: "rich" | "source") => {
    if (next === mode) return;
    if (next === "source") {
      setSource(editor.getMarkdown());
      setMode("source");
      return;
    }
    editor.commands.setContent(source, {
      contentType: "markdown",
      emitUpdate: false,
    });
    if (roundTripLosesText(source, editor.getMarkdown())) {
      setLossy(true);
      return;
    }
    setLossy(false);
    setMode("rich");
  };

  const resolveConflict = (keep: "mine" | "disk") => {
    if (!conflict) return;
    if (keep === "disk") {
      onReplace(conflict);
      return;
    }
    revision.current = conflict.revision;
    setConflict(null);
    conflictRef.current = null;
    edits.current += 1;
    void save();
  };

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-mode={mode}
    >
      <EditorToolbar
        textStyle={toolbar.textStyle}
        onTextStyleChange={setTextStyle}
        marks={toolbar.marks}
        onToggleMark={toggleMark}
        activeBlocks={toolbar.blocks}
        onBlock={runBlock}
        blocks={BLOCKS}
        canUndo={toolbar.canUndo}
        canRedo={toolbar.canRedo}
        onUndo={() => editor.chain().focus().undo().run()}
        onRedo={() => editor.chain().focus().redo().run()}
        disabled={mode === "source"}
        compact={width > 0 && width < 860}
        end={
          <>
            <SaveStatus
              state={saveState}
              detail={saveError}
              {...(saveState === "error"
                ? { onAction: () => void save() }
                : {})}
            />
            <Tabs
              value={mode}
              onValueChange={(value) => switchMode(value as "rich" | "source")}
            >
              <TabsList aria-label="Editing mode">
                <TabsTrigger value="rich" className="text-xs">
                  Rich
                </TabsTrigger>
                <TabsTrigger value="source" className="text-xs">
                  Markdown
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
      {conflict ? (
        <InlineMessage
          tone="warning"
          title="This note changed on disk while you were editing"
          className="mx-4 mt-3"
          actions={
            <>
              <Button size="sm" onClick={() => resolveConflict("mine")}>
                Keep my version
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => resolveConflict("disk")}
              >
                Use the version on disk
              </Button>
            </>
          }
        >
          <p>Your text has not been saved. Choose which version to keep.</p>
        </InlineMessage>
      ) : null}
      {lossy && mode === "source" ? (
        <InlineMessage tone="info" className="mx-4 mt-3">
          <p>
            This note uses Markdown the rich editor would change, so it opens as
            source.
          </p>
        </InlineMessage>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[calc(var(--document-measure)+3rem)] flex-col pb-24">
          <DocumentHeader
            title={resource.title}
            {...(subject
              ? { subject: { name: subject.name, color: subject.color } }
              : {})}
            path={resource.path}
            onRename={(title) => void onRename(title)}
          />
          <div className="px-6">
            {mode === "rich" ? (
              <EditorContent editor={editor} />
            ) : (
              <textarea
                id={`source-${resource.id}`}
                aria-label="Markdown source"
                value={source}
                spellCheck={false}
                onChange={(event) => {
                  setSource(event.target.value);
                  markEdited();
                }}
                onBlur={() => void save()}
                className="field-sizing-content min-h-[50vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none"
              />
            )}
          </div>
        </div>
      </ScrollArea>
      <PromptDialog request={prompt} onClose={() => setPrompt(null)} />
      <MathDialog
        request={math}
        onClose={() => {
          setMath(null);
          editor.commands.focus();
        }}
        onSubmit={({ display, latex, pos }) => {
          const chain = editor.chain().focus();
          if (pos !== null) {
            if (display) chain.updateBlockMath({ latex, pos }).run();
            else chain.updateInlineMath({ latex, pos }).run();
          } else if (display) chain.insertBlockMath({ latex }).run();
          else chain.deleteSelection().insertInlineMath({ latex }).run();
        }}
        onDelete={({ display, pos }) => {
          if (pos === null) return;
          if (display) editor.chain().focus().deleteBlockMath({ pos }).run();
          else editor.chain().focus().deleteInlineMath({ pos }).run();
        }}
      />
    </div>
  );
}
