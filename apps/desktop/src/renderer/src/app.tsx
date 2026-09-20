import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import { ResitLogo } from "@resit/ui/components/resit-mark";
import { applyAppearance } from "@resit/ui/lib/theme";
import {
  CreateWorkspaceStep,
  Onboarding,
} from "@resit/ui/patterns/screens/onboarding";

import type { ProviderId, ProviderState } from "../../shared/conversations";
import type { AppState } from "../../shared/ipc";
import type { SettingsPatch } from "../../shared/settings";
import type { WorkspaceSnapshot } from "../../shared/workspace";
import { ChatPanel } from "./chat/chat-panel";
import { api } from "./lib/api";
import { useNotices } from "./lib/notices";
import { AppearanceSettings } from "./settings/appearance-settings";
import { ProviderSettings } from "./settings/provider-settings";
import { SettingsDialog, type SettingsTopic } from "./settings/settings-dialog";
import { flushAllViews } from "./views/view-registry";
import { WorkspaceView } from "./workspace/workspace-view";

export function App() {
  const notices = useNotices();
  const [state, setState] = useState<AppState | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [creating, setCreating] = useState(false);
  /** The open settings topic, or null when settings are closed. */
  const [settingsTopic, setSettingsTopic] = useState<SettingsTopic | null>(
    null,
  );
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [providers, setProviders] = useState<Record<ProviderId, ProviderState>>(
    { claude: { status: "checking" }, codex: { status: "checking" } },
  );
  // Checking a provider starts it, so each one is only looked at when the
  // student is about to use it.
  const checked = useRef(new Set<ProviderId>());

  const checkProvider = useCallback((provider: ProviderId, refresh = false) => {
    if (!refresh && checked.current.has(provider)) return;
    checked.current.add(provider);
    if (refresh)
      setProviders((current) => ({
        ...current,
        [provider]: { status: "checking" },
      }));
    api.getProviderStatus(provider, refresh).then(
      (state) => setProviders((current) => ({ ...current, [provider]: state })),
      (error: unknown) =>
        setProviders((current) => ({
          ...current,
          [provider]: {
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          },
        })),
    );
  }, []);

  // Save open notes before the window closes.
  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "before-close")
          void flushAllViews().finally(() => void api.confirmClose());
      }),
    [],
  );

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
        // The main process re-checks a provider when its settings change.
        if (patch.claude && "executablePath" in patch.claude)
          checkProvider("claude", true);
        if (
          patch.codex &&
          ("executablePath" in patch.codex || "homePath" in patch.codex)
        )
          checkProvider("codex", true);
      } catch (error) {
        notices.fail("The setting was not saved", error);
      }
    },
    [notices, checkProvider],
  );

  const openSettings = (topic: SettingsTopic = "appearance") =>
    setSettingsTopic(topic);

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
        onOpenSettings={openSettings}
        renderAiPanel={(context) => (
          <ChatPanel
            {...context}
            providers={providers}
            onCheckProvider={checkProvider}
            settings={state.settings}
            onSettingsChange={(patch) => void changeSettings(patch)}
            onOpenSettings={() => openSettings("providers")}
          />
        )}
      />
    );

  return (
    <main aria-label="resit" className="flex h-dvh flex-col">
      {snapshot && !creating ? null : (
        <header className="app-titlebar flex h-toolbar shrink-0 items-center border-b bg-sidebar px-3">
          <div aria-hidden className="titlebar-inset-start shrink-0" />
          <ResitLogo className="ml-1.5 flex-1 text-sm" />
          <div aria-hidden className="titlebar-inset-end shrink-0" />
        </header>
      )}
      {screen}
      <SettingsDialog
        open={settingsTopic !== null}
        onOpenChange={(open) => !open && setSettingsTopic(null)}
        topic={settingsTopic ?? "appearance"}
        onTopicChange={setSettingsTopic}
      >
        {settingsTopic === "appearance" ? (
          <AppearanceSettings
            settings={state.settings}
            onChange={(patch) => void changeSettings(patch)}
          />
        ) : null}
        {settingsTopic === "providers" ? (
          <ProviderSettings
            providers={providers}
            settings={state.settings}
            onChange={(patch) => void changeSettings(patch)}
            onRefresh={(provider) => checkProvider(provider, true)}
          />
        ) : null}
      </SettingsDialog>
    </main>
  );
}
