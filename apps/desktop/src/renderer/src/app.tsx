import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import { ResitLogo } from "@resit/ui/components/resit-mark";
import { applyAppearance, applyDocumentStyle } from "@resit/ui/lib/theme";
import {
  CreateWorkspaceStep,
  Onboarding,
} from "@resit/ui/patterns/screens/onboarding";
import { Splash } from "@resit/ui/patterns/screens/splash";

import type { ProviderId, ProviderState } from "../../shared/conversations";
import type { AppState, LockedWorkspace } from "../../shared/ipc";
import type { MoodleConnection } from "../../shared/moodle";
import type { SettingsPatch } from "../../shared/settings";
import type { WorkspaceSnapshot } from "../../shared/workspace";
import { ChatPanel } from "./chat/chat-panel";
import { api } from "./lib/api";
import { useNotices } from "./lib/notices";
import { SettingsProvider } from "./lib/settings-context";
import { EditorSettings } from "./settings/editor-settings";
import { GeneralSettings } from "./settings/general-settings";
import { MoodleSettings } from "./settings/moodle-settings";
import { PdfSettings } from "./settings/pdf-settings";
import { ProviderSettings } from "./settings/provider-settings";
import { SettingsDialog, type SettingsTopic } from "./settings/settings-dialog";
import { flushAllViews } from "./views/view-registry";
import { ConfirmDialog } from "./workspace/dialogs";
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
  const [moodle, setMoodle] = useState<MoodleConnection>({
    status: "disconnected",
  });
  const [checkingMoodle, setCheckingMoodle] = useState(false);
  /** A workspace that another copy of resit has open. */
  const [locked, setLocked] = useState<LockedWorkspace | null>(null);
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
    setMoodle(next.moodle);
    setSnapshot(next.workspace);
    setWorkspaceKey((key) => key + 1);
    setCreating(false);
  }, []);

  useEffect(() => {
    api.getAppState().then(
      (next) => {
        apply(next);
        if (next.locked) setLocked(next.locked);
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
  const reducedMotion = state?.settings.reduceMotion ?? false;
  useEffect(() => {
    const appearance = { theme, reducedMotion };
    applyAppearance(document.documentElement, appearance);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance(document.documentElement, appearance);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, reducedMotion]);

  const { font, size, width } = state?.settings.document ?? {};
  useEffect(() => {
    if (!font || !size || !width) return;
    applyDocumentStyle(document.documentElement, { font, size, width });
  }, [font, size, width]);

  // The splash stays up long enough to be read, then fades out. It runs off
  // the first state arriving, not off later changes to it.
  const startedAt = useRef(Date.now());
  const started = state !== null;
  const [splash, setSplash] = useState<"showing" | "leaving" | "gone">(
    "showing",
  );
  useEffect(() => {
    if (!started) return;
    const wait = Math.max(0, 700 - (Date.now() - startedAt.current));
    const fade = window.setTimeout(() => setSplash("leaving"), wait);
    const gone = window.setTimeout(() => setSplash("gone"), wait + 280);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, [started]);

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
    async (path: string, force = false) => {
      try {
        const next = await api.openWorkspace(path, force);
        if (next.locked) setLocked(next.locked);
        else apply(next);
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

  const connectMoodle = async (input: {
    siteUrl: string;
    username: string;
    password: string;
  }) => {
    try {
      const connection = await api.connectMoodle(input);
      setMoodle(connection);
      if (connection.status === "connected")
        notices.notify({
          tone: "success",
          title: `Connected to ${connection.siteName}`,
        });
    } catch (error) {
      notices.fail("Moodle did not connect", error);
    }
  };

  const openSettings = (topic: SettingsTopic = "general") =>
    setSettingsTopic(topic);

  const checkMoodle = () => {
    setCheckingMoodle(true);
    api
      .getMoodleStatus(true)
      .then(setMoodle, (error: unknown) =>
        notices.fail("Moodle could not be checked", error),
      )
      .finally(() => setCheckingMoodle(false));
  };

  if (!state || splash !== "gone")
    return (
      <main aria-label="resit" className="flex h-dvh flex-col">
        <TitleBar />
        <Splash className="min-h-0 flex-1" leaving={splash === "leaving"} />
      </main>
    );

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
        moodle={moodle}
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
    <SettingsProvider value={state.settings}>
      <main aria-label="resit" className="flex h-dvh flex-col">
        {snapshot && !creating ? null : <TitleBar />}
        {screen}
        <SettingsDialog
          open={settingsTopic !== null}
          onOpenChange={(open) => !open && setSettingsTopic(null)}
          topic={settingsTopic ?? "general"}
          onTopicChange={setSettingsTopic}
        >
          {settingsTopic === "general" ? (
            <GeneralSettings
              settings={state.settings}
              onChange={(patch) => void changeSettings(patch)}
            />
          ) : null}
          {settingsTopic === "editor" ? (
            <EditorSettings
              settings={state.settings}
              onChange={(patch) => void changeSettings(patch)}
            />
          ) : null}
          {settingsTopic === "pdf" ? (
            <PdfSettings
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
          {settingsTopic === "moodle" ? (
            <MoodleSettings
              connection={moodle}
              checking={checkingMoodle}
              onConnect={connectMoodle}
              onDisconnect={() => {
                void api
                  .disconnectMoodle()
                  .then(setMoodle, (error: unknown) =>
                    notices.fail("Moodle was not disconnected", error),
                  );
              }}
              onRefresh={checkMoodle}
            />
          ) : null}
        </SettingsDialog>
        <ConfirmDialog
          request={
            locked
              ? {
                  title: "This workspace is already open",
                  description: `${
                    locked.here
                      ? "Another copy of resit on this computer"
                      : `resit on ${locked.host}`
                  } has had it open since ${new Date(locked.since).toLocaleString()}. Two copies writing to the same files can overwrite each other's changes, so open it here only if resit is no longer running there.`,
                  confirmLabel: "Open anyway",
                  onConfirm: () => openPath(locked.path, true),
                }
              : null
          }
          onClose={() => setLocked(null)}
        />
      </main>
    </SettingsProvider>
  );
}

/** The window's own title bar, on the screens without the workspace shell. */
function TitleBar() {
  return (
    <header className="app-titlebar flex h-toolbar shrink-0 items-center border-b bg-sidebar px-3">
      <div aria-hidden className="titlebar-inset-start shrink-0" />
      <ResitLogo className="ml-1.5 flex-1 text-sm" />
      <div aria-hidden className="titlebar-inset-end shrink-0" />
    </header>
  );
}
