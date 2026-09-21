import { Switch } from "@resit/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";

import type {
  AppSettings,
  DocumentFont,
  DocumentWidth,
  Language,
  SettingsPatch,
} from "../../../shared/settings";
import { SettingRow, SettingsSection } from "./settings-dialog";

const FONTS: { value: DocumentFont; label: string }[] = [
  { value: "sans", label: "Sans (Geist)" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
];

const SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const REMINDER_MINUTES = [0, 5, 10, 15, 30, 60];

/** Theme, startup, and the text your notes are written in. */
export function GeneralSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
    <>
      <SettingsSection
        title="Theme"
        description="Follow the system setting, or pick one."
      >
        <Tabs
          value={settings.theme}
          onValueChange={(value) =>
            onChange({ theme: value as AppSettings["theme"] })
          }
        >
          <TabsList aria-label="Theme">
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="light">Light</TabsTrigger>
            <TabsTrigger value="dark">Dark</TabsTrigger>
          </TabsList>
        </Tabs>
        <SettingRow
          label="Reduce motion"
          description="Cut animations short, whatever the system setting says."
          htmlFor="reduce-motion"
        >
          <Switch
            id="reduce-motion"
            checked={settings.reduceMotion}
            onCheckedChange={(checked) => onChange({ reduceMotion: checked })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Language">
        <SettingRow label="Interface language">
          <Select
            value={settings.language}
            onValueChange={(value) => onChange({ language: value as Language })}
          >
            <SelectTrigger aria-label="Interface language" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              {/* Each language is named in itself. */}
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="When resit starts">
        <SettingRow
          label="Open the last workspace"
          description="Otherwise resit starts on the workspace screen."
          htmlFor="reopen-workspace"
        >
          <Switch
            id="reopen-workspace"
            checked={settings.reopenLastWorkspace}
            onCheckedChange={(checked) =>
              onChange({ reopenLastWorkspace: checked })
            }
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Study sessions">
        <SettingRow
          label="Remind me before a session"
          description="A notification from your computer, while resit is open."
          htmlFor="session-reminders"
        >
          <Switch
            id="session-reminders"
            checked={settings.reminders.enabled}
            onCheckedChange={(checked) =>
              onChange({ reminders: { enabled: checked } })
            }
          />
        </SettingRow>
        {settings.reminders.enabled ? (
          <SettingRow label="How early">
            <Select
              value={String(settings.reminders.minutesBefore)}
              onValueChange={(value) =>
                onChange({ reminders: { minutesBefore: Number(value) } })
              }
            >
              <SelectTrigger aria-label="How early" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_MINUTES.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes === 0
                      ? "When it starts"
                      : minutes === 60
                        ? "An hour before"
                        : `${minutes} minutes before`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Document text"
        description="Notes, PDF quotations, and AI replies."
      >
        <SettingRow label="Typeface">
          <Select
            value={settings.document.font}
            onValueChange={(value) =>
              onChange({ document: { font: value as DocumentFont } })
            }
          >
            <SelectTrigger aria-label="Typeface" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Text size">
          <Select
            value={String(settings.document.size)}
            onValueChange={(value) =>
              onChange({ document: { size: Number(value) } })
            }
          >
            <SelectTrigger aria-label="Text size" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Line width"
          description="How wide a line of text runs before it wraps."
        >
          <Tabs
            value={settings.document.width}
            onValueChange={(value) =>
              onChange({ document: { width: value as DocumentWidth } })
            }
          >
            <TabsList aria-label="Line width">
              <TabsTrigger value="narrow">Narrow</TabsTrigger>
              <TabsTrigger value="normal">Normal</TabsTrigger>
              <TabsTrigger value="wide">Wide</TabsTrigger>
            </TabsList>
          </Tabs>
        </SettingRow>
        <p className="document rounded-lg border bg-canvas px-4 py-3">
          A limit is the value a function approaches as its input approaches
          some point.
        </p>
      </SettingsSection>
    </>
  );
}
