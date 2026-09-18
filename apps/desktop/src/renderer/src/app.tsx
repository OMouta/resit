import { useCallback, useEffect, useState, type SetStateAction } from "react";

import { applyAppearance } from "@resit/ui/lib/theme";
import {
  CreateWorkspaceStep,
  Onboarding,
} from "@resit/ui/patterns/screens/onboarding";

import type { AppState } from "../../shared/ipc";
import type { SettingsPatch } from "../../shared/settings";
import type { WorkspaceSnapshot } from "../../shared/workspace";
import { api } from "./lib/api";
import { useNotices } from "./lib/notices";
import { SettingsDialog } from "./settings/settings-dialog";
import { WorkspaceView } from "./workspace/workspace-view";

export function App() {
  const notices = useNotices();
  const [state, setState] = useState<AppState | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState(0);

  const apply = useCallback((next: AppState) => {
    setState(next);
    setSnapshot(next.workspace);
    setWorkspaceKey((key) => key + 1);
    setCreating(false);
  }, []);

  useEffect(() => {
    api.getAppState().then(
      (next) => {
        apply(next);
        if (next.reopenError)
          notices.notify({
            tone: "error",
            title: "The last workspace could not be reopened",
            detail: next.reopenError,
          });
      },
      (error: unknown) => notices.fail("resit could not start", error),
    );
  }, [apply, notices]);

  const theme = state?.settings.theme ?? "system";
  useEffect(() => {
    applyAppearance(document.documentElement, { theme });
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance(document.documentElement, { theme });
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  const updateSnapshot = useCallback(
    (action: SetStateAction<WorkspaceSnapshot>) =>
      setSnapshot((current) =>
        current
          ? typeof action === "function"
            ? action(current)
            : action
          : current,
      ),
    [],
  );

  const openPath = useCallback(
    async (path: string) => {
      try {
        apply(await api.openWorkspace(path));
      } catch (error) {
        notices.fail("That workspace could not be opened", error);
      }
    },
    [apply, notices],
  );

  const openFolder = useCallback(async () => {
    const folder = await api.chooseFolder("Open a workspace folder");
    if (folder) await openPath(folder);
  }, [openPath]);

  const changeSettings = useCallback(
    async (patch: SettingsPatch) => {
      try {
        const settings = await api.updateSettings(patch);
        setState((current) => (current ? { ...current, settings } : current));
      } catch (error) {
        notices.fail("The setting was not saved", error);
      }
    },
    [notices],
  );

  if (!state) return <div className="h-dvh bg-background" />;

  let screen;
  if (creating)
    screen = (
      <CreateWorkspaceStep
        className="min-h-0 flex-1"
        onBack={() => setCreating(false)}
        onChooseFolder={() =>
          api.chooseFolder("Choose a folder for the workspace")
        }
        onFinish={async (values) => {
          try {
            apply(await api.createWorkspace(values));
          } catch (error) {
            notices.fail("The workspace was not created", error);
          }
        }}
      />
    );
  else if (!snapshot)
    screen = (
      <Onboarding
        className="min-h-0 flex-1"
        recent={state.recent}
        onCreate={() => setCreating(true)}
        onOpenFolder={() => void openFolder()}
        onOpenRecent={(id) => {
          const entry = state.recent.find((recent) => recent.id === id);
          if (entry) void openPath(entry.path);
        }}
      />
    );
  else
    screen = (
      <WorkspaceView
        key={workspaceKey}
        snapshot={snapshot}
        setSnapshot={updateSnapshot}
        savedLayout={state.layout}
        recent={state.recent}
        settings={state.settings}
        onSwitchWorkspace={(path) => void openPath(path)}
        onCreateWorkspace={() => setCreating(true)}
        onOpenFolder={() => void openFolder()}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );

  return (
    <main aria-label="resit" className="flex h-dvh flex-col">
      {screen}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={state.settings}
        onChange={(patch) => void changeSettings(patch)}
      />
    </main>
  );
}
