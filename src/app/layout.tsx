import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/ui/shell/I18nProvider";
import { ServiceWorker } from "@/components/ui/shell/ServiceWorker";
import { langBootScript } from "@/i18n/locale-routes";
import { siteOrigin } from "@/i18n/site-meta";
import { FONT_VARIABLES } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // 언어 대체 링크(hreflang)와 미리보기 주소를 절대 주소로 푸는 뿌리 (site-meta.ts)
  metadataBase: siteOrigin(),
  // 기준 언어(ko)의 이름. 방 페이지(/ · /en · /ja)는 제 언어의 메타데이터로 덮는다
  // (site-meta.ts). 게임 안에서 언어를 고르면 I18nProvider가 탭 제목을 바꿔 단다
  title: "기억의 방",
  description: "3D 기반 짧은 비주얼 노벨",
  appleWebApp: {
    capable: true,
    title: "기억의 방",
    // 상태바가 씬 위로 투명하게 얹혀 화면을 더 쓴다
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/icons/apple-touch-icon.png?v=20260910" },
  /*
   * 링크 미리보기. 그림은 같은 폴더의 opengraph-image.jpg·twitter-image.jpg(파일 규칙)가
   * 붙는다: 타이틀 화면을 1200×630으로 찍고 메뉴·조작 안내·언어 토글만 걷어낸 한 장이다.
   * 타이틀 화면이 바뀌면 다시 찍는다. 언어 주소(/en · /ja)는 제 폴더에 같은 이름으로 그 언어의
   * 타이틀 화면을 따로 둔다: 페이지가 제 openGraph를 쓰면 루트의 그림을 물려받지 않는다.
   */
  openGraph: {
    type: "website",
    siteName: "기억의 방",
    title: "기억의 방",
    description: "닫힌 방에 흩어진 기억을 하나씩 되찾는 이야기.",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "기억의 방",
    description: "닫힌 방에 흩어진 기억을 하나씩 되찾는 이야기.",
  },
};

export const viewport: Viewport = {
  // 방의 어둠과 브라우저 UI를 잇는다 (DESIGN.md의 night)
  themeColor: "#0B111A",
  // 게임 화면이라 확대/축소로 레이아웃이 밀리면 안 된다. 방 확대는 핀치가 아니라
  // 씬의 줌(핀치 제스처를 캔버스가 직접 받는다)이 맡는다.
  maximumScale: 1,
  userScalable: false,
  // 노치 아래까지 씬이 깔리게 한다. HUD는 이미 안전 영역 안쪽에 있다
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 하이드레이션 전에 lang을 고쳐 서버 값과 달라진다
    <html lang="ko" className={`${FONT_VARIABLES} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        {/* 본문보다 먼저: /en · /ja와 저장된 언어의 lang을 첫 화면 전에 맞춘다 (locale-routes.ts) */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: 사용자 입력이 섞이지 않는 고정 문자열이다. React가 뜨기 전에 돌아야 해서 인라인으로 싣는다 */}
        <script dangerouslySetInnerHTML={{ __html: langBootScript() }} />
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
        {/* 접속자 수·유입 경로만 본다 (쿠키 없음, Hobby라 커스텀 이벤트는 안 찍힌다) */}
        <Analytics />
      </body>
    </html>
  );
}
