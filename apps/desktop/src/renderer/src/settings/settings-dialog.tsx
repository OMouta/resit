import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";

import type { AppSettings, SettingsPatch } from "../../../shared/settings";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Machine settings. Nothing here is written into the workspace. */
export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
  /** Extra sections, such as the AI provider. */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            These apply to this computer only.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <SettingsSection title="Appearance">
            <Tabs
              value={settings.theme}
              onValueChange={(value) =>
                onChange({ theme: value as AppSettings["theme"] })
              }
            >
              <TabsList aria-label="Theme" className="w-full">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingsSection>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
