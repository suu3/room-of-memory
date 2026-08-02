"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ContactLinks } from "@/components/ui/ContactModal";

/**
 * 직접 URL로 들어왔을 때를 위한 페이지. 게임 안에서는 같은 내용이 모달로 뜬다
 * (라우트를 타면 3D 캔버스가 통째로 다시 마운트된다).
 */
export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6 py-16">
      <div className="w-full max-w-xl rounded-xl border border-bone bg-paper p-10 shadow-panel">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("contact.title")}</h1>
        <div className="mt-7">
          <ContactLinks />
        </div>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-ink/15 px-4 py-1.5 text-xs font-bold tracking-widest text-ink/60 transition-colors hover:border-ink/40 hover:text-ink"
        >
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
