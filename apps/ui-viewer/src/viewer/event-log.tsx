import { Button } from "@resit/ui/components/button";
import { cn } from "@resit/ui/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface LoggedEvent {
  id: number;
  at: Date;
  source: string;
  event: string;
  payload?: unknown;
}

interface EventLogValue {
  events: LoggedEvent[];
  log: (source: string, event: string, payload?: unknown) => void;
  clear: () => void;
}

const EventLogContext = createContext<EventLogValue | null>(null);
let nextId = 1;

export function EventLogProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const log = useCallback<EventLogValue["log"]>((source, event, payload) => {
    setEvents((previous) => {
      const entry: LoggedEvent = {
        id: nextId++,
        at: new Date(),
        source,
        event,
      };
      if (payload !== undefined) entry.payload = payload;
      return [entry, ...previous].slice(0, 200);
    });
  }, []);
  const clear = useCallback(() => setEvents([]), []);
  const value = useMemo(() => ({ events, log, clear }), [events, log, clear]);
  return (
    <EventLogContext.Provider value={value}>
      {children}
    </EventLogContext.Provider>
  );
}

export function useEventLog(): EventLogValue {
  const context = useContext(EventLogContext);
  if (!context) throw new Error("useEventLog requires EventLogProvider");
  return context;
}

function formatPayload(payload: unknown): string {
  if (payload === undefined) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

/** Panel listing callback invocations from the open examples, newest first. */
export function EventLogPanel({ className }: { className?: string }) {
  const { events, clear } = useEventLog();
  return (
    <section
      aria-label="Event log"
      className={cn("flex h-full flex-col bg-sidebar text-sm", className)}
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Events{events.length > 0 ? ` (${events.length})` : ""}
        </span>
        <Button
          variant="subtle"
          size="sm"
          onClick={clear}
          disabled={!events.length}
        >
          Clear
        </Button>
      </header>
      <ol className="scrollbar-thin flex-1 overflow-auto font-mono text-xs">
        {events.length === 0 ? (
          <li className="px-3 py-4 text-subtle-foreground">
            Interact with an example to see its callbacks here.
          </li>
        ) : null}
        {events.map((entry) => (
          <li
            key={entry.id}
            className="grid grid-cols-[auto_1fr] gap-x-2 border-b border-border/60 px-3 py-1.5"
          >
            <span className="text-subtle-foreground">
              {entry.at.toLocaleTimeString("en-GB", { hour12: false })}
            </span>
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{entry.source} · </span>
              <span className="font-medium text-foreground">{entry.event}</span>
              {entry.payload !== undefined ? (
                <span className="text-muted-foreground">
                  {" "}
                  {formatPayload(entry.payload)}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
