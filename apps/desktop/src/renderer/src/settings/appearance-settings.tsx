import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";

import type { AppSettings, SettingsPatch } from "../../../shared/settings";
import { SettingsSection } from "./settings-dialog";

/** How resit looks on this computer. */
export function AppearanceSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
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
    </SettingsSection>
  );
}
