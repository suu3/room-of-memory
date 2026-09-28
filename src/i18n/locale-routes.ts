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
