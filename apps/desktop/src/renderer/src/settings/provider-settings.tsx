import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { ProviderStatusBadge } from "@resit/ui/patterns/ai/provider-select";
import { useLocale, type LocaleFormatters } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";

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
    description: msg("Use your Claude Code account for AI chat."),
    signIn: msg("Run `claude` in a terminal and sign in, then check again."),
    install: msg(
      "Install it from claude.com/claude-code, or set its path below.",
    ),
  },
  codex: {
    name: "Codex",
    description: msg("Use your Codex account for AI chat."),
    signIn: msg("Run `codex login` in a terminal, then check again."),
    install: msg(
      "Install it with `npm i -g @openai/codex`, or set its path below.",
    ),
  },
};

function describe(
  provider: ProviderId,
  state: ProviderState,
  t: LocaleFormatters["t"],
): string {
  const copy = COPY[provider];
  switch (state.status) {
    case "checking":
      return t("Checking {provider}…", { provider: copy.name });
    case "ready":
      return t("{provider} {version} at {path}", {
        provider: copy.name,
        version: state.version,
        path: state.path,
      });
    case "not-authenticated":
      return `${t("{provider} is installed but not signed in.", { provider: copy.name })} ${t(copy.signIn)}`;
    case "not-installed":
      return `${state.message} ${t(copy.install)}`;
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
  const { t } = useLocale();
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
      description={t(COPY[provider].description)}
    >
      <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ProviderStatusBadge
            status={badge}
            {...("version" in state ? { version: state.version } : {})}
          />
          <p className="text-xs break-words text-muted-foreground">
            {describe(provider, state, t)}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={state.status === "checking"}
        >
          <RefreshCwIcon /> {t("Check again")}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${provider}-path`}>{t("Executable")}</Label>
        <Input
          id={`${provider}-path`}
          value={path}
          placeholder={t("Found automatically")}
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
  const { t } = useLocale();
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
          <Label htmlFor="codex-home">{t("Codex home")}</Label>
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
            {t("Sets CODEX_HOME, for a second Codex account.")}
          </p>
        </div>
      </ProviderPanel>
    </>
  );
}
