import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

interface SettingsState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    { name: "rom-settings" },
  ),
);

export const selectLocale = (state: SettingsState) => state.locale;
