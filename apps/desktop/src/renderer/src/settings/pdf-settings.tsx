import { Switch } from "@resit/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { annotationColorClasses } from "@resit/ui/patterns/document/pdf-toolbar";
import { cn } from "@resit/ui/lib/utils";

import type {
  AppSettings,
  PdfPanel,
  PdfZoomSetting,
  SettingsPatch,
} from "../../../shared/settings";
import {
  ANNOTATION_COLOR_VALUES,
  type AnnotationColorValue,
} from "../../../shared/workspace";
import { SettingRow, SettingsSection } from "./settings-dialog";

const ZOOMS: { value: PdfZoomSetting; label: string }[] = [
  { value: "fit-width", label: "Fit width" },
  { value: "fit-page", label: "Fit page" },
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" },
];

const PANELS: { value: PdfPanel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "thumbnails", label: "Pages" },
  { value: "outline", label: "Contents" },
  { value: "highlights", label: "Highlights" },
];

/** How PDFs open and what a new highlight looks like. */
export function PdfSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
    <>
      <SettingsSection title="Opening a PDF">
        <SettingRow label="Zoom">
          <Select
            value={settings.pdf.zoom}
            onValueChange={(value) =>
              onChange({ pdf: { zoom: value as PdfZoomSetting } })
            }
          >
            <SelectTrigger aria-label="Zoom" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOMS.map((zoom) => (
                <SelectItem key={zoom.value} value={zoom.value}>
                  {zoom.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Side panel"
          description="Page thumbnails, the document's contents, or your highlights."
        >
          <Select
            value={settings.pdf.panel}
            onValueChange={(value) =>
              onChange({ pdf: { panel: value as PdfPanel } })
            }
          >
            <SelectTrigger aria-label="Side panel" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PANELS.map((panel) => (
                <SelectItem key={panel.value} value={panel.value}>
                  {panel.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Dim pages in the dark theme"
          description="Takes the glare off a white page at night."
          htmlFor="pdf-dim"
        >
          <Switch
            id="pdf-dim"
            checked={settings.pdf.dimInDark}
            onCheckedChange={(checked) =>
              onChange({ pdf: { dimInDark: checked } })
            }
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Highlights"
        description="Highlights are saved beside the file. The PDF itself never changes."
      >
        <SettingRow label="Colour to start with">
          <div
            role="radiogroup"
            aria-label="Highlight colour"
            className="flex gap-1.5"
          >
            {ANNOTATION_COLOR_VALUES.map((color: AnnotationColorValue) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={settings.pdf.highlightColor === color}
                aria-label={annotationColorClasses[color].label}
                title={annotationColorClasses[color].label}
                onClick={() => onChange({ pdf: { highlightColor: color } })}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md",
                  annotationColorClasses[color].fill,
                  settings.pdf.highlightColor === color &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
              >
                <span
                  className={cn(
                    "size-3 rounded-full",
                    annotationColorClasses[color].swatch,
                  )}
                />
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingsSection>
    </>
  );
}
