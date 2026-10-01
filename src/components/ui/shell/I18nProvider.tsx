"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n, type Locale } from "@/i18n/config";
import { useSettingsStore } from "@/store/settings";

/**
 * 고른 언어를 문서에 반영한다: i18n 자원, `<html lang>`, 그리고 **탭 제목**.
 *
 * 탭 제목은 서버가 메타데이터로 한 번 박고 끝이라 언어를 바꿔도 그대로 남아 있었다.
 * 한국어로 고른 사람의 탭에 "Room of Memory"가 떠 있으면, 저장한 북마크와 작업
 * 전환기의 이름이 게임 안의 이름과 다른 것이 된다. 자원이 번들에 들어 있어
 * changeLanguage는 곧바로 끝나지만, 제목은 바뀐 자원을 읽어야 하므로 그 뒤에 쓴다.
 */
function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  const applyTitle = () => {
    document.title = i18n.t("title");
  };
  if (i18n.language === locale) {
    applyTitle();
    return;
  }
  void i18n.changeLanguage(locale).then(applyTitle);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLocale(useSettingsStore.getState().locale);
    return useSettingsStore.subscribe((state) => applyLocale(state.locale));
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
