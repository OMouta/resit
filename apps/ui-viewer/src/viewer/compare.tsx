import { Label } from "@resit/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { cn } from "@resit/ui/lib/utils";
import { useState, type ReactNode } from "react";

import type { ReferenceImage } from "../references/manifest";

/**
 * Reference beside a live example. "Side by side" is the default; "Overlay"
 * draws the reference over the example with an opacity slider to spot
 * spacing and alignment differences.
 */
export function ReferenceCompare({
  reference,
  children,
}: {
  reference: ReferenceImage;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [opacity, setOpacity] = useState(50);
  const image = (
    <img
      src={`/references/${reference.file}`}
      alt={reference.title}
      className="block h-auto w-full"
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={mode}
          onValueChange={(next) => setMode(next as typeof mode)}
        >
          <TabsList aria-label="Comparison mode">
            <TabsTrigger value="side">Side by side</TabsTrigger>
            <TabsTrigger value="overlay">Overlay</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "overlay" ? (
          <div className="flex items-center gap-2">
            <Label
              htmlFor="compare-opacity"
              className="text-xs text-muted-foreground"
            >
              Reference opacity
            </Label>
            <input
              id="compare-opacity"
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
              className="accent-primary"
            />
            <span className="w-8 font-mono text-xs text-muted-foreground">
              {opacity}%
            </span>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {reference.title} · {reference.source}
        </p>
      </div>
      {mode === "side" ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <div className="overflow-auto rounded-lg border">{children}</div>
          <div className="overflow-auto rounded-lg border bg-muted">
            {image}
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border">
          {children}
          <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-0")}
            style={{ opacity: opacity / 100 }}
          >
            {image}
          </div>
        </div>
      )}
    </div>
  );
}
