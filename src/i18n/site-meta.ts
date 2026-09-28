import type { Metadata } from "next";
import type { Locale } from "./config";
import { LOCALE_PATHS } from "./locale-routes";
import enCommon from "./locales/en/common.json";
import jaCommon from "./locales/ja/common.json";
import koCommon from "./locales/ko/common.json";

/**
 * 언어별 페이지 메타데이터: 탭 제목, 링크 미리보기(OG·트위터), 언어 대체 링크(hreflang).
 *
 * 문구는 게임 안의 것을 그대로 쓴다 (제목 = `title`, 설명 = 타이틀 화면의 `tagline`).
 * 미리보기에 적힌 말과 들어가서 처음 보는 말이 같아야 한다. 서버에서 도는 코드라
 * i18n/config(react-i18next)가 아니라 JSON을 직접 읽는다.
 */
const COMMON = { ko: koCommon, en: enCommon, ja: jaCommon } as const;

/** Open Graph의 언어 표기 (언어_지역). */
const OG_LOCALE = { ko: "ko_KR", en: "en_US", ja: "ja_JP" } as const satisfies Record<
  Locale,
  string
>;

/**
 * 미리보기와 대체 링크가 가리킬 절대 주소의 뿌리. Vercel이 빌드 때 운영 도메인을
 * `VERCEL_PROJECT_PRODUCTION_URL`로 준다. 도메인을 코드에 적지 않는다. 그 밖(로컬)에서는
 * localhost라 로컬 빌드의 미리보기 주소는 쓸 데가 없다.
 */
export function siteOrigin(): URL {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(production ? `https://${production}` : "http://localhost:3000");
}

export function localeMetadata(locale: Locale): Metadata {
  const common = COMMON[locale];
  const title = common.title;
  const description = common.titleScreen.tagline;
  return {
    title,
    description,
    alternates: {
      canonical: LOCALE_PATHS[locale],
      languages: { ...LOCALE_PATHS, "x-default": LOCALE_PATHS.ko },
    },
    openGraph: {
      type: "website",
      url: LOCALE_PATHS[locale],
      siteName: title,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.entries(OG_LOCALE)
        .filter(([code]) => code !== locale)
        .map(([, value]) => value),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
