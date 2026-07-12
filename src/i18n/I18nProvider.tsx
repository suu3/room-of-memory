"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { i18n, type Locale } from "./config";

function applyLocale(locale: Locale) {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLocale(useSettingsStore.getState().locale);
    return useSettingsStore.subscribe((state) => applyLocale(state.locale));
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
