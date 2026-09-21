import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MoreHorizontalIcon,
  RadicalIcon,
  Redo2Icon,
  SquareRadicalIcon,
  StickyNoteIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@resit/ui/components/toggle-group";
import { shortcutLabel } from "@resit/ui/lib/keys";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";

import {
  ToolbarButton,
  ToolbarSeparator,
  ToolbarTooltip,
} from "@resit/ui/patterns/document/toolbar-button";

export type TextStyle =
  "paragraph" | "heading1" | "heading2" | "heading3" | "quote" | "code";

export type EditorMark = "bold" | "italic" | "underline" | "strike" | "code";

export type EditorBlock =
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "mathInline"
  | "mathBlock"
  | "link"
  | "callout";

const TEXT_STYLES: { value: TextStyle; label: string }[] = [
  { value: "paragraph", label: msg("Paragraph") },
  { value: "heading1", label: msg("Heading 1") },
  { value: "heading2", label: msg("Heading 2") },
  { value: "heading3", label: msg("Heading 3") },
  { value: "quote", label: msg("Quote") },
  { value: "code", label: msg("Code") },
];

const MARKS: {
  value: EditorMark;
  label: string;
  shortcut: string;
  icon: typeof BoldIcon;
}[] = [
  { value: "bold", label: msg("Bold"), shortcut: "mod+b", icon: BoldIcon },
  {
    value: "italic",
    label: msg("Italic"),
    shortcut: "mod+i",
    icon: ItalicIcon,
  },
  {
    value: "underline",
    label: msg("Underline"),
    shortcut: "mod+u",
    icon: UnderlineIcon,
  },
  {
    value: "strike",
    label: msg("Strikethrough"),
    shortcut: "mod+shift+s",
    icon: StrikethroughIcon,
  },
  {
    value: "code",
    label: msg("Inline code"),
    shortcut: "mod+e",
    icon: CodeIcon,
  },
];

const BLOCKS: {
  value: EditorBlock;
  label: string;
  shortcut: string;
  icon: typeof ListIcon;
}[] = [
  {
    value: "bulletList",
    label: msg("Bullet list"),
    shortcut: "mod+shift+8",
    icon: ListIcon,
  },
  {
    value: "orderedList",
    label: msg("Numbered list"),
    shortcut: "mod+shift+7",
    icon: ListOrderedIcon,
  },
  {
    value: "taskList",
    label: msg("Task list"),
    shortcut: "mod+shift+9",
    icon: ListChecksIcon,
  },
  {
    value: "mathInline",
    label: msg("Inline math"),
    shortcut: "mod+m",
    icon: RadicalIcon,
  },
  {
    value: "mathBlock",
    label: msg("Math block"),
    shortcut: "mod+shift+m",
    icon: SquareRadicalIcon,
  },
  { value: "link", label: msg("Link"), shortcut: "mod+k", icon: LinkIcon },
  {
    value: "callout",
    label: msg("Callout"),
    shortcut: "mod+shift+c",
    icon: StickyNoteIcon,
  },
];

export interface EditorToolbarProps {
  textStyle: TextStyle;
  onTextStyleChange: (style: TextStyle) => void;
  /** Marks active at the cursor. */
  marks: readonly EditorMark[];
  onToggleMark: (mark: EditorMark) => void;
  /** Block types active at the cursor (for example the list the cursor is in). */
  activeBlocks?: readonly EditorBlock[];
  onBlock: (block: EditorBlock) => void;
  /** Block tools to offer. Defaults to all of them. */
  blocks?: readonly EditorBlock[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Read-only note: every control is disabled. */
  disabled?: boolean;
  /** Narrow layout: secondary tools move into the "More" menu. */
  compact?: boolean;
  /** Narrowest layout: every text mark moves into the "More" menu too. */
  minimal?: boolean;
  /** Right slot, for example a save status. */
  end?: ReactNode;
  className?: string;
}

export function EditorToolbar({
  textStyle,
  onTextStyleChange,
  marks,
  onToggleMark,
  activeBlocks = [],
  onBlock,
  blocks,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled = false,
  compact = false,
  minimal = false,
  end,
  className,
}: EditorToolbarProps) {
  const { t } = useLocale();
  const inlineMarks = minimal ? [] : compact ? MARKS.slice(0, 2) : MARKS;
  const overflowMarks = minimal ? MARKS : compact ? MARKS.slice(2) : [];
  const available = blocks
    ? BLOCKS.filter((block) => blocks.includes(block.value))
    : BLOCKS;
  const inlineBlocks = compact ? [] : available;

  return (
    <div
      role="toolbar"
      aria-label={t("Formatting")}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex h-toolbar min-w-0 items-center gap-1 bg-background px-3",
        className,
      )}
    >
      <Select
        value={textStyle}
        onValueChange={(value) => onTextStyleChange(value as TextStyle)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={t("Text style")}
          className={cn(
            "shrink-0 border-transparent bg-transparent shadow-none dark:bg-transparent",
            compact ? "w-28" : "w-32",
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_STYLES.map((style) => (
            <SelectItem key={style.value} value={style.value}>
              {t(style.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToolbarSeparator />

      <ToggleGroup
        type="multiple"
        value={[...marks]}
        onValueChange={(next) => {
          const changed = MARKS.find(
            (mark) => marks.includes(mark.value) !== next.includes(mark.value),
          );
          if (changed) onToggleMark(changed.value);
        }}
        disabled={disabled}
        aria-label={t("Text formatting")}
        className="gap-0.5"
      >
        {inlineMarks.map((mark) => (
          <ToolbarTooltip
            key={mark.value}
            label={t(mark.label)}
            shortcut={mark.shortcut}
          >
            <ToggleGroupItem
              value={mark.value}
              aria-label={t(mark.label)}
              className="size-control flex-none rounded-control px-0 first:rounded-control last:rounded-control"
            >
              <mark.icon />
            </ToggleGroupItem>
          </ToolbarTooltip>
        ))}
      </ToggleGroup>

      {inlineBlocks.length > 0 ? (
        <>
          <ToolbarSeparator />
          {inlineBlocks.slice(0, 3).map((block) => (
            <ToolbarButton
              key={block.value}
              label={t(block.label)}
              shortcut={block.shortcut}
              active={activeBlocks.includes(block.value)}
              disabled={disabled}
              onClick={() => onBlock(block.value)}
            >
              <block.icon />
            </ToolbarButton>
          ))}
          <ToolbarSeparator />
          {inlineBlocks.slice(3).map((block) => (
            <ToolbarButton
              key={block.value}
              label={t(block.label)}
              shortcut={block.shortcut}
              active={activeBlocks.includes(block.value)}
              disabled={disabled}
              onClick={() => onBlock(block.value)}
            >
              <block.icon />
            </ToolbarButton>
          ))}
        </>
      ) : null}

      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("More formatting")}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {overflowMarks.map((mark) => (
              <DropdownMenuCheckboxItem
                key={mark.value}
                checked={marks.includes(mark.value)}
                onCheckedChange={() => onToggleMark(mark.value)}
              >
                <mark.icon />
                {t(mark.label)}
                <DropdownMenuShortcut>
                  {shortcutLabel(mark.shortcut).join("")}
                </DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            {available.map((block) => (
              <DropdownMenuItem
                key={block.value}
                onSelect={() => onBlock(block.value)}
              >
                <block.icon />
                {t(block.label)}
                <DropdownMenuShortcut>
                  {shortcutLabel(block.shortcut).join("")}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ToolbarSeparator />

      <ToolbarButton
        label={t("Undo")}
        shortcut="mod+z"
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Undo2Icon />
      </ToolbarButton>
      <ToolbarButton
        label={t("Redo")}
        shortcut="mod+shift+z"
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Redo2Icon />
      </ToolbarButton>

      {end !== undefined ? (
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 pl-2 text-xs text-muted-foreground">
          {end}
        </div>
      ) : null}
    </div>
  );
}
