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
import { ResitMark } from "@resit/ui/components/resit-mark";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { isMac, shortcutLabel } from "@resit/ui/lib/keys";
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
  /** Left of the toolbar, after the sidebar button: usually a breadcrumb. */
  title?: ReactNode;
  toolbarEnd?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Window layout: title bar, sidebar, document area, AI panel. Below 1100px
 * the AI panel overlays the document area; below 800px the sidebar does too.
 * The title bar drags the window in the desktop app.
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
      <header className="app-titlebar flex h-toolbar shrink-0 items-center gap-1.5 border-b bg-sidebar px-3">
        <div aria-hidden className="titlebar-inset-start shrink-0" />
        <ResitMark className="mx-1.5 size-5" />
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
        {onBack || onForward ? (
          <div className="hidden items-center gap-0.5 @md:flex">
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
        ) : null}
        <div className="mr-3 ml-1 flex min-w-0 flex-1 items-center text-sm text-muted-foreground">
          {title}
        </div>
        {onSearch ? (
          <Button
            variant="outline"
            onClick={onSearch}
            className="gap-2 pr-1.5 pl-2.5 font-normal text-muted-foreground"
          >
            <SearchIcon />
            <span className="hidden @md:inline">Search</span>
            <Kbd className="ml-2 hidden @md:inline-flex">
              {shortcutLabel("mod+K").join(isMac() ? "" : "+")}
            </Kbd>
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
        <div aria-hidden className="titlebar-inset-end shrink-0" />
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
