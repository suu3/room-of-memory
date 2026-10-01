"use client";

import { LoadError } from "@/components/ui/boot/LoadError";
import { I18nProvider } from "@/i18n/I18nProvider";
import { FONT_VARIABLES } from "./fonts";
import "./globals.css";

/**
 * 루트 레이아웃까지 무너졌을 때 (연결이 끊긴 채 이동하면 대개 여기로 온다).
 * 레이아웃을 대신하므로 `<html>`·서체·전역 스타일·i18n을 스스로 세운다.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ko" className={`${FONT_VARIABLES} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <title>기억의 방</title>
        <I18nProvider>
          <LoadError error={error} retry={unstable_retry} />
        </I18nProvider>
      </body>
    </html>
  );
}
