import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorker } from "@/components/ui/ServiceWorker";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

const pretendard = localFont({
  src: "../../public/assets/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const galmuri = localFont({
  src: "../../public/assets/fonts/Galmuri14.woff2",
  variable: "--font-galmuri",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Room of Memory",
  description: "3D 기반 짧은 비주얼 노벨",
  appleWebApp: {
    capable: true,
    title: "기억의 방",
    // 상태바가 씬 위로 투명하게 얹혀 화면을 더 쓴다
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
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
    <html lang="ko" className={`${pretendard.variable} ${galmuri.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
