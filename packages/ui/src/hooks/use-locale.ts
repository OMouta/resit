import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { translate, type Locale, type MessageValues } from "@resit/ui/lib/i18n";

export { LOCALES, type Locale } from "@resit/ui/lib/i18n";

export interface LocaleFormatters {
  locale: Locale;
  /** English text in the current language. See `translate`. */
  t: (text: string, values?: MessageValues) => string;
  /** Like `t`, with elements in the placeholders, such as a link or code. */
  tx: (text: string, values: Record<string, ReactNode>) => ReactNode;
  /** Like `t`, for English that means more than one thing, such as "Correct". */
  tc: (context: string, text: string, values?: MessageValues) => string;
  date: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  time: (value: Date | string) => string;
  dateTime: (value: Date | string) => string;
  weekday: (value: Date | string) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  percent: (fraction: number) => string;
  relative: (value: Date | string, now?: Date) => string;
  list: (items: string[]) => string;
}

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return createElement(LocaleContext.Provider, { value: locale }, children);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function createFormatters(locale: Locale): LocaleFormatters {
  const relativeFormat = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });
  const listFormat = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  });
  return {
    locale,
    t: (text, values) => translate(locale, text, values),
    tc: (context, text, values) => translate(locale, text, values, context),
    tx: (text, values) => {
      const template = translate(locale, text);
      const parts: ReactNode[] = [];
      let last = 0;
      for (const match of template.matchAll(/\{(\w+)\}/g)) {
        const key = match[1] ?? "";
        parts.push(template.slice(last, match.index));
        parts.push(
          key in values
            ? createElement(Fragment, { key: match.index }, values[key])
            : match[0],
        );
        last = match.index + match[0].length;
      }
      parts.push(template.slice(last));
      return createElement(Fragment, null, ...parts);
    },
    date: (value, options) =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...options,
      }).format(toDate(value)),
    time: (value) =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(toDate(value)),
    dateTime: (value) =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(toDate(value)),
    weekday: (value) =>
      new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
        toDate(value),
      ),
    number: (value, options) =>
      new Intl.NumberFormat(locale, options).format(value),
    percent: (fraction) =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(fraction),
    relative: (value, now = new Date()) => {
      const diffMs = toDate(value).getTime() - now.getTime();
      const minutes = Math.round(diffMs / 60_000);
      if (Math.abs(minutes) < 60)
        return relativeFormat.format(minutes, "minute");
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
      const days = Math.round(hours / 24);
      if (Math.abs(days) < 30) return relativeFormat.format(days, "day");
      return relativeFormat.format(Math.round(days / 30), "month");
    },
    list: (items) => listFormat.format(items),
  };
}

export function useLocale(): LocaleFormatters {
  const locale = useContext(LocaleContext);
  return useMemo(() => createFormatters(locale), [locale]);
}
