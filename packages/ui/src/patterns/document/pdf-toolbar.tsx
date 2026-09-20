import {
  HighlighterIcon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  MousePointer2Icon,
  PanelLeftIcon,
  RotateCwIcon,
  SearchIcon,
  SquareDashedIcon,
  UnderlineIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { cn } from "@resit/ui/lib/utils";
import { PageControls } from "@resit/ui/patterns/document/page-controls";
import {
  ToolbarButton,
  ToolbarSeparator,
} from "@resit/ui/patterns/document/toolbar-button";

export type PdfZoom = "fit-width" | "fit-page" | number;
export type AnnotationTool =
  "select" | "highlight" | "underline" | "region" | "comment";
export type AnnotationColor = "yellow" | "green" | "blue" | "pink";

export const annotationColorClasses: Record<
  AnnotationColor,
  { swatch: string; fill: string; label: string }
> = {
  yellow: {
    swatch: "bg-subject-yellow",
    fill: "bg-subject-yellow/35",
    label: "Yellow",
  },
  green: {
    swatch: "bg-subject-green",
    fill: "bg-subject-green/35",
    label: "Green",
  },
  blue: {
    swatch: "bg-subject-blue",
    fill: "bg-subject-blue/35",
    label: "Blue",
  },
  pink: {
    swatch: "bg-subject-pink",
    fill: "bg-subject-pink/35",
    label: "Pink",
  },
};

const tools: {
  id: AnnotationTool;
  label: string;
  icon: typeof MousePointer2Icon;
  key: string;
}[] = [
  { id: "select", label: "Select", icon: MousePointer2Icon, key: "V" },
  { id: "highlight", label: "Highlight", icon: HighlighterIcon, key: "H" },
  { id: "underline", label: "Underline", icon: UnderlineIcon, key: "U" },
  { id: "region", label: "Region", icon: SquareDashedIcon, key: "R" },
  { id: "comment", label: "Comment", icon: MessageSquarePlusIcon, key: "C" },
];

const zoomOptions: { value: string; label: string }[] = [
  { value: "fit-width", label: "Fit width" },
  { value: "fit-page", label: "Fit page" },
  ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((zoom) => ({
    value: String(zoom),
    label: `${Math.round(zoom * 100)}%`,
  })),
];

export interface PdfToolbarProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  zoom: PdfZoom;
  onZoomChange: (zoom: PdfZoom) => void;
  onRotate?: () => void;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Annotation tools are shown only when all four are given. */
  tool?: AnnotationTool;
  onToolChange?: (tool: AnnotationTool) => void;
  color?: AnnotationColor;
  onColorChange?: (color: AnnotationColor) => void;
  /** Collapses zoom, rotate, and colour into an overflow menu. */
  compact?: boolean;
  disabled?: boolean;
  end?: ReactNode;
  className?: string;
}

function zoomToValue(zoom: PdfZoom): string {
  return typeof zoom === "number" ? String(zoom) : zoom;
}

function valueToZoom(value: string): PdfZoom {
  return value === "fit-width" || value === "fit-page" ? value : Number(value);
}

/** Toolbar above a PDF: page, zoom, rotate, search, sidebar, annotation tools. */
export function PdfToolbar({
  page,
  pageCount,
  onPageChange,
  zoom,
  onZoomChange,
  onRotate,
  searchOpen,
  onToggleSearch,
  sidebarOpen,
  onToggleSidebar,
  tool,
  onToolChange,
  color,
  onColorChange,
  compact = false,
  disabled = false,
  end,
  className,
}: PdfToolbarProps) {
  const zoomNumber = typeof zoom === "number" ? zoom : 1;
  const annotation =
    tool && onToolChange && color && onColorChange
      ? { tool, onToolChange, color, onColorChange }
      : null;
  const colors = annotationColorClasses[color ?? "yellow"];
  return (
    <div
      role="toolbar"
      aria-label="PDF tools"
      className={cn(
        "flex h-toolbar min-w-0 items-center gap-1 border-b bg-background px-3 @container",
        className,
      )}
    >
      {onToggleSidebar ? (
        <ToolbarButton
          label="Side panel"
          active={sidebarOpen}
          onClick={onToggleSidebar}
          disabled={disabled}
        >
          <PanelLeftIcon />
        </ToolbarButton>
      ) : null}
      <PageControls
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        disabled={disabled}
      />
      <ToolbarSeparator />
      {!compact ? (
        <>
          <ToolbarButton
            label="Zoom out"
            shortcut="Mod+-"
            disabled={disabled || zoomNumber <= 0.5}
            onClick={() =>
              onZoomChange(
                Math.max(0.5, Math.round((zoomNumber - 0.25) * 100) / 100),
              )
            }
          >
            <ZoomOutIcon />
          </ToolbarButton>
          <Select
            value={zoomToValue(zoom)}
            onValueChange={(value) => onZoomChange(valueToZoom(value))}
            disabled={disabled}
          >
            <SelectTrigger size="sm" aria-label="Zoom" className="w-[6.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zoomOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToolbarButton
            label="Zoom in"
            shortcut="Mod+="
            disabled={disabled || zoomNumber >= 2}
            onClick={() =>
              onZoomChange(
                Math.min(2, Math.round((zoomNumber + 0.25) * 100) / 100),
              )
            }
          >
            <ZoomInIcon />
          </ToolbarButton>
          {onRotate ? (
            <ToolbarButton
              label="Rotate"
              onClick={onRotate}
              disabled={disabled}
            >
              <RotateCwIcon />
            </ToolbarButton>
          ) : null}
          <ToolbarSeparator />
        </>
      ) : null}
      {onToggleSearch ? (
        <ToolbarButton
          label="Search in document"
          shortcut="Mod+F"
          active={searchOpen}
          onClick={onToggleSearch}
          disabled={disabled}
        >
          <SearchIcon />
        </ToolbarButton>
      ) : null}
      {annotation ? (
        <ToggleGroup
          type="single"
          value={annotation.tool}
          onValueChange={(value) =>
            value && annotation.onToolChange(value as AnnotationTool)
          }
          aria-label="Annotation tool"
          disabled={disabled}
          className="ml-auto"
        >
          {tools.map(({ id, label, icon: Icon, key }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={id}
                  aria-label={label}
                  className="px-0 [&_svg]:size-4"
                >
                  <Icon />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                {label} · {key}
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      ) : (
        <div className="ml-auto" />
      )}
      {!compact ? (
        annotation ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Annotation colour: ${colors.label}`}
                    disabled={disabled}
                    className="ml-1 flex size-8 items-center justify-center rounded-control hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        "size-4 rounded-full shadow-hairline",
                        colors.swatch,
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Colour: {colors.label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Annotation colour</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={annotation.color}
                onValueChange={(value) =>
                  annotation.onColorChange(value as AnnotationColor)
                }
              >
                {(Object.keys(annotationColorClasses) as AnnotationColor[]).map(
                  (key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      <span
                        className={cn(
                          "size-3 rounded-full",
                          annotationColorClasses[key].swatch,
                        )}
                      />
                      {annotationColorClasses[key].label}
                    </DropdownMenuRadioItem>
                  ),
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More tools"
              disabled={disabled}
              className="ml-1 flex size-8 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:shadow-focus focus-visible:outline-none"
            >
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Zoom</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={zoomToValue(zoom)}
              onValueChange={(value) => onZoomChange(valueToZoom(value))}
            >
              {zoomOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {onRotate ? (
              <DropdownMenuItem onSelect={onRotate}>
                <RotateCwIcon /> Rotate
              </DropdownMenuItem>
            ) : null}
            {annotation ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Annotation colour</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={annotation.color}
                  onValueChange={(value) =>
                    annotation.onColorChange(value as AnnotationColor)
                  }
                >
                  {(
                    Object.keys(annotationColorClasses) as AnnotationColor[]
                  ).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      <span
                        className={cn(
                          "size-3 rounded-full",
                          annotationColorClasses[key].swatch,
                        )}
                      />
                      {annotationColorClasses[key].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {end}
    </div>
  );
}
