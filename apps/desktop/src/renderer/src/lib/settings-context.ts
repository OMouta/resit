import { createContext, useContext } from "react";

import { appSettingsSchema, type AppSettings } from "../../../shared/settings";

/** Every field has a fallback, so an empty object gives the defaults. */
const DEFAULTS: AppSettings = appSettingsSchema.parse({});

const SettingsContext = createContext<AppSettings>(DEFAULTS);

export const SettingsProvider = SettingsContext.Provider;

/** The settings in force, for views too deep to be given them as props. */
export function useSettings(): AppSettings {
  return useContext(SettingsContext);
}
