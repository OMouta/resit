/**
 * Force-directed layout for the workspace graph. Nodes push each other
 * apart, links pull their ends together, and everything drifts towards the
 * centre. Positions are in world units; the view scales and pans them.
 */

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Dragged into place, so the simulation leaves it alone. */
  fixed: boolean;
}

export interface LayoutEdge {
  /** Indices into `nodes`. */
  source: number;
  target: number;
  strength: number;
  length: number;
}

const REPULSION = 900;
const CELL = 90;
/** Nodes further apart than this cannot see each other's repulsion. */
const REPULSION_RANGE = CELL;
const CENTRE_PULL = 0.012;
const VELOCITY_DECAY = 0.82;
const ALPHA_DECAY = 0.018;
export const ALPHA_REST = 0.004;

function key(x: number, y: number): number {
  // Two 16-bit cell coordinates in one number, so the grid is a plain Map.
  return ((x + 32768) << 16) + (y + 32768);
}

export class ForceLayout {
  readonly nodes: LayoutNode[];
  readonly edges: LayoutEdge[];
  alpha = 1;

  constructor(nodes: LayoutNode[], edges: LayoutEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  /** Starts the simulation moving again, after a drag or a change. */
  reheat(alpha = 0.5): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  get settled(): boolean {
    return this.alpha <= ALPHA_REST;
  }

  tick(): void {
    const { nodes, edges, alpha } = this;
    if (nodes.length === 0) return;

    // Only nodes in neighbouring cells repel each other, so a large
    // workspace stays interactive.
    const grid = new Map<number, number[]>();
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]!;
      const cell = key(Math.round(node.x / CELL), Math.round(node.y / CELL));
      const bucket = grid.get(cell);
      if (bucket) bucket.push(index);
      else grid.set(cell, [index]);
    }

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]!;
      const cellX = Math.round(node.x / CELL);
      const cellY = Math.round(node.y / CELL);
      for (let dx = -1; dx <= 1; dx += 1)
        for (let dy = -1; dy <= 1; dy += 1) {
          const bucket = grid.get(key(cellX + dx, cellY + dy));
          if (!bucket) continue;
          for (const other of bucket) {
            if (other <= index) continue;
            const target = nodes[other]!;
            let deltaX = node.x - target.x;
            let deltaY = node.y - target.y;
            let distance = Math.hypot(deltaX, deltaY);
            if (distance > REPULSION_RANGE) continue;
            if (distance < 0.01) {
              // Two nodes in the same spot: nudge them apart deterministically.
              deltaX = (index % 7) - 3 || 1;
              deltaY = (other % 5) - 2 || 1;
              distance = Math.hypot(deltaX, deltaY);
            }
            const push = (REPULSION * alpha) / (distance * distance) / distance;
            node.vx += deltaX * push;
            node.vy += deltaY * push;
            target.vx -= deltaX * push;
            target.vy -= deltaY * push;
          }
        }
    }

    for (const edge of edges) {
      const source = nodes[edge.source];
      const target = nodes[edge.target];
      if (!source || !target) continue;
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.hypot(deltaX, deltaY) || 0.01;
      const pull =
        ((distance - edge.length) / distance) * edge.strength * alpha;
      source.vx += deltaX * pull;
      source.vy += deltaY * pull;
      target.vx -= deltaX * pull;
      target.vy -= deltaY * pull;
    }

    for (const node of nodes) {
      if (node.fixed) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx -= node.x * CENTRE_PULL * alpha;
      node.vy -= node.y * CENTRE_PULL * alpha;
      node.vx *= VELOCITY_DECAY;
      node.vy *= VELOCITY_DECAY;
      node.x += node.vx;
      node.y += node.vy;
    }

    this.alpha *= 1 - ALPHA_DECAY;
    if (this.alpha < ALPHA_REST) this.alpha = ALPHA_REST;
  }

  /** The topmost node under a point in world units, if any. */
  nodeAt(x: number, y: number, slack = 4): LayoutNode | null {
    for (let index = this.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.nodes[index]!;
      if (Math.hypot(node.x - x, node.y - y) <= node.radius + slack)
        return node;
    }
    return null;
  }

  /** The box around every node, for fitting the graph to the view. */
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.nodes) {
      minX = Math.min(minX, node.x - node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }
    if (minX > maxX) return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    return { minX, minY, maxX, maxY };
  }
}

/** A ring of starting positions, so the first ticks have somewhere to go. */
export function seedPositions(nodes: LayoutNode[]): void {
  const golden = Math.PI * (3 - Math.sqrt(5));
  nodes.forEach((node, index) => {
    const radius = 12 * Math.sqrt(index + 1);
    node.x = radius * Math.cos(index * golden);
    node.y = radius * Math.sin(index * golden);
  });
}
