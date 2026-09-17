import { useCallback, type KeyboardEvent, type RefObject } from "react";

export interface RovingFocusOptions {
  /** Selector for focusable items inside the container. */
  itemSelector: string;
  orientation?: "vertical" | "horizontal";
  /** Wrap from last to first and back. */
  loop?: boolean;
  /** Called for Right/Left in vertical lists (tree expand/collapse). */
  onExpand?: (item: HTMLElement) => void;
  onCollapse?: (item: HTMLElement) => void;
  /** Jump to an item by typing its first letters. */
  typeahead?: boolean;
}

/**
 * Arrow-key navigation for lists, trees, and tab strips. The container keeps a
 * single tab stop: only the current item has tabIndex 0, others -1. Callers
 * render `tabIndex` themselves; this hook moves focus and updates tabIndex.
 */
export function useRovingFocus(
  containerRef: RefObject<HTMLElement | null>,
  options: RovingFocusOptions,
) {
  const {
    itemSelector,
    orientation = "vertical",
    loop = false,
    onExpand,
    onCollapse,
    typeahead = true,
  } = options;

  const focusItem = useCallback((items: HTMLElement[], index: number) => {
    const target = items[index];
    if (!target) return;
    for (const item of items) item.tabIndex = item === target ? 0 : -1;
    target.focus();
    target.scrollIntoView?.({ block: "nearest" });
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(itemSelector),
      ).filter((item) => !item.hasAttribute("disabled") && item.offsetParent);
      const current = items.findIndex((item) =>
        item.contains(document.activeElement),
      );
      if (current === -1) return;

      const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const previous = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const expand = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
      const collapse = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";

      switch (event.key) {
        case next: {
          event.preventDefault();
          const index = current + 1;
          focusItem(
            items,
            index >= items.length ? (loop ? 0 : current) : index,
          );
          return;
        }
        case previous: {
          event.preventDefault();
          const index = current - 1;
          focusItem(
            items,
            index < 0 ? (loop ? items.length - 1 : current) : index,
          );
          return;
        }
        case "Home":
          event.preventDefault();
          focusItem(items, 0);
          return;
        case "End":
          event.preventDefault();
          focusItem(items, items.length - 1);
          return;
        case expand: {
          const item = items[current];
          if (item && onExpand) {
            event.preventDefault();
            onExpand(item);
          }
          return;
        }
        case collapse: {
          const item = items[current];
          if (item && onCollapse) {
            event.preventDefault();
            onCollapse(item);
          }
          return;
        }
        default: {
          if (
            !typeahead ||
            event.key.length !== 1 ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          )
            return;
          const letter = event.key.toLowerCase();
          const ordered = [
            ...items.slice(current + 1),
            ...items.slice(0, current + 1),
          ];
          const match = ordered.find((item) =>
            (item.dataset.typeahead ?? item.textContent ?? "")
              .trim()
              .toLowerCase()
              .startsWith(letter),
          );
          if (match) {
            event.preventDefault();
            focusItem(items, items.indexOf(match));
          }
        }
      }
    },
    [
      containerRef,
      itemSelector,
      orientation,
      loop,
      onExpand,
      onCollapse,
      typeahead,
      focusItem,
    ],
  );

  return { onKeyDown };
}
