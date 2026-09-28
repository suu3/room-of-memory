"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { i18n, type Locale } from "@/i18n/config";
import { LOCALE_PATHS } from "@/i18n/locale-routes";
import { useSettingsStore } from "@/store/settings";

/**
 * 주소와 언어를 잇는다.
 *
 * - 언어 주소(/en · /ja)로 들어오면 그 언어로 바꾼다. 저장된 선택보다 링크가 앞선다:
 *   링크를 건 사람이 그 언어로 보라고 건 것이다.
 * - 게임 안에서 언어를 바꾸면 주소도 그 언어의 것으로 갈아 끼운다 (replaceState:
 *   새로 불러오지 않는다). 새로고침해도, 주소창을 복사해 공유해도 같은 언어로 열린다.
 *   저장된 언어가 ko가 아닌 채로 루트(/)에 들어와도 그 언어의 주소로 바뀐다.
 */
export function LocaleRoute({ locale }: { locale: Locale | null }) {
  const pathname = usePathname();

  useEffect(() => {
    if (locale) useSettingsStore.getState().setLocale(locale);
    const sync = (current: Locale) => {
      const path = LOCALE_PATHS[current];
      if (window.location.pathname === path) return;
      window.history.replaceState(
        null,
        "",
        `${path}${window.location.search}${window.location.hash}`,
      );
    };
    sync(useSettingsStore.getState().locale);
    return useSettingsStore.subscribe((state) => sync(state.locale));
  }, [locale]);

  /*
   * 주소를 갈아 끼우면 Next가 머리(head)를 이 페이지의 메타데이터로 다시 그려, 루트(/)의
   * 한국어 제목이 I18nProvider가 달아 둔 탭 제목을 덮는다 (저장된 언어가 en인 채로 /에
   * 들어오면 주소는 /en, 게임은 영어인데 탭만 "기억의 방"이었다). 주소가 바뀐 커밋 뒤에
   * 지금 언어의 제목을 다시 단다.
   */
  useEffect(() => {
    void pathname;
    document.title = i18n.t("title");
  }, [pathname]);
  return null;
}
