import {
  addMessages,
  translate,
  type Locale,
  type MessageValues,
} from "@resit/ui/lib/i18n";

import { messages } from "../shared/i18n/pt-PT";

addMessages("pt-PT", messages);

let locale: Locale = "en";

/** Follows the language setting, for text the main process shows. */
export function setLocale(next: Locale): void {
  locale = next;
}

/** English text in the interface language. */
export function t(text: string, values?: MessageValues): string {
  return translate(locale, text, values);
}
