import { useState, type ReactNode } from "react";

import { AiPanel } from "@resit/ui/patterns/ai/ai-panel";
import type { PanelStatus } from "@resit/ui/patterns/ai/turn-status";
import type { Turn } from "@resit/ui/patterns/ai/types";
import {
  WorkspaceSidebar,
  type SidebarDestination,
} from "@resit/ui/patterns/navigation/workspace-sidebar";
import { AppShell } from "@resit/ui/patterns/screens/app-shell";

import { toSidebarProjects, toTreeSubjects } from "../../fixtures/adapters";
import { contextInspector, providers, scope, turns } from "../../fixtures/chat";
import { workspace } from "../../fixtures/workspace";
import type { ExampleContext } from "../../viewer/types";

export interface ScreenFrameProps {
  ctx: ExampleContext;
  children: ReactNode;
  title?: ReactNode;
  activeResourceId?: string | undefined;
  activeDestination?: SidebarDestination | undefined;
  activeProjectId?: string | undefined;
  onOpenResource?: (id: string) => void;
  onNavigate?: (destination: SidebarDestination) => void;
  ai?: { open: boolean; turns?: Turn[]; status?: PanelStatus };
  sidebarOpen?: boolean;
  toolbarEnd?: ReactNode;
}

/** AppShell wired to fixture sidebar and AI panel, for composed screens. */
export function ScreenFrame({
  ctx,
  children,
  title,
  activeResourceId,
  activeDestination,
  activeProjectId,
  onOpenResource,
  onNavigate,
  ai,
  sidebarOpen: initialSidebar = true,
  toolbarEnd,
}: ScreenFrameProps) {
  const narrow = ctx.viewport !== null && ctx.viewport < 1024;
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar && !narrow);
  const [aiOpen, setAiOpen] = useState((ai?.open ?? false) && !narrow);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["sub_math", "sub_math/folder/Worksheets", "sub_prog"]),
  );
  const [sections, setSections] = useState({ subjects: true, projects: true });

  return (
    <AppShell
      title={title}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((value) => !value)}
      aiPanelOpen={aiOpen}
      onToggleAiPanel={() => setAiOpen((value) => !value)}
      onSearch={() => ctx.log("search")}
      onBack={() => ctx.log("back")}
      onForward={() => ctx.log("forward")}
      canGoBack
      toolbarEnd={toolbarEnd}
      sidebar={
        <WorkspaceSidebar
          switcher={{
            workspace,
            recent: workspace.recent,
            onSwitch: (id) => ctx.log("switchWorkspace", id),
            onCreate: () => ctx.log("createWorkspace"),
            onOpenFolder: () => ctx.log("openFolder"),
          }}
          tree={{
            subjects: toTreeSubjects(),
            expandedIds: expanded,
            onExpandedChange: (id, open) =>
              setExpanded((previous) => {
                const next = new Set(previous);
                if (open) next.add(id);
                else next.delete(id);
                return next;
              }),
            activeResourceId,
            onSelect: () => {},
            onOpenResource: (id) => {
              onOpenResource?.(id);
              ctx.log("openResource", id);
            },
          }}
          projects={toSidebarProjects()}
          activeProjectId={activeProjectId}
          onOpenProject={(id) => ctx.log("openProject", id)}
          activeDestination={activeDestination}
          onNavigate={(destination) => {
            onNavigate?.(destination);
            ctx.log("navigate", destination);
          }}
          counts={{ trash: 3, conversations: 4, study: 12 }}
          onAddSubject={() => ctx.log("addSubject")}
          onAddProject={() => ctx.log("addProject")}
          sections={sections}
          onSectionToggle={(section, open) =>
            setSections((previous) => ({ ...previous, [section]: open }))
          }
        />
      }
      aiPanel={
        <AiPanel
          provider={{
            providers,
            providerId: "claude-code",
            modelId: "claude-fable-5-1",
            onProviderChange: (id) => ctx.log("provider", id),
            onModelChange: (id) => ctx.log("model", id),
          }}
          scope={{
            items: scope,
            onRemove: (item) => ctx.log("removeScope", item.id),
            onOpen: (item) => ctx.log("openScope", item.id),
          }}
          turns={ai?.turns ?? turns}
          status={ai?.status ?? { kind: "awaiting-review", pending: 1 }}
          composer={{
            onSend: (text) => ctx.log("send", text),
            onAttach: () => ctx.log("attach"),
          }}
          context={contextInspector}
          onAcceptEdit={(id) => ctx.log("acceptEdit", id)}
          onRejectEdit={(id) => ctx.log("rejectEdit", id)}
          onOpenCitation={(citation) => ctx.log("openCitation", citation.id)}
          onInsert={() => ctx.log("insert")}
          onCopy={() => ctx.log("copy")}
          onNewConversation={() => ctx.log("newConversation")}
          onCollapse={() => setAiOpen(false)}
        />
      }
    >
      {children}
    </AppShell>
  );
}

export const screenExample = { width: "full" as const, height: 760 };
