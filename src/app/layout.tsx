import type { Metadata } from "next";
import { Nanum_Pen_Script } from "next/font/google";
import localFont from "next/font/local";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

const pretendard = localFont({
  src: "../../public/assets/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const nanumPen = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-nanum-pen",
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
    <html lang="ko" className={`${pretendard.variable} ${nanumPen.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
