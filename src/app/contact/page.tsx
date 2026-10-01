"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ContactLinks } from "@/components/ui/hud/ContactModal";
import { BUTTON_QUIET, PANEL_DARK } from "@/components/ui/shared/ui-classes";

/**
 * 직접 URL로 들어왔을 때를 위한 페이지. 게임 안에서는 같은 내용이 모달로 뜬다
 * (라우트를 타면 3D 캔버스가 통째로 다시 마운트된다).
 */
export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6 py-16">
      <div className={`w-full max-w-xl p-8 sm:p-10 ${PANEL_DARK}`}>
        <h1 className="text-xl font-medium leading-snug text-ivory">{t("contact.title")}</h1>
        <div className="mt-7">
          <ContactLinks />
        </div>
        <Link href="/" className={`${BUTTON_QUIET} mt-8`}>
          ← {t("contact.back")}
        </Link>
      </div>
    </main>
  );
}
