import type { Editor } from "@tiptap/core";
import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ReplaceIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import {
  clearSearch,
  findStatus,
  goToMatch,
  replaceAll,
  replaceCurrent,
  search,
  type FindStatus,
} from "./find";

export interface FindBarProps {
  editor: Editor;
  onClose: () => void;
  /** Opens with the replace field showing. */
  replacing: boolean;
  onReplacingChange: (replacing: boolean) => void;
}

/** Find and replace inside the open note. */
export function FindBar({
  editor,
  onClose,
  replacing,
  onReplacingChange,
}: FindBarProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [status, setStatus] = useState<FindStatus>({ count: 0, current: 0 });

  useEffect(() => {
    search(editor, query, caseSensitive);
    setStatus(findStatus(editor));
  }, [editor, query, caseSensitive]);

  useEffect(() => () => clearSearch(editor), [editor]);

  const step = (direction: 1 | -1) => {
    goToMatch(editor, direction);
    setStatus(findStatus(editor));
  };

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  return (
    <div className="flex flex-col gap-2 border-b bg-background px-3 py-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          step(1);
        }}
      >
        <Input
          autoFocus
          aria-label="Find in note"
          placeholder="Find"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              step(-1);
            }
          }}
          className="h-8 max-w-72"
        />
        <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
          {query ? `${status.current}/${status.count}` : ""}
        </span>
        <ToolbarButton
          label="Previous match"
          disabled={status.count === 0}
          onClick={() => step(-1)}
        >
          <ChevronUpIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Next match"
          disabled={status.count === 0}
          onClick={() => step(1)}
        >
          <ChevronDownIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Match case"
          active={caseSensitive}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitiveIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Replace"
          active={replacing}
          onClick={() => onReplacingChange(!replacing)}
        >
          <ReplaceIcon />
        </ToolbarButton>
        <Button
          type="button"
          size="icon-sm"
          variant="subtle"
          aria-label="Close find"
          className="ml-auto"
          onClick={close}
        >
          <XIcon />
        </Button>
      </form>
      {replacing ? (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Replace with"
            placeholder="Replace with"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key !== "Enter") return;
              event.preventDefault();
              replaceCurrent(editor, replacement);
              setStatus(findStatus(editor));
            }}
            className="h-8 max-w-72"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={status.count === 0}
            onClick={() => {
              replaceCurrent(editor, replacement);
              setStatus(findStatus(editor));
            }}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={status.count === 0}
            onClick={() => {
              replaceAll(editor, replacement);
              setStatus(findStatus(editor));
            }}
          >
            Replace all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
