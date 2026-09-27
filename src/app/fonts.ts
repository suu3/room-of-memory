import localFont from "next/font/local";

/**
 * 앱 전체 서체. 루트 레이아웃과 global-error가 함께 쓴다: global-error는 레이아웃을
 * 대신해 `<html>`부터 새로 세우므로, 서체를 따로 달지 않으면 에러 화면만 기본 서체로 뜬다.
 */
export const pretendard = localFont({
  src: "../../public/assets/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const galmuri = localFont({
  src: "../../public/assets/fonts/Galmuri14.woff2",
  variable: "--font-galmuri",
  weight: "400",
  display: "swap",
});

export const FONT_VARIABLES = `${pretendard.variable} ${galmuri.variable}`;
