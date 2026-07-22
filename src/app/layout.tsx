import type { Metadata } from "next";
import localFont from "next/font/local";
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
      </body>
    </html>
  );
}
