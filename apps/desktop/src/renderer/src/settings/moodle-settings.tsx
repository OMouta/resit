import { RefreshCwIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type { MoodleConnection } from "../../../shared/moodle";
import { SettingsSection } from "./settings-dialog";

export interface MoodleSettingsProps {
  connection: MoodleConnection;
  checking: boolean;
  onConnect: (input: {
    siteUrl: string;
    username: string;
    password: string;
  }) => Promise<void>;
  onDisconnect: () => void;
  onRefresh: () => void;
}

/** The Moodle account course files are downloaded with. */
export function MoodleSettings({
  connection,
  checking,
  onConnect,
  onDisconnect,
  onRefresh,
}: MoodleSettingsProps) {
  const { t } = useLocale();
  const [siteUrl, setSiteUrl] = useState(
    connection.status === "disconnected" ? "" : connection.siteUrl,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!siteUrl.trim() || !username.trim() || !password) return;
    setBusy(true);
    try {
      await onConnect({
        siteUrl: siteUrl.trim(),
        username: username.trim(),
        password,
      });
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title={t("Account")}
      description={t(
        "Follow your Moodle courses and download their files into subjects.",
      )}
    >
      {connection.status === "connected" ? (
        <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium">
              {connection.fullName || connection.username}
            </p>
            <p className="text-xs break-words text-muted-foreground">
              {t("{user} at {site}", {
                user: connection.username,
                site: connection.siteName,
              })}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={checking}
          >
            <RefreshCwIcon /> {checking ? t("Checking…") : t("Check again")}
          </Button>
          <Button size="sm" variant="subtle" onClick={onDisconnect}>
            {t("Disconnect")}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
          {connection.status === "failed" ? (
            <p className="rounded-lg border border-destructive/40 bg-danger-soft px-3 py-2 text-xs text-destructive">
              {connection.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="moodle-site">{t("Moodle address")}</Label>
            <Input
              id="moodle-site"
              value={siteUrl}
              placeholder="moodle.example.edu"
              className="font-mono text-xs"
              onChange={(event) => setSiteUrl(event.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="moodle-user">{t("Username")}</Label>
              <Input
                id="moodle-user"
                value={username}
                autoComplete="off"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="moodle-password">{t("Password")}</Label>
              <Input
                id="moodle-password"
                type="password"
                value={password}
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            resit trades your password for an access token and keeps only the
            token, encrypted on this computer.
          </p>
          <div>
            <Button
              type="submit"
              disabled={
                busy || !siteUrl.trim() || !username.trim() || !password
              }
            >
              {busy ? t("Connecting…") : t("Connect")}
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  );
}
