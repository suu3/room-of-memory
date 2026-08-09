"use client";

import { ArrowUpRight, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";

/** 연락 수단. 새 항목은 여기에만 추가하면 목록이 따라간다. */
export const CONTACT_LINKS = [
  { label: "Email", value: "dev.suu3@gmail.com", href: "mailto:dev.suu3@gmail.com" },
  { label: "GitHub", value: "github.com/suu3", href: "https://github.com/suu3" },
] as const;

/** 페이지와 모달이 같은 본문을 쓴다 — /contact로 직접 들어와도 내용이 갈리지 않는다. */
export function ContactLinks() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col">
        {CONTACT_LINKS.map((link) => (
          <li key={link.label} className="border-t border-ink/10 last:border-b">
            <a
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="group flex items-center justify-between gap-4 py-4 transition-colors active:bg-ink/5"
            >
              <span className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-ink/45">
                {link.label}
              </span>
              {/* 메일 주소는 어절이 없다 — 좁아지면 어디서든 접히게 두는 편이 잘린 것보다 낫다 */}
              <span className="flex min-w-0 items-center gap-2 break-ko text-right text-sm text-ink/80 transition-colors group-hover:text-ink">
                {link.value}
                <ArrowUpRight
                  size={14}
                  weight="bold"
                  className="text-ink/30 transition-colors group-hover:text-memory"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {/* 지원사업 표기 — 요란하지 않게, 크레딧을 열어본 사람에게만 보인다 */}
      <p className="break-ko text-xs leading-relaxed text-ink/35">{t("contact.support")}</p>
    </div>
  );
}

/**
 * 연락처 모달. 예전에는 /contact로 이동시켰는데, 그러면 3D 캔버스가 통째로
 * 언마운트됐다가 다시 붙고 딤드·바깥클릭 같은 모달 동작도 없었다.
 * 캐릭터 시트와 같은 껍데기를 쓴다.
 */
export function ContactModal() {
  const { t } = useTranslation();
  const open = useMemoryRoomStore((state) => state.contactOpen);
  const setOpen = useMemoryRoomStore((state) => state.setContactOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);

  useEffect(() => {
    setUiLock("contact", open);
    return () => setUiLock("contact", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label={t("contact.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-pointer bg-scene-void/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("contact.title")}
        className="relative w-full max-w-xl animate-fade-rise rounded-xl border border-bone bg-paper p-6 shadow-panel sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 break-ko text-2xl font-bold tracking-tight text-ink">
            {t("contact.title")}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("contact.close")}
            className="cursor-pointer text-ink/60 transition-colors hover:text-ink active:text-ink/80"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="mt-6">
          <ContactLinks />
        </div>
      </div>
    </div>
  );
}
