import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { ProviderStatusBadge } from "@resit/ui/patterns/ai/provider-select";

import type { ProviderId, ProviderState } from "../../../shared/conversations";
import type { AppSettings, SettingsPatch } from "../../../shared/settings";
import { SettingsSection } from "./settings-dialog";

interface ProviderCopy {
  name: string;
  description: string;
  signIn: string;
  install: string;
}

const COPY: Record<ProviderId, ProviderCopy> = {
  claude: {
    name: "Claude Code",
    description: "Use your Claude Code account for AI chat.",
    signIn: "Run `claude` in a terminal and sign in, then check again.",
    install: "Install it from claude.com/claude-code, or set its path below.",
  },
  codex: {
    name: "Codex",
    description: "Use your Codex account for AI chat.",
    signIn: "Run `codex login` in a terminal, then check again.",
    install: "Install it with `npm i -g @openai/codex`, or set its path below.",
  },
};

function describe(provider: ProviderId, state: ProviderState): string {
  const copy = COPY[provider];
  switch (state.status) {
    case "checking":
      return `Checking ${copy.name}…`;
    case "ready":
      return `${copy.name} ${state.version} at ${state.path}`;
    case "not-authenticated":
      return `${copy.name} is installed but not signed in. ${copy.signIn}`;
    case "not-installed":
      return `${state.message} ${copy.install}`;
    case "failed":
      return state.message;
  }
}

function ProviderPanel({
  provider,
  state,
  executablePath,
  onPathChange,
  onRefresh,
  children,
}: {
  provider: ProviderId;
  state: ProviderState;
  executablePath: string | undefined;
  onPathChange: (path: string) => void;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const [path, setPath] = useState(executablePath ?? "");
  useEffect(() => {
    setPath(executablePath ?? "");
  }, [executablePath]);

  const badge =
    state.status === "ready" ||
    state.status === "checking" ||
    state.status === "not-authenticated"
      ? state.status
      : "not-installed";

  return (
    <SettingsSection
      title={COPY[provider].name}
      description={COPY[provider].description}
    >
      <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ProviderStatusBadge
            status={badge}
            {...("version" in state ? { version: state.version } : {})}
          />
          <p className="text-xs break-words text-muted-foreground">
            {describe(provider, state)}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={state.status === "checking"}
        >
          <RefreshCwIcon /> Check again
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${provider}-path`}>Executable</Label>
        <Input
          id={`${provider}-path`}
          value={path}
          placeholder="Found automatically"
          className="font-mono text-xs"
          onChange={(event) => setPath(event.target.value)}
          onBlur={() => {
            if (path.trim() !== (executablePath ?? ""))
              onPathChange(path.trim());
          }}
        />
      </div>
      {children}
    </SettingsSection>
  );
}

/** Where each provider is installed, and whether it is signed in. */
export function ProviderSettings({
  providers,
  settings,
  onChange,
  onRefresh,
}: {
  providers: Record<ProviderId, ProviderState>;
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
  onRefresh: (provider: ProviderId) => void;
}) {
  const [home, setHome] = useState(settings.codex.homePath ?? "");
  useEffect(() => {
    setHome(settings.codex.homePath ?? "");
  }, [settings.codex.homePath]);

  return (
    <>
      <ProviderPanel
        provider="claude"
        state={providers.claude}
        executablePath={settings.claude.executablePath}
        onPathChange={(path) => onChange({ claude: { executablePath: path } })}
        onRefresh={() => onRefresh("claude")}
      />
      <ProviderPanel
        provider="codex"
        state={providers.codex}
        executablePath={settings.codex.executablePath}
        onPathChange={(path) => onChange({ codex: { executablePath: path } })}
        onRefresh={() => onRefresh("codex")}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codex-home">Codex home</Label>
          <Input
            id="codex-home"
            value={home}
            placeholder="~/.codex"
            className="font-mono text-xs"
            onChange={(event) => setHome(event.target.value)}
            onBlur={() => {
              if (home.trim() !== (settings.codex.homePath ?? ""))
                onChange({ codex: { homePath: home.trim() } });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Sets CODEX_HOME, for a second Codex account.
          </p>
        </div>
      </ProviderPanel>
    </>
  );
}
