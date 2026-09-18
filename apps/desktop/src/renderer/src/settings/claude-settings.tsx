import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { ProviderStatusBadge } from "@resit/ui/patterns/ai/provider-select";

import type { ProviderState } from "../../../shared/conversations";
import type { AppSettings, SettingsPatch } from "../../../shared/settings";
import { SettingsSection } from "./settings-dialog";

function describe(provider: ProviderState): string {
  switch (provider.status) {
    case "checking":
      return "Checking the installed Claude Code…";
    case "ready":
      return `Claude Code ${provider.version} at ${provider.path}`;
    case "not-authenticated":
      return "Claude Code is installed but not signed in. Run `claude` in a terminal and sign in, then check again.";
    case "not-installed":
      return `${provider.message} Install it from claude.com/claude-code, or set its path below.`;
    case "failed":
      return provider.message;
  }
}

/** Claude Code connection: status and executable override. */
export function ClaudeSettings({
  provider,
  settings,
  onChange,
  onRefresh,
}: {
  provider: ProviderState;
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
  onRefresh: () => void;
}) {
  const [path, setPath] = useState(settings.claude.executablePath ?? "");

  useEffect(() => {
    setPath(settings.claude.executablePath ?? "");
  }, [settings.claude.executablePath]);

  const badge =
    provider.status === "ready" ||
    provider.status === "checking" ||
    provider.status === "not-authenticated"
      ? provider.status
      : "not-installed";

  return (
    <SettingsSection
      title="Claude Code"
      description="resit uses your installed Claude Code and its sign-in. Nothing is sent until you ask a question."
    >
      <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ProviderStatusBadge
            status={badge}
            {...("version" in provider ? { version: provider.version } : {})}
          />
          <p className="text-xs break-words text-muted-foreground">
            {describe(provider)}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={provider.status === "checking"}
        >
          <RefreshCwIcon /> Check again
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claude-path">Executable</Label>
        <Input
          id="claude-path"
          value={path}
          placeholder="Found automatically"
          className="font-mono text-xs"
          onChange={(event) => setPath(event.target.value)}
          onBlur={() => {
            if (path.trim() !== (settings.claude.executablePath ?? ""))
              onChange({ claude: { executablePath: path.trim() } });
          }}
        />
      </div>
    </SettingsSection>
  );
}
