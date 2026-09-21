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
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";

import type {
  AppSettings,
  OcrLanguage,
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
  { value: "fit-width", label: msg("Fit width") },
  { value: "fit-page", label: msg("Fit page") },
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" },
];

const OCR_LANGUAGES: { value: string; label: string }[] = [
  { value: "eng", label: msg("English") },
  { value: "por", label: msg("Portuguese") },
  { value: "eng+por", label: msg("English and Portuguese") },
];

const PANELS: { value: PdfPanel; label: string }[] = [
  { value: "none", label: msg("None") },
  { value: "thumbnails", label: msg("Pages") },
  { value: "outline", label: msg("Contents") },
  { value: "highlights", label: msg("Highlights") },
];

/** How PDFs open and what a new highlight looks like. */
export function PdfSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <SettingsSection title={t("Opening a PDF")}>
        <SettingRow label={t("Zoom")}>
          <Select
            value={settings.pdf.zoom}
            onValueChange={(value) =>
              onChange({ pdf: { zoom: value as PdfZoomSetting } })
            }
          >
            <SelectTrigger aria-label={t("Zoom")} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOMS.map((zoom) => (
                <SelectItem key={zoom.value} value={zoom.value}>
                  {t(zoom.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t("Side panel")}
          description={t(
            "Page thumbnails, the document's contents, or your highlights.",
          )}
        >
          <Select
            value={settings.pdf.panel}
            onValueChange={(value) =>
              onChange({ pdf: { panel: value as PdfPanel } })
            }
          >
            <SelectTrigger aria-label={t("Side panel")} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PANELS.map((panel) => (
                <SelectItem key={panel.value} value={panel.value}>
                  {t(panel.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t("Dim pages in the dark theme")}
          description={t("Takes the glare off a white page at night.")}
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
        title={t("Text recognition")}
        description={t(
          "Reads the text on scanned pages so search and the assistant can find it. It runs on this computer and downloads each language once.",
        )}
      >
        <SettingRow label={t("Languages")}>
          <Select
            value={settings.pdf.ocrLanguages.join("+")}
            onValueChange={(value) =>
              onChange({
                pdf: { ocrLanguages: value.split("+") as OcrLanguage[] },
              })
            }
          >
            <SelectTrigger
              aria-label={t("Text recognition languages")}
              className="w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCR_LANGUAGES.map((language) => (
                <SelectItem key={language.value} value={language.value}>
                  {t(language.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title={t("Highlights")}
        description={t(
          "Highlights are saved beside the file. The PDF itself never changes.",
        )}
      >
        <SettingRow label={t("Colour to start with")}>
          <div
            role="radiogroup"
            aria-label={t("Highlight colour")}
            className="flex gap-1.5"
          >
            {ANNOTATION_COLOR_VALUES.map((color: AnnotationColorValue) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={settings.pdf.highlightColor === color}
                aria-label={t(annotationColorClasses[color].label)}
                title={t(annotationColorClasses[color].label)}
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
