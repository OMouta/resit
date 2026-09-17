import { Label } from "@resit/ui/components/label";
import { Switch } from "@resit/ui/components/switch";

import type { ExamplePage } from "../../viewer/types";

export const page: ExamplePage = {
  section: "components",
  slug: "switch",
  title: "Switch",
  description: "Settings that apply as soon as they change. No save button.",
  source: "packages/ui/src/components/switch.tsx",
  keywords: ["toggle", "setting", "on", "off"],
  examples: [
    {
      id: "states",
      title: "States",
      width: "auto",
      render: () => (
        <div className="flex flex-col gap-3">
          {(
            [
              ["off", false, false],
              ["on", true, false],
              ["disabled off", false, true],
              ["disabled on", true, true],
            ] as const
          ).map(([label, checked, disabled]) => (
            <div key={label} className="flex items-center gap-2">
              <Switch
                id={`sw-${label}`}
                checked={checked}
                disabled={disabled}
              />
              <Label htmlFor={`sw-${label}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "settings-rows",
      title: "Settings rows",
      description:
        "Label on the left, switch on the right, description under the label.",
      width: 400,
      render: ({ log }) => (
        <div className="flex flex-col divide-y">
          {[
            ["Reduced motion", "Turns off animations and transitions.", false],
            [
              "Auto-save notes",
              "Saves two seconds after you stop typing.",
              true,
            ],
            [
              "Show page thumbnails",
              "Adds a strip of pages next to the PDF.",
              true,
            ],
          ].map(([title, help, on]) => (
            <div
              key={String(title)}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor={`row-${title}`}>{title}</Label>
                <p className="text-xs text-muted-foreground">{help}</p>
              </div>
              <Switch
                id={`row-${title}`}
                defaultChecked={Boolean(on)}
                onCheckedChange={(next) =>
                  log("onCheckedChange", { setting: title, on: next })
                }
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      width: "auto",
      states: ["default", "disabled"],
      controls: {
        label: { type: "text", default: "Auto-save notes" },
        defaultChecked: { type: "boolean", default: true },
      },
      render: ({ state, controls, log, resetKey }) => (
        <div key={resetKey} className="flex items-center gap-2">
          <Switch
            id="pg"
            defaultChecked={Boolean(controls.defaultChecked)}
            disabled={state === "disabled"}
            onCheckedChange={(next) => log("onCheckedChange", next)}
          />
          <Label htmlFor="pg" className="font-normal">
            {String(controls.label)}
          </Label>
        </div>
      ),
    },
  ],
};
