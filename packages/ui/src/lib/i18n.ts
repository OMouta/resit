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
  context?: string,
): string {
  const key = context ? contextKey(context, text) : text;
  // English, and text without a translation, show without the context.
  const plain = key.slice(key.indexOf("\u0004") + 1);
  const template =
    locale === "en" ? plain : (catalogs[locale].get(key) ?? plain);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * The catalog key for English that needs telling apart, such as "Correct"
 * as a verb and as a verdict. The separator is the one gettext uses.
 */
export function contextKey(context: string, text: string): string {
  return `${context}\u0004${text}`;
}

/**
 * Marks English text to translate later with `t`, where it is written
 * outside a component, such as in a list of labels.
 */
export function msg(text: string): string {
  return text;
}

/** Like `msg`, for English that needs a context. `t` shows it as the text. */
export function msgc(context: string, text: string): string {
  return contextKey(context, text);
}
