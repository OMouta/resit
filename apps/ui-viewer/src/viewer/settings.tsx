import {
  THEMES,
  applyAppearance,
  type ResolvedTheme,
  type Theme,
} from "@resit/ui/lib/theme";
import { LOCALES, type Locale } from "@resit/ui/hooks/use-locale";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";

export const VIEWPORTS = [
  { label: "Fill", value: null },
  { label: "1440", value: 1440 },
  { label: "1280", value: 1280 },
  { label: "1024", value: 1024 },
  { label: "800", value: 800 },
  { label: "640", value: 640 },
] as const;

export interface ViewerSettings {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  locale: Locale;
  viewport: number | null;
  reducedMotion: boolean;
  set: (patch: Partial<Omit<ViewerSettings, "set" | "resolvedTheme">>) => void;
}

interface Stored {
  theme: Theme;
  locale: Locale;
  viewport: number | null;
  reducedMotion: boolean;
}

const STORAGE_KEY = "resit-ui-viewer-settings";
const defaults: Stored = {
  theme: "light",
  locale: "en",
  viewport: null,
  reducedMotion: false,
};

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readStored(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const viewport = Number(parsed.viewport);
    return {
      theme: pick(parsed.theme, THEMES, defaults.theme),
      locale: pick(parsed.locale, LOCALES, defaults.locale),
      viewport: Number.isFinite(viewport) && viewport > 0 ? viewport : null,
      reducedMotion: parsed.reducedMotion === true,
    };
  } catch {
    return defaults;
  }
}

const SettingsContext = createContext<ViewerSettings | null>(null);

/**
 * Viewer-wide controls persist in localStorage so they survive navigation and
 * reloads. URL params (?theme=dark&locale=pt-PT&viewport=1024&motion=reduced)
 * override them for shareable links and are absorbed into storage on load.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [stored, setStored] = useState<Stored>(readStored);

  useEffect(() => {
    const patch: Partial<Stored> = {};
    if (params.has("theme"))
      patch.theme = pick(params.get("theme"), THEMES, stored.theme);
    if (params.has("locale"))
      patch.locale = pick(params.get("locale"), LOCALES, stored.locale);
    if (params.has("viewport")) {
      const value = Number(params.get("viewport"));
      patch.viewport = Number.isFinite(value) && value > 0 ? value : null;
    }
    if (params.has("motion"))
      patch.reducedMotion = params.get("motion") === "reduced";
    if (Object.keys(patch).length === 0) return;
    setStored((previous) => ({ ...previous, ...patch }));
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of ["theme", "locale", "viewport", "motion"])
          next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, stored.theme, stored.locale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [stored]);

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    applyAppearance(document.documentElement, {
      theme: stored.theme,
      reducedMotion: stored.reducedMotion,
    }),
  );
  useEffect(() => {
    const root = document.documentElement;
    const apply = () =>
      setResolvedTheme(
        applyAppearance(root, {
          theme: stored.theme,
          reducedMotion: stored.reducedMotion,
        }),
      );
    apply();
    if (stored.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [stored.theme, stored.reducedMotion]);

  useEffect(() => {
    document.documentElement.lang = stored.locale;
  }, [stored.locale]);

  const set = useCallback<ViewerSettings["set"]>((patch) => {
    setStored((previous) => ({ ...previous, ...patch }));
  }, []);

  const value = useMemo<ViewerSettings>(
    () => ({ ...stored, resolvedTheme, set }),
    [stored, resolvedTheme, set],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): ViewerSettings {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings requires SettingsProvider");
  return context;
}
