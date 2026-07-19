"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6">
      <div className="w-full max-w-md -rotate-1 rounded-lg border-2 border-bone bg-paper p-8 shadow-panel">
        <h1 className="flex items-center gap-2.5 text-lg font-bold text-ink">
          <span aria-hidden className="w-5 border-t-2 border-dashed border-ember" />
          {t("contact.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{t("contact.body")}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full border-2 border-ink/20 px-4 py-1.5 text-xs font-bold tracking-widest text-ink/70 transition-colors hover:border-ember hover:text-ember"
        >
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
