import type { Locale } from "./config";

/**
 * 언어별 주소. 링크 하나로 처음부터 그 언어로 열리게 한다 (일본·해외 사이트에 올리는 용도).
 *
 * 기준 언어(ko)는 루트 그대로다. 루트는 언어를 **강제하지 않는다**: 저장된 선택이 있으면
 * 그걸 쓴다. /en · /ja는 들어오는 순간 그 언어로 바꾼다. 링크를 건 사람이 고른 언어다.
 *
 * i18n/config를 값으로 가져오지 않는다. 그 모듈은 react-i18next를 초기화하는데, 이
 * 파일은 서버의 메타데이터(site-meta.ts)도 읽는다.
 */
export const LOCALE_PATHS = { ko: "/", en: "/en", ja: "/ja" } as const satisfies Record<
  Locale,
  string
>;

/** 이 주소가 가리키는 언어. 언어 주소가 아니면 null. */
export function localeOfPath(pathname: string): Locale | null {
  const entry = Object.entries(LOCALE_PATHS).find(([, path]) => path === pathname);
  return entry ? (entry[0] as Locale) : null;
}

/** 고른 언어가 저장되는 localStorage 키 (store/settings.ts의 persist 이름). */
export const LOCALE_STORAGE_KEY = "rom-settings";

/**
 * `<html lang>`을 첫 화면이 그려지기 전에 맞추는 인라인 스크립트의 본문.
 *
 * 루트 레이아웃은 하나라 서버는 어느 주소에서나 `lang="ko"`를 보낸다. 고친다는 것은
 * 하이드레이션 뒤(I18nProvider)라, 그 사이에 /en · /ja의 첫 화면은 한국어 문서로 읽힌다
 * (스크린리더가 영어 문장을 한국어 음성으로 읽는다). 이 스크립트가 본문보다 먼저 돌아
 * 그 틈을 없앤다. 규칙은 LocaleRoute · I18nProvider와 같다: 언어 주소면 그 언어,
 * 아니면 저장된 선택. 서버가 보낸 원문 자체를 바꾸려면 언어별 루트 레이아웃이 필요하다.
 *
 * 문자열로 굽는 이유: React가 뜨기 전에 돌아야 해서 모듈을 가져올 수 없다. 주소 표와
 * 키는 여기서 박아 넣어 위의 상수와 어긋나지 않게 한다.
 */
export function langBootScript(): string {
  const paths = JSON.stringify(
    Object.fromEntries(Object.entries(LOCALE_PATHS).map(([locale, path]) => [path, locale])),
  );
  const locales = JSON.stringify(Object.keys(LOCALE_PATHS));
  const key = JSON.stringify(LOCALE_STORAGE_KEY);
  return `(function(){try{var l=${paths}[location.pathname];if(!l||location.pathname==="/"){var s=JSON.parse(localStorage.getItem(${key})||"null");l=(s&&s.state&&s.state.locale)||l}if(${locales}.indexOf(l)>=0)document.documentElement.lang=l}catch(e){}})()`;
}
