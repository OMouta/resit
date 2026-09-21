import { messages as ptPT } from "../i18n/pt-PT";

export const LOCALES = ["en", "pt-PT"] as const;
export type Locale = (typeof LOCALES)[number];
/** Languages with a catalog. Text is written in English, so it needs none. */
export type TranslatedLocale = Exclude<Locale, "en">;

export type MessageValues = Record<string, string | number>;

const catalogs: Record<TranslatedLocale, Map<string, string>> = {
  "pt-PT": new Map(Object.entries(ptPT)),
};

/** Adds an app's own translations to the ones this package ships. */
export function addMessages(
  locale: TranslatedLocale,
  messages: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(messages))
    catalogs[locale].set(key, value);
}

/**
 * Text in a language, looked up by its English, with `{name}` placeholders
 * filled in. Text without a translation shows in English.
 */
export function translate(
  locale: Locale,
  text: string,
  values?: MessageValues,
): string {
  const template =
    locale === "en" ? text : (catalogs[locale].get(text) ?? text);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * Marks English text to translate later with `t`, where it is written
 * outside a component, such as in a list of labels.
 */
export function msg(text: string): string {
  return text;
}
