import type { LiveContext } from "../shared/context";

/** What the window last reported it was showing. */
let live: LiveContext | null = null;

export function setLiveContext(next: LiveContext | null): void {
  live = next;
}

export function liveContext(): LiveContext | null {
  return live;
}
