import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { LOCALE_STORAGE_KEY } from "@/i18n/locale-routes";

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
    { name: LOCALE_STORAGE_KEY },
  ),
);

export const selectLocale = (state: SettingsState) => state.locale;
