import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export const LOCALES = ["en", "pt-PT"] as const;
export type Locale = (typeof LOCALES)[number];

export interface LocaleFormatters {
  locale: Locale;
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
