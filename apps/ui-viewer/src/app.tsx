import { Button } from "@resit/ui/components/button";
import { Kbd } from "@resit/ui/components/kbd";
import { Label } from "@resit/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Switch } from "@resit/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import {
  LocaleProvider,
  LOCALES,
  type Locale,
} from "@resit/ui/hooks/use-locale";
import { THEMES, type Theme } from "@resit/ui/lib/theme";
import { cn } from "@resit/ui/lib/utils";
import {
  ListIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { EventLogPanel, EventLogProvider } from "./viewer/event-log";
import { pagePath, pages } from "./viewer/registry";
import { ViewerSearch } from "./viewer/search";
import { SettingsProvider, useSettings, VIEWPORTS } from "./viewer/settings";
import { SECTIONS } from "./viewer/types";

function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-linear-to-b from-primary-top to-primary-bottom text-sm font-semibold text-white shadow-primary"
    >
      r
    </span>
  );
}

function SidebarNav({
  filter,
  onNavigate,
}: {
  filter: string;
  onNavigate?: () => void;
}) {
  const query = filter.trim().toLowerCase();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-7 items-center rounded-md px-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground",
      isActive && "bg-accent font-medium text-foreground",
    );

  return (
    <nav aria-label="Viewer pages" className="flex flex-col gap-5 px-2 pb-6">
      {SECTIONS.map((section) => {
        const list = pages.filter(
          (page) =>
            page.section === section &&
            (!query ||
              page.title.toLowerCase().includes(query) ||
              page.group?.toLowerCase().includes(query) ||
              page.keywords?.some((keyword) =>
                keyword.toLowerCase().includes(query),
              )),
        );
        if (list.length === 0) return null;
        const groups = new Map<string, typeof list>();
        for (const page of list) {
          const key = page.group ?? "";
          groups.set(key, [...(groups.get(key) ?? []), page]);
        }
        return (
          <div key={section}>
            <NavLink
              to={`/${section}`}
              end
              onClick={onNavigate}
              className="flex h-7 items-center px-2 text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase hover:text-foreground"
            >
              {section}
            </NavLink>
            {Array.from(groups.entries()).map(([group, groupPages]) => (
              <div key={group || "_"} className="flex flex-col gap-px">
                {group ? (
                  <p className="mt-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group}
                  </p>
                ) : null}
                {groupPages.map((page) => (
                  <NavLink
                    key={page.slug}
                    to={`${pagePath(page)}`}
                    className={linkClass}
                    onClick={onNavigate}
                  >
                    {page.title}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      <div>
        <p className="flex h-7 items-center px-2 text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          references
        </p>
        <NavLink to={`/references`} className={linkClass} onClick={onNavigate}>
          Pictures and notes
        </NavLink>
      </div>
    </nav>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 xl:justify-start">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Theme, locale, width, motion. Inline on wide screens, in a popover below. */
function ViewControls() {
  const settings = useSettings();
  return (
    <>
      <Field label="Theme">
        <Select
          value={settings.theme}
          onValueChange={(value) => settings.set({ theme: value as Theme })}
        >
          <SelectTrigger size="sm" aria-label="Theme" className="w-24">
            {settings.resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((theme) => (
              <SelectItem key={theme} value={theme}>
                {theme}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Locale">
        <Select
          value={settings.locale}
          onValueChange={(value) => settings.set({ locale: value as Locale })}
        >
          <SelectTrigger size="sm" aria-label="Locale" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {locale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Width">
        <Select
          value={String(settings.viewport ?? "fill")}
          onValueChange={(value) =>
            settings.set({ viewport: value === "fill" ? null : Number(value) })
          }
        >
          <SelectTrigger size="sm" aria-label="Viewport width" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWPORTS.map((viewport) => (
              <SelectItem
                key={viewport.label}
                value={String(viewport.value ?? "fill")}
              >
                {viewport.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-2 xl:justify-start">
        <Label
          htmlFor="reduced-motion"
          className="text-xs font-normal text-muted-foreground xl:order-2"
        >
          Reduced motion
        </Label>
        <Switch
          id="reduced-motion"
          checked={settings.reducedMotion}
          onCheckedChange={(checked) =>
            settings.set({ reducedMotion: checked })
          }
        />
      </div>
    </>
  );
}

function ControlBar({
  onOpenSearch,
  onOpenNav,
  eventsOpen,
  onToggleEvents,
}: {
  onOpenSearch: () => void;
  onOpenNav: () => void;
  eventsOpen: boolean;
  onToggleEvents: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      <Button
        variant="subtle"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <MenuIcon />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSearch}
        className="gap-2 text-muted-foreground"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <div className="ml-auto hidden items-center gap-4 xl:flex">
        <ViewControls />
      </div>
      <div className="ml-auto xl:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontalIcon />
              View
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-64 flex-col gap-3">
            <ViewControls />
          </PopoverContent>
        </Popover>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={eventsOpen ? "secondary" : "subtle"}
            size="icon"
            aria-pressed={eventsOpen}
            aria-label="Toggle event log"
            onClick={onToggleEvents}
          >
            <ListIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Event log</TooltipContent>
      </Tooltip>
    </header>
  );
}

function Shell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [eventsOpen, setEventsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const settings = useSettings();
  const location = useLocation();
  const isolated = /^\/[^/]+\/[^/]+\/[^/]+/.test(location.pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const sidebar = (
    <>
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Mark />
          resit UI
        </NavLink>
        <Button
          variant="subtle"
          size="icon-sm"
          className="ml-auto lg:hidden"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        >
          <XIcon />
        </Button>
      </div>
      <div className="p-2">
        <input
          type="search"
          aria-label="Filter pages"
          placeholder="Filter pages"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-7 w-full rounded-md border border-control-border bg-control px-2 text-sm shadow-input outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <SidebarNav filter={filter} onNavigate={() => setNavOpen(false)} />
      </div>
    </>
  );

  return (
    <LocaleProvider locale={settings.locale}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar lg:flex">
          {sidebar}
        </aside>
        {navOpen ? (
          <div className="fixed inset-0 z-overlay lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setNavOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-sidebar shadow-lg">
              {sidebar}
            </aside>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <ControlBar
            onOpenSearch={() => setSearchOpen(true)}
            onOpenNav={() => setNavOpen(true)}
            eventsOpen={eventsOpen}
            onToggleEvents={() => setEventsOpen((open) => !open)}
          />
          <div className="flex min-h-0 flex-1">
            <main
              aria-label="resit UI"
              className={cn(
                "scrollbar-thin min-w-0 flex-1",
                isolated ? "overflow-hidden" : "overflow-y-auto",
              )}
            >
              <Outlet />
            </main>
            {eventsOpen ? (
              <EventLogPanel className="hidden w-80 shrink-0 border-l md:flex" />
            ) : null}
          </div>
        </div>
      </div>
      <ViewerSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </LocaleProvider>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <EventLogProvider>
        <Shell />
      </EventLogProvider>
    </SettingsProvider>
  );
}
