"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6">
      <div className="w-full max-w-md rounded-md border border-bone/15 bg-ink/90 p-8 shadow-panel">
        <h1 className="text-lg font-bold text-bone">{t("contact.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-fog">{t("contact.body")}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full border border-memory/40 px-4 py-1.5 text-xs font-bold tracking-widest text-memory transition-colors hover:border-memory"
        >
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
