import { useEffect, useState } from "react";

/** Reads a CSS custom property from the document root as currently themed. */
export function useToken(name: string): string {
  const [value, setValue] = useState("");
  useEffect(() => {
    const read = () =>
      setValue(
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim(),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-reduced-motion"],
    });
    return () => observer.disconnect();
  }, [name]);
  return value;
}

export function useTokens(names: readonly string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  const key = names.join("|");
  useEffect(() => {
    const names = key.split("|");
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const name of names)
        next[name] = style.getPropertyValue(name).trim();
      setValues(next);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-reduced-motion"],
    });
    return () => observer.disconnect();
  }, [key]);
  return values;
}
