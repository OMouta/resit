import {
  FileTextIcon,
  ImageIcon,
  MaximizeIcon,
  PaperclipIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  WaypointsIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Input } from "@resit/ui/components/input";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import type { ResourceLink } from "../../../shared/ipc";
import {
  SUBJECT_COLOR_VALUES,
  type ResourceKind,
  type SubjectColorValue,
  type WorkspaceSnapshot,
} from "../../../shared/workspace";
import { api } from "../lib/api";
import { ForceLayout, seedPositions, type LayoutNode } from "./graph-layout";

type NodeKind = ResourceKind | "subject";

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  subjectId: string;
  color: SubjectColorValue;
  /** Links to and from this node, not counting its subject. */
  degree: number;
}

/** A line between two nodes, by index into the node list. */
interface GraphEdge {
  source: number;
  target: number;
  /** One note linking to another file, rather than a file's subject. */
  link: boolean;
}

interface Palette {
  subjects: Record<SubjectColorValue, string>;
  edge: string;
  linkEdge: string;
  label: string;
  strongLabel: string;
  ring: string;
  surface: string;
}

const KIND_ICONS: Record<NodeKind, typeof FileTextIcon> = {
  subject: WaypointsIcon,
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
};

/** Lowercase without accents, so "analise" finds "Análise". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string) => styles.getPropertyValue(name).trim();
  const subjects = {} as Record<SubjectColorValue, string>;
  for (const color of SUBJECT_COLOR_VALUES)
    subjects[color] = value(`--subject-${color}`) || "#888888";
  return {
    subjects,
    edge: value("--border-strong") || "#cccccc",
    linkEdge: value("--subtle-foreground") || "#999999",
    label: value("--muted-foreground") || "#777777",
    strongLabel: value("--foreground") || "#111111",
    ring: value("--ring") || "#13795b",
    surface: value("--canvas") || "#ffffff",
  };
}

interface Filters {
  subjects: boolean;
  documents: boolean;
  unlinked: boolean;
}

/** Nodes and edges for the current snapshot, links, and filters. */
function buildGraph(
  snapshot: WorkspaceSnapshot,
  links: ResourceLink[],
  filters: Filters,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const subjects = new Map(
    snapshot.subjects.map((subject) => [subject.id, subject]),
  );
  const degrees = new Map<string, number>();
  const known = new Set(snapshot.resources.map((resource) => resource.id));
  const kept = links.filter(
    (link) => known.has(link.from) && known.has(link.to),
  );
  for (const link of kept) {
    degrees.set(link.from, (degrees.get(link.from) ?? 0) + 1);
    degrees.set(link.to, (degrees.get(link.to) ?? 0) + 1);
  }

  const nodes: GraphNode[] = [];
  const index = new Map<string, number>();
  const add = (node: GraphNode) => {
    index.set(node.id, nodes.length);
    nodes.push(node);
  };

  if (filters.subjects)
    for (const subject of snapshot.subjects)
      add({
        id: `subject:${subject.id}`,
        label: subject.name,
        kind: "subject",
        subjectId: subject.id,
        color: subject.color,
        degree: 0,
      });

  for (const resource of snapshot.resources) {
    if (!filters.documents && resource.kind !== "note") continue;
    const degree = degrees.get(resource.id) ?? 0;
    if (!filters.unlinked && degree === 0) continue;
    add({
      id: resource.id,
      label: resource.title,
      kind: resource.kind,
      subjectId: resource.subjectId,
      color: subjects.get(resource.subjectId)?.color ?? "gray",
      degree,
    });
  }

  const edges: GraphEdge[] = [];
  if (filters.subjects)
    for (const resource of snapshot.resources) {
      const from = index.get(`subject:${resource.subjectId}`);
      const to = index.get(resource.id);
      if (from !== undefined && to !== undefined)
        edges.push({ source: from, target: to, link: false });
    }
  for (const link of kept) {
    const from = index.get(link.from);
    const to = index.get(link.to);
    if (from !== undefined && to !== undefined)
      edges.push({ source: from, target: to, link: true });
  }
  return { nodes, edges };
}

function radiusFor(node: GraphNode): number {
  if (node.kind === "subject") return 11;
  return 4.5 + Math.min(7, Math.sqrt(node.degree) * 2.4);
}

export interface GraphViewProps {
  snapshot: WorkspaceSnapshot;
  onOpenResource: (resourceId: string) => void;
}

/**
 * The workspace as a graph: every subject, note, and document, joined by
 * the links notes make to them. Searching lights up what matches.
 */
export function GraphView({ snapshot, onOpenResource }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [filters, setFilters] = useState<Filters>({
    subjects: true,
    documents: true,
    unlinked: true,
  });
  const [query, setQuery] = useState("");
  const [contentHits, setContentHits] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Links are read once per open and after the workspace changes on disk.
  const reload = useCallback(() => {
    api.listLinks().then(setLinks, () => setLinks([]));
  }, []);
  useEffect(reload, [reload]);
  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "workspace-changed") reload();
      }),
    [reload],
  );

  const { nodes, edges } = useMemo(
    () => buildGraph(snapshot, links, filters),
    [snapshot, links, filters],
  );

  // Text inside notes and PDFs counts as a match too.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setContentHits(new Set());
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.search(text).then(
        (hits) => {
          if (!cancelled)
            setContentHits(new Set(hits.map((hit) => hit.resourceId)));
        },
        () => undefined,
      );
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const subjectNames = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s.name])),
    [snapshot.subjects],
  );

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const found = new Set<string>();
    for (const node of nodes) {
      const haystack = fold(
        `${node.label} ${subjectNames.get(node.subjectId) ?? ""}`,
      );
      if (
        words.every((word) => haystack.includes(word)) ||
        contentHits.has(node.id)
      )
        found.add(node.id);
    }
    return found;
  }, [nodes, query, contentHits, subjectNames]);

  // Positions survive filter changes and new files, so the map stays put.
  const placed = useRef(
    new Map<string, { x: number; y: number; fixed: boolean }>(),
  );
  const layout = useMemo(() => {
    const layoutNodes: LayoutNode[] = nodes.map((node) => ({
      id: node.id,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: radiusFor(node),
      fixed: false,
    }));
    seedPositions(layoutNodes);
    for (const node of layoutNodes) {
      const saved = placed.current.get(node.id);
      if (saved) {
        node.x = saved.x;
        node.y = saved.y;
        node.fixed = saved.fixed;
      }
    }
    return new ForceLayout(
      layoutNodes,
      edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        strength: edge.link ? 0.14 : 0.05,
        length: edge.link ? 150 : 80,
      })),
    );
  }, [nodes, edges]);

  const view = useRef({ x: 0, y: 0, scale: 1 });
  const palette = useRef<Palette>(readPalette());
  const hovered = useRef<string | null>(null);
  const dirty = useRef(true);
  const state = useRef({ nodes, matches, selectedId, edges });
  state.current = { nodes, matches, selectedId, edges };

  /** Neighbours of a node, by id, for highlighting and the details panel. */
  const neighbours = useCallback((id: string) => {
    const found = new Set<string>();
    const current = state.current;
    const at = current.nodes.findIndex((node) => node.id === id);
    if (at === -1) return found;
    for (const edge of current.edges) {
      if (edge.source === at) found.add(current.nodes[edge.target]!.id);
      else if (edge.target === at) found.add(current.nodes[edge.source]!.id);
    }
    return found;
  }, []);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const box = layout.bounds();
    // A small graph sits at its own size rather than filling the window.
    const scale = Math.min(
      1.3,
      Math.max(
        0.12,
        Math.min(
          (width - 120) / Math.max(1, box.maxX - box.minX),
          (height - 120) / Math.max(1, box.maxY - box.minY),
        ),
      ),
    );
    view.current = {
      scale,
      x: width / 2 - ((box.minX + box.maxX) / 2) * scale,
      y: height / 2 - ((box.minY + box.maxY) / 2) * scale,
    };
    dirty.current = true;
  }, [layout]);

  // Draw loop. It idles once the simulation settles and nothing changed.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let frame = 0;
    let fitted = false;

    const draw = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      const colors = palette.current;
      const {
        nodes: data,
        matches: found,
        selectedId: selected,
      } = state.current;
      const { x: panX, y: panY, scale } = view.current;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.translate(panX, panY);
      context.scale(scale, scale);

      const near = hovered.current ? neighbours(hovered.current) : null;
      const visible = (id: string): number => {
        if (near) return id === hovered.current || near.has(id) ? 1 : 0.12;
        if (found) return found.has(id) ? 1 : 0.12;
        return 1;
      };

      layout.edges.forEach((edge, index) => {
        const source = layout.nodes[edge.source];
        const target = layout.nodes[edge.target];
        if (!source || !target) return;
        const isLink = state.current.edges[index]?.link ?? false;
        const alpha =
          Math.min(visible(source.id), visible(target.id)) *
          (isLink ? 0.7 : 0.35);
        context.globalAlpha = alpha;
        context.strokeStyle = isLink ? colors.linkEdge : colors.edge;
        context.lineWidth = (isLink ? 1.2 : 0.8) / scale;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
      });

      const font = getComputedStyle(document.body).fontFamily;
      data.forEach((node, index) => {
        const position = layout.nodes[index];
        if (!position) return;
        const alpha = visible(node.id);
        context.globalAlpha = alpha;
        context.fillStyle = colors.subjects[node.color];
        context.beginPath();
        context.arc(position.x, position.y, position.radius, 0, Math.PI * 2);
        context.fill();
        if (node.kind !== "subject") {
          context.globalAlpha = alpha * 0.35;
          context.fillStyle = colors.surface;
          context.beginPath();
          context.arc(
            position.x,
            position.y,
            Math.max(1, position.radius - 2.2),
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        if (node.id === selected || node.id === hovered.current) {
          context.globalAlpha = 1;
          context.strokeStyle = colors.ring;
          context.lineWidth = 2 / scale;
          context.beginPath();
          context.arc(
            position.x,
            position.y,
            position.radius + 3.5 / scale,
            0,
            Math.PI * 2,
          );
          context.stroke();
        }

        const labelled =
          node.kind === "subject" ||
          scale > 0.75 ||
          node.id === selected ||
          node.id === hovered.current ||
          (near?.has(node.id) ?? false) ||
          (found?.has(node.id) ?? false);
        if (!labelled) return;
        const size = node.kind === "subject" ? 12 : 11;
        context.globalAlpha = alpha;
        context.font = `${node.kind === "subject" ? "600 " : ""}${size / scale}px ${font}`;
        context.fillStyle =
          node.kind === "subject" ? colors.strongLabel : colors.label;
        context.textAlign = "center";
        context.textBaseline = "top";
        const label =
          node.label.length > 36 ? `${node.label.slice(0, 35)}…` : node.label;
        context.fillText(
          label,
          position.x,
          position.y + position.radius + 4 / scale,
        );
      });
      context.globalAlpha = 1;
    };

    const remember = () => {
      for (const node of layout.nodes)
        placed.current.set(node.id, {
          x: node.x,
          y: node.y,
          fixed: node.fixed,
        });
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (canvas.offsetParent === null) return;
      if (!fitted && canvas.clientWidth > 0) {
        // Settle the graph before the first look at it, so it opens in
        // place instead of drifting across the view.
        for (let step = 0; step < 600 && !layout.settled; step += 1)
          layout.tick();
        remember();
        fit();
        fitted = true;
      }
      if (!layout.settled) {
        layout.tick();
        remember();
        draw();
      } else if (dirty.current) {
        draw();
        dirty.current = false;
      }
    };
    frame = requestAnimationFrame(loop);

    const resize = new ResizeObserver(() => {
      dirty.current = true;
    });
    resize.observe(wrap);

    // Colours come from the stylesheet, so they change with the theme.
    const themes = new MutationObserver(() => {
      palette.current = readPalette();
      dirty.current = true;
    });
    themes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      themes.disconnect();
    };
  }, [layout, fit, neighbours]);

  useEffect(() => {
    dirty.current = true;
  }, [selectedId, matches]);

  /** Canvas pixels to world units. */
  const toWorld = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    const { x, y, scale } = view.current;
    return {
      x: (event.clientX - box.left - x) / scale,
      y: (event.clientY - box.top - y) / scale,
    };
  };

  const drag = useRef<{
    node: LayoutNode | null;
    pointerX: number;
    pointerY: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const at = toWorld(event);
    const node = layout.nodeAt(at.x, at.y);
    drag.current = {
      node,
      pointerX: event.clientX,
      pointerY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (node) {
      node.fixed = true;
      layout.reheat(0.3);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current) {
      const at = toWorld(event);
      const node = layout.nodeAt(at.x, at.y);
      const id = node?.id ?? null;
      if (id !== hovered.current) {
        hovered.current = id;
        dirty.current = true;
      }
      return;
    }
    const dx = event.clientX - current.pointerX;
    const dy = event.clientY - current.pointerY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) current.moved = true;
    current.pointerX = event.clientX;
    current.pointerY = event.clientY;
    if (current.node) {
      current.node.x += dx / view.current.scale;
      current.node.y += dy / view.current.scale;
      layout.reheat(0.2);
    } else {
      view.current.x += dx;
      view.current.y += dy;
    }
    dirty.current = true;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current || current.moved) return;
    setSelectedId(current.node ? current.node.id : null);
  };

  const zoomBy = (factor: number, aroundX?: number, aroundY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const originX = aroundX ?? box.left + box.width / 2;
    const originY = aroundY ?? box.top + box.height / 2;
    const { x, y, scale } = view.current;
    const next = Math.min(4, Math.max(0.12, scale * factor));
    const pointerX = originX - box.left;
    const pointerY = originY - box.top;
    view.current = {
      scale: next,
      x: pointerX - ((pointerX - x) / scale) * next,
      y: pointerY - ((pointerY - y) / scale) * next,
    };
    dirty.current = true;
  };

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedNeighbours = selected
    ? [...neighbours(selected.id)]
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is GraphNode => Boolean(node))
    : [];

  const open = (node: GraphNode) => {
    if (node.kind !== "subject") onOpenResource(node.id);
  };

  const matchCount = matches?.size ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        role="toolbar"
        aria-label="Graph tools"
        className="flex h-toolbar shrink-0 items-center gap-2 border-b bg-background px-3"
      >
        <div className="relative w-full max-w-80">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            aria-label="Search the graph"
            placeholder="Search notes, PDFs, and subjects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
              if (event.key !== "Enter" || !matches) return;
              const first = nodes.find(
                (node) => matches.has(node.id) && node.kind !== "subject",
              );
              if (first) open(first);
            }}
            className="h-control pl-8"
          />
        </div>
        {query.trim() ? (
          <span className="text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle" size="icon" aria-label="What to show">
                <SlidersHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filters.subjects}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({ ...current, subjects: checked }))
                }
              >
                Subjects
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.documents}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({ ...current, documents: checked }))
                }
              >
                PDFs and other files
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.unlinked}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({ ...current, unlinked: checked }))
                }
              >
                Files nothing links to
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
            <ZoomOutIcon />
          </ToolbarButton>
          <ToolbarButton label="Zoom in" onClick={() => zoomBy(1.25)}>
            <ZoomInIcon />
          </ToolbarButton>
          <ToolbarButton label="Fit to view" onClick={fit}>
            <MaximizeIcon />
          </ToolbarButton>
        </div>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 bg-canvas">
        <canvas
          ref={canvasRef}
          aria-label={`Workspace graph: ${nodes.length} nodes, ${edges.length} connections`}
          className="absolute inset-0 size-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            if (hovered.current) {
              hovered.current = null;
              dirty.current = true;
            }
          }}
          onDoubleClick={(event) => {
            const at = toWorld(event);
            const hit = layout.nodeAt(at.x, at.y);
            const node = hit
              ? nodes.find((entry) => entry.id === hit.id)
              : undefined;
            if (node) open(node);
            else fit();
          }}
          onWheel={(event) => {
            zoomBy(
              Math.exp(-event.deltaY * 0.0015),
              event.clientX,
              event.clientY,
            );
          }}
        />
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState
              icon={<WaypointsIcon />}
              title="Nothing to show yet"
              description="Add notes and files, or turn some of them back on in the show menu."
            />
          </div>
        ) : null}
        {selected ? (
          <aside className="absolute bottom-4 left-4 flex w-72 flex-col gap-3 rounded-panel border bg-popover p-3 shadow-md">
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-1 size-2.5 shrink-0 rounded-full",
                  subjectColorClasses[selected.color].dot,
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className="truncate text-sm font-medium"
                  title={selected.label}
                >
                  {selected.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.kind === "subject"
                    ? "Subject"
                    : (subjectNames.get(selected.subjectId) ?? "No subject")}
                </span>
              </div>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="Close details"
                onClick={() => setSelectedId(null)}
              >
                <XIcon />
              </Button>
            </div>
            {selected.kind === "subject" ? null : (
              <Button size="sm" onClick={() => open(selected)}>
                Open
              </Button>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                Connected ({selectedNeighbours.length})
              </span>
              <div className="flex max-h-40 flex-col gap-px overflow-y-auto">
                {selectedNeighbours.length === 0 ? (
                  <p className="py-1 text-xs text-muted-foreground">
                    Nothing links here yet. Quote this in a note to connect it.
                  </p>
                ) : null}
                {selectedNeighbours.map((node) => {
                  const Icon = KIND_ICONS[node.kind];
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      onDoubleClick={() => open(node)}
                      className="flex h-row items-center gap-2 rounded-md px-1.5 text-left text-xs hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <Icon className="size-3.5 shrink-0 text-subtle-foreground" />
                      <span className="truncate">{node.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
