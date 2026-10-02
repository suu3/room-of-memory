"use client";

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
   * 탭 제목을 지금 언어의 것으로 붙든다. 방 페이지의 `<title>`은 주인이 둘이다: 서버가
   * 박은 그 주소의 메타데이터(React가 쥔 요소)와, 고른 언어를 따라 다는 I18nProvider.
   * 저장된 언어가 ja인 채로 루트(/)에 들어오면 I18nProvider가 먼저 일본어 제목을 달지만,
   * 메타데이터는 그 **뒤에** 하이드레이션되며 글자를 루트의 한국어 제목으로 되돌린다
   * (주소는 /ja, 게임은 일본어인데 탭만 "기억의 방"). 언제 되돌릴지는 Next의 사정이라
   * 시점을 맞추지 않고 머리(head)를 지켜본다: 제목이 지금 언어의 것과 달라지면 다시 단다.
   *
   * 예전에는 usePathname이 바뀔 때 다시 달았는데, replaceState로 갈아 끼운 주소는 이
   * 시점에 usePathname에 오르지 않아 한 번도 다시 돌지 않았다 (2026-10-02 QA).
   */
  useEffect(() => {
    const keep = () => {
      const wanted = i18n.t("title");
      if (document.title !== wanted) document.title = wanted;
    };
    const observer = new MutationObserver(keep);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
