const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Human-readable byte size using decimal units (1 KB = 1000 B), matching
 * what Finder and Explorer show. `number` is the locale formatter from
 * `useLocale()` so the decimal separator follows the user's locale.
 */
export function formatBytes(
  bytes: number,
  number: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${number(value, { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}
