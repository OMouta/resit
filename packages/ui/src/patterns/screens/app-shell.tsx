import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Kbd } from "@resit/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { cn } from "@resit/ui/lib/utils";

export interface AppShellProps {
  sidebar: ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  aiPanel?: ReactNode;
  aiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
  onSearch?: () => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  /** Centre of the toolbar: usually the workspace or document title. */
  title?: ReactNode;
  toolbarEnd?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Window layout: toolbar, sidebar, document area, AI panel. Below 1100px the
 * AI panel overlays the document area; below 800px the sidebar does too.
 */
export function AppShell({
  sidebar,
  sidebarOpen,
  onToggleSidebar,
  aiPanel,
  aiPanelOpen = false,
  onToggleAiPanel,
  onSearch,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
  title,
  toolbarEnd,
  children,
  className,
}: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-background text-foreground @container",
        className,
      )}
    >
      <header className="flex h-toolbar shrink-0 items-center gap-1 border-b bg-sidebar px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="subtle"
              size="icon"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-pressed={sidebarOpen}
              onClick={onToggleSidebar}
            >
              <PanelLeftIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sidebar</TooltipContent>
        </Tooltip>
        <div className="hidden items-center @md:flex">
          <Button
            variant="subtle"
            size="icon"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={onBack}
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            variant="subtle"
            size="icon"
            aria-label="Forward"
            disabled={!canGoForward}
            onClick={onForward}
          >
            <ArrowRightIcon />
          </Button>
        </div>
        <div className="mx-2 min-w-0 flex-1 truncate text-center text-sm font-medium text-muted-foreground">
          {title}
        </div>
        {onSearch ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onSearch}
            className="gap-2 text-muted-foreground"
          >
            <SearchIcon />
            <span className="hidden @md:inline">Search</span>
            <Kbd className="hidden @md:inline-flex">⌘K</Kbd>
          </Button>
        ) : null}
        {toolbarEnd}
        {onToggleAiPanel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={aiPanelOpen ? "secondary" : "subtle"}
                size="icon"
                aria-label={aiPanelOpen ? "Hide AI panel" : "Show AI panel"}
                aria-pressed={aiPanelOpen}
                onClick={onToggleAiPanel}
              >
                {aiPanelOpen ? <PanelRightIcon /> : <SparklesIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI panel</TooltipContent>
          </Tooltip>
        ) : null}
      </header>
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen ? (
          <>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={onToggleSidebar}
              className="absolute inset-0 z-sticky bg-black/20 @3xl:hidden"
            />
            <aside className="absolute inset-y-0 left-0 z-pane w-sidebar shrink-0 border-r bg-sidebar shadow-lg @3xl:static @3xl:shadow-none">
              {sidebar}
            </aside>
          </>
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
        {aiPanel && aiPanelOpen ? (
          <>
            <button
              type="button"
              aria-label="Close AI panel"
              onClick={onToggleAiPanel}
              className="absolute inset-0 z-sticky bg-black/20 @5xl:hidden"
            />
            <aside className="absolute inset-y-0 right-0 z-pane w-ai-panel max-w-full shrink-0 border-l bg-sidebar shadow-lg @5xl:static @5xl:shadow-none">
              {aiPanel}
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
