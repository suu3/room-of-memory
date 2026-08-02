"use client";

import { X } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { selectCollected, useMemoryRoomStore } from "@/store/memory-room";
import { BlurredValue } from "./BlurredValue";
import { LoreEntries } from "./LoreEntries";

/**
 * 시트에 싣는 항목. 사태 이전/이후의 성격 변화와 오브젝트 단서는 일부러 뺐다 —
 * 플레이 전에 열어볼 수 있는 화면이라 이야기의 전제를 미리 흘리면 안 된다.
 *
 * `revealAt`은 이 항목이 열리는 데 필요한 수집 개수. 처음엔 전부 흐리게 덮여 있고,
 * 기억을 모을수록 위에서부터 하나씩 드러난다. 기억 7개에 항목 4개라 간격을 두었다.
 */
const TABS = ["profile", "lore"] as const;

const PROFILE_ROWS = [
  { index: 0, revealAt: 1 },
  { index: 1, revealAt: 3 },
  { index: 2, revealAt: 5 },
  { index: 3, revealAt: 7 },
] as const;

/** HUD 메뉴와 대사창 초상 두 곳에서 열리는 캐릭터 자료 모달. */
export function CharacterSheetModal() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const open = useMemoryRoomStore((state) => state.characterSheetOpen);
  const setOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const collectedCount = useMemoryRoomStore(selectCollected).length;
  const [tab, setTab] = useState<(typeof TABS)[number]>("profile");

  useEffect(() => {
    setUiLock("character-sheet", open);
    return () => setUiLock("character-sheet", false);
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
    // grid가 아니라 flex — grid의 auto row는 내용만큼 늘어나서 max-h-full이 무력해진다
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label={t("characterSheet.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-pointer bg-scene-void/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("characterSheet.title")}
        className="relative flex max-h-full w-full max-w-5xl animate-fade-rise flex-col rounded-xl border border-bone bg-paper shadow-panel"
      >
        <div className="flex flex-none items-baseline justify-between gap-3 px-5 pb-3 pt-4">
          {/* 이름만 — 나이·소속은 아래에서 가려두는 항목이라 헤더에 적으면 가리는 의미가 없다 */}
          <div className="flex items-baseline gap-5">
            <span className="text-sm font-bold tracking-wide text-ink">
              {tRoom("characters.hero.name")}
            </span>
            <div role="tablist" aria-label={t("characterSheet.title")} className="flex gap-1">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold tracking-widest transition-colors ${
                    tab === id ? "bg-ink text-paper" : "text-ink/45 hover:text-ink"
                  }`}
                >
                  {t(id === "profile" ? "characterSheet.tabProfile" : "characterSheet.tabLore")}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("characterSheet.close")}
            className="cursor-pointer text-ink/60 transition-colors hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="h-px flex-none bg-ink/10" />
        {/* 시트는 세로로 길다 — 모달을 늘리지 말고 안쪽만 스크롤시킨다 */}
        <div className="scroll-paper min-h-0 overflow-y-auto px-6 py-5">
          {tab === "lore" ? (
            <div className="mx-auto max-w-2xl">
              <LoreEntries />
            </div>
          ) : (
            /* SD 캐릭터 위쪽이 비어 있어서, 넓은 화면에서는 프로필을 그 자리에 겹친다 */
            <div className="relative">
              <Image
                src={ASSETS.images.characterHeroSheet}
                alt={t("characterSheet.alt")}
                width={1400}
                height={1570}
                sizes="(min-width: 768px) 920px, 100vw"
                className="h-auto w-full"
              />
              <dl className="mt-6 flex w-full flex-col md:absolute md:right-[4%] md:top-[6%] md:mt-0 md:w-[38%]">
                {PROFILE_ROWS.map((row) => {
                  const revealed = collectedCount >= row.revealAt;
                  return (
                    <div
                      key={row.index}
                      className="border-t border-ink/10 py-3.5 first:border-t-0 first:pt-0"
                    >
                      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ink/40">
                        {tRoom(
                          `characters.hero.profile.${row.index}.label` as ParseKeys<"memoryRoom">,
                        )}
                      </dt>
                      <dd>
                        {revealed ? (
                          <span className="mt-1.5 block animate-fade-rise text-sm leading-relaxed text-ink/80">
                            {tRoom(
                              `characters.hero.profile.${row.index}.value` as ParseKeys<"memoryRoom">,
                            )}
                          </span>
                        ) : (
                          <span className="mt-1.5 block">
                            <BlurredValue
                              text={tRoom(
                                `characters.hero.profile.${row.index}.value` as ParseKeys<"memoryRoom">,
                              )}
                              label={t("characterSheet.locked")}
                              hint={t("characterSheet.lockedHint")}
                            />
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
