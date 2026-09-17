import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Switch } from "@resit/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { cn } from "@resit/ui/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  RotateCcwIcon,
  SplitIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useEventLog } from "./event-log";
import { pagePath } from "./registry";
import { useSettings } from "./settings";
import type {
  ControlValue,
  Example,
  ExampleContext,
  ExampleControl,
  RegisteredPage,
} from "./types";

function readControl(
  control: ExampleControl,
  raw: string | null,
): ControlValue {
  if (raw === null) return control.default;
  switch (control.type) {
    case "boolean":
      return raw === "true";
    case "number": {
      const value = Number(raw);
      return Number.isFinite(value) ? value : control.default;
    }
    case "select":
      return control.options.includes(raw) ? raw : control.default;
    case "text":
      return raw;
  }
}

/**
 * Per-example state and control values are URL search params prefixed with
 * the example id, so a link opens the exact variant: ?button.state=loading
 */
export function useExampleParams(example: Example) {
  const [params, setParams] = useSearchParams();
  const prefix = `${example.id}.`;
  const defaultState = example.states?.[0] ?? "default";
  const rawState = params.get(`${prefix}state`);
  const state =
    rawState && example.states?.includes(rawState) ? rawState : defaultState;
  const controls = useMemo(() => {
    const values: Record<string, ControlValue> = {};
    for (const [name, control] of Object.entries(example.controls ?? {})) {
      values[name] = readControl(control, params.get(`${prefix}${name}`));
    }
    return values;
  }, [example.controls, params, prefix]);

  const update = useCallback(
    (name: string, value: ControlValue | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const key = `${prefix}${name}`;
          if (value === null) next.delete(key);
          else next.set(key, String(value));
          return next;
        },
        { replace: true },
      );
    },
    [prefix, setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of Array.from(next.keys())) {
          if (key.startsWith(prefix)) next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }, [prefix, setParams]);

  return { state, controls, update, reset, defaultState };
}

function ControlField({
  name,
  control,
  value,
  onChange,
}: {
  name: string;
  control: ExampleControl;
  value: ControlValue;
  onChange: (value: ControlValue | null) => void;
}) {
  const id = `control-${name}`;
  const label = control.label ?? name;
  switch (control.type) {
    case "select":
      return (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Select
            value={String(value)}
            onValueChange={(next) =>
              onChange(next === control.default ? null : next)
            }
          >
            <SelectTrigger id={id} size="sm" className="min-w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {control.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(next) =>
              onChange(next === control.default ? null : next)
            }
          />
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
        </div>
      );
    case "text":
      return (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Input
            id={id}
            className="h-6 w-40 text-xs"
            value={String(value)}
            onChange={(event) =>
              onChange(
                event.target.value === control.default
                  ? null
                  : event.target.value,
              )
            }
          />
        </div>
      );
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Input
            id={id}
            type="number"
            className="h-6 w-20 text-xs"
            value={String(value)}
            min={control.min}
            max={control.max}
            step={control.step}
            onChange={(event) => {
              const next = Number(event.target.value);
              onChange(next === control.default ? null : next);
            }}
          />
        </div>
      );
  }
}

function CopyLinkButton({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label="Copy link to this example"
          onClick={() => {
            void navigator.clipboard
              .writeText(new URL(href, window.location.href).href)
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              });
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy link</TooltipContent>
    </Tooltip>
  );
}

export function SourceLink({ path }: { path: string }) {
  const absolute = `${__REPO_ROOT__}${path}`.replace(/\\/g, "/");
  return (
    <a
      href={`vscode://file/${absolute}`}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      {path}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

export function ExampleFrame({
  page,
  example,
  isolated = false,
  compareSlot,
}: {
  page: RegisteredPage;
  example: Example;
  /** True on the single-example route: shows the frame without the page chrome. */
  isolated?: boolean;
  /** Rendered beside the example on the compare route. */
  compareSlot?: React.ReactNode;
}) {
  const settings = useSettings();
  const { log } = useEventLog();
  const { state, controls, update, reset, defaultState } =
    useExampleParams(example);
  const [resetKey, setResetKey] = useState(0);
  const [search] = useSearchParams();

  const context: ExampleContext = {
    state,
    controls,
    log: (event, payload) => log(`${page.slug}/${example.id}`, event, payload),
    theme: settings.resolvedTheme,
    locale: settings.locale,
    viewport: settings.viewport,
    resetKey,
  };

  const isolatedHref = `${pagePath(page, example.id)}?${search.toString()}`;
  const frameWidth =
    typeof example.width === "number"
      ? example.width
      : (settings.viewport ?? undefined);

  const hasControls =
    (example.states && example.states.length > 0) ||
    Object.keys(example.controls ?? {}).length > 0;

  const fixedHeight = example.height !== undefined;
  const frame = (
    <div
      className={cn(
        "canvas-dots relative flex rounded-panel border p-4 sm:p-6",
        isolated ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto",
        example.width === "auto" ? "justify-center" : "",
      )}
      data-example-frame={example.id}
      data-state={state}
    >
      <div
        key={`${resetKey}-${settings.viewport ?? "fill"}`}
        className={cn(
          "overflow-hidden rounded-lg shadow-sm",
          example.width !== "auto" && "@container",
          example.surface === "sidebar" && "bg-sidebar",
          example.surface === "muted" && "bg-muted",
          (!example.surface || example.surface === "background") &&
            "bg-background",
          example.width === "auto" ? "w-max max-w-full p-4" : "w-full",
          example.width === "full" && !fixedHeight ? "p-4" : "",
          fixedHeight ? "flex flex-col overflow-auto" : "",
          isolated && !fixedHeight ? "min-h-full" : "",
        )}
        style={{
          width: frameWidth ? `min(100%, ${frameWidth}px)` : undefined,
          height: example.height,
          marginInline: frameWidth ? "auto" : undefined,
        }}
      >
        {example.render(context)}
      </div>
    </div>
  );

  return (
    <section
      id={example.id}
      aria-labelledby={`${example.id}-title`}
      className={cn("flex flex-col gap-3", isolated && "h-full")}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id={`${example.id}-title`}
            className="text-lg font-semibold tracking-tight"
          >
            {isolated ? (
              example.title
            ) : (
              <Link
                to={isolatedHref}
                className="hover:underline"
                title="Open this example on its own"
              >
                {example.title}
              </Link>
            )}
          </h3>
          {example.description ? (
            <p className="text-sm text-muted-foreground">
              {example.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <CopyLinkButton href={isolatedHref} />
          {!isolated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="subtle" size="icon-sm" asChild>
                  <Link to={isolatedHref} aria-label="Open example on its own">
                    <Maximize2Icon />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open on its own</TooltipContent>
            </Tooltip>
          ) : null}
          {example.reference ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="subtle" size="icon-sm" asChild>
                  <Link
                    to={`${pagePath(page, example.id)}?${new URLSearchParams({ ...Object.fromEntries(search), compare: example.reference }).toString()}`}
                    aria-label="Compare with reference"
                  >
                    <SplitIcon />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Compare with reference</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="Reset example"
                onClick={() => {
                  reset();
                  setResetKey((key) => key + 1);
                }}
              >
                <RotateCcwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {hasControls ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {example.states && example.states.length > 0 ? (
            <Tabs
              value={state}
              onValueChange={(next) =>
                update("state", next === defaultState ? null : next)
              }
            >
              <TabsList aria-label="Example state">
                {example.states.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          {Object.entries(example.controls ?? {}).map(([name, control]) => (
            <ControlField
              key={name}
              name={name}
              control={control}
              value={controls[name] ?? control.default}
              onChange={(value) => update(name, value)}
            />
          ))}
        </div>
      ) : null}

      {compareSlot ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          {frame}
          {compareSlot}
        </div>
      ) : (
        frame
      )}
    </section>
  );
}
