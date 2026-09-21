import { Switch } from "@resit/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type {
  AppSettings,
  EditorMode,
  SettingsPatch,
} from "../../../shared/settings";
import { SettingRow, SettingsSection } from "./settings-dialog";

/** How the note editor behaves. */
export function EditorSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <SettingsSection
        title={t("Opening a note")}
        description={t(
          "Notes whose Markdown the rich editor would change always open as Markdown.",
        )}
      >
        <SettingRow label={t("Editor")}>
          <Tabs
            value={settings.editor.mode}
            onValueChange={(value) =>
              onChange({ editor: { mode: value as EditorMode } })
            }
          >
            <TabsList aria-label={t("Default editor")}>
              <TabsTrigger value="rich">{t("Rich text")}</TabsTrigger>
              <TabsTrigger value="source">{t("Markdown")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </SettingRow>
        <SettingRow
          label={t("Show the outline")}
          description={t(
            "Lists the note's headings beside it. Toggle it per note with Ctrl+Shift+O.",
          )}
          htmlFor="editor-outline"
        >
          <Switch
            id="editor-outline"
            checked={settings.editor.outline}
            onCheckedChange={(checked) =>
              onChange({ editor: { outline: checked } })
            }
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("Writing")}>
        <SettingRow
          label={t("Check spelling")}
          description={t("Uses the languages your system is set up for.")}
          htmlFor="editor-spellcheck"
        >
          <Switch
            id="editor-spellcheck"
            checked={settings.editor.spellcheck}
            onCheckedChange={(checked) =>
              onChange({ editor: { spellcheck: checked } })
            }
          />
        </SettingRow>
      </SettingsSection>
    </>
  );
}
