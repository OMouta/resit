import type { ExamplePage } from "../../viewer/types";
import { useTokens } from "./tokens";

const spacing = [
  [1, "4px", "Icon to label gap in chips"],
  [2, "8px", "Control gap, chip padding"],
  [3, "12px", "Row padding, popover padding"],
  [4, "16px", "Panel padding"],
  [6, "24px", "Section gap"],
  [8, "32px", "Page padding"],
] as const;

const radii = [
  ["rounded-xs", "--radius-xs", "Badges, kbd"],
  ["rounded-sm", "--radius-sm", "Menu items, checkboxes"],
  ["rounded-control", "--radius-control", "Buttons, inputs, tabs"],
  ["rounded-md", "--radius-md", "Rows, cards"],
  ["rounded-lg", "--radius-lg", "Popovers, menus"],
  ["rounded-panel", "--radius-panel", "Dialogs, panels"],
] as const;

const shadows = [
  ["shadow-hairline", "1px outline for surfaces on surfaces"],
  ["shadow-sm", "Buttons, segmented control thumb"],
  ["shadow-md", "Popovers, menus, tooltips"],
  ["shadow-lg", "Dialogs and sheets"],
] as const;

function Radii() {
  const values = useTokens(radii.map(([, token]) => token));
  return (
    <div className="flex flex-wrap gap-4">
      {radii.map(([className, token, use]) => (
        <div key={className} className="flex flex-col items-center gap-2">
          <div className={`size-16 border bg-muted ${className}`} />
          <p className="text-xs font-medium">{className}</p>
          <p className="font-mono text-2xs text-muted-foreground">
            {values[token]}
          </p>
          <p className="max-w-24 text-center text-2xs text-muted-foreground">
            {use}
          </p>
        </div>
      ))}
    </div>
  );
}

export const page: ExamplePage = {
  section: "foundations",
  slug: "shape",
  title: "Spacing, radii, shadows",
  description:
    "A 4px grid. Radii scale with the size of the element. Shadows are reserved for floating surfaces; in the dark theme hairlines replace them.",
  source: "packages/ui/src/styles/globals.css",
  keywords: ["spacing", "radius", "shadow", "border", "grid"],
  examples: [
    {
      id: "spacing",
      title: "Spacing",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-2">
          {spacing.map(([step, px, use]) => (
            <div
              key={step}
              className="grid grid-cols-[4rem_10rem_1fr] items-center gap-4"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {step} · {px}
              </span>
              <div className="h-4 bg-primary/70" style={{ width: px }} />
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "radii",
      title: "Radii",
      width: "full",
      render: () => <Radii />,
    },
    {
      id: "shadows",
      title: "Shadows",
      description:
        "Switch to the dark theme: the same tokens become hairlines.",
      width: "full",
      surface: "muted",
      render: () => (
        <div className="flex flex-wrap gap-6 p-2">
          {shadows.map(([className, use]) => (
            <div key={className} className="flex flex-col items-center gap-2">
              <div className={`h-20 w-32 rounded-lg bg-popover ${className}`} />
              <p className="text-xs font-medium">{className}</p>
              <p className="max-w-32 text-center text-2xs text-muted-foreground">
                {use}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "borders",
      title: "Borders",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 divide-x rounded-md border">
            <div className="p-3 text-sm">Hairline dividers</div>
            <div className="p-3 text-sm">between panes</div>
            <div className="p-3 text-sm">and rows</div>
          </div>
          <div className="rounded-md border border-border-strong p-3 text-sm">
            Strong border for emphasis, quotes, and drop targets
          </div>
          <div className="rounded-md border border-dashed border-border-strong p-3 text-sm text-muted-foreground">
            Dashed for drop zones and missing content
          </div>
        </div>
      ),
    },
  ],
};
