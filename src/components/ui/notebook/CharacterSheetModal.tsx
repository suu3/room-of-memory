"use client";

import { X } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import Image from "next/image";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PROFILE_ROWS } from "@/data/notebook";
import { ASSETS } from "@/lib/assets";
import {
  type CharacterSheetTab,
  selectCollected,
  selectDoorOpened,
  selectHeroNameKnown,
  selectUnreadNotebookTabs,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { BlurredValue } from "./BlurredValue";
import { LoreEntries } from "./LoreEntries";
import { NotebookItems } from "./NotebookItems";
import { NotebookMap } from "./NotebookMap";

/**
 * 시트에 싣는 항목. 사태 이전/이후의 성격 변화와 오브젝트 단서는 일부러 뺐다.
 * 플레이 전에 열어볼 수 있는 화면이라 이야기의 전제를 미리 흘리면 안 된다.
 *
 * 칸 목록은 src/data/notebook.ts의 PROFILE_ROWS다 (안 읽은 알림도 같은 목록을 센다).
 * `revealAt`은 이 항목이 열리는 데 필요한 수집 개수. 처음엔 전부 흐리게 덮여 있고,
 * 기억을 모을수록 위에서부터 하나씩 드러난다. 기억 7개에 항목 3개라 간격을 두었다.
 *
 * 나이(0번)는 기억이 아니라 **방에서 알아내는** 칸이다 (`discovery`). 책상 위 문제집을
 * 뒤집어 보면 이름과 학년이 적혀 있고, 그 순간 헤더의 이름과 이 칸이 함께 열린다
 * (src/data/room-clues.ts의 DISCOVERY_IDS). 자기 이름을 기억 수집으로 되찾는 건 이상하다.
 */
/**
 * 평면도는 늘 있는 페이지가 아니다. 방 하나뿐인 1막에 평면도를 펼치면 칸 하나가
 * 덩그러니 놓인 종이가 나오고, 아직 없는 이야기(집이 더 있다)를 먼저 흘린다.
 * 방문이 열리는 순간(2막) 수첩에 한 장이 늘어난다.
 */
const TAB_LABEL = {
  profile: "characterSheet.tabProfile",
  lore: "characterSheet.tabLore",
  map: "characterSheet.tabMap",
  items: "characterSheet.tabItems",
} as const satisfies Record<CharacterSheetTab, string>;

/** HUD 메뉴와 대사창 초상 두 곳에서 열리는 캐릭터 자료 모달. */
export function CharacterSheetModal() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const open = useMemoryRoomStore((state) => state.characterSheetOpen);
  const setOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const collectedCount = useMemoryRoomStore(selectCollected).length;
  const discoveries = useMemoryRoomStore((state) => state.discoveries);
  const nameKnown = useMemoryRoomStore(selectHeroNameKnown);
  // 탭은 스토어에 있다. 오른쪽 "기억 수집" 탭이 기록 페이지를 지정해 열기 때문
  const stored = useMemoryRoomStore((state) => state.characterSheetTab);
  const setTab = useMemoryRoomStore((state) => state.setCharacterSheetTab);
  // 평면도는 방문이 열린 뒤에만 있는 페이지다. 리셋 뒤 저장된 탭이 남아 있어도 안 편다
  const hasMap = useMemoryRoomStore(selectDoorOpened);
  /* 소지품은 늘 있는 페이지다. 빈손이어도 빈 상태 한 줄이 서면 그만이고, 평면도와 달리
     아직 안 가본 집을 미리 알려 주지도 않는다 */
  const tabs: readonly CharacterSheetTab[] = hasMap
    ? ["profile", "lore", "map", "items"]
    : ["profile", "lore", "items"];
  const tab = tabs.includes(stored) ? stored : "profile";
  const markRead = useMemoryRoomStore((state) => state.markNotebookRead);
  const unread = useMemoryRoomStore(selectUnreadNotebookTabs).split(",");

  /* 펼친 페이지는 읽은 것이다. 펼쳐 둔 사이에 새로 적힌 것도 (unread가 바뀌면) 같이 읽힌다 */
  const unreadKey = unread.join(",");
  useEffect(() => {
    if (open && unreadKey.split(",").includes(tab)) markRead(tab);
  }, [open, tab, unreadKey, markRead]);

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
    // grid가 아니라 flex: grid의 auto row는 내용만큼 늘어나서 max-h-full이 무력해진다
    // overflow-clip: hidden이면 주소창이 오르내릴 때 브라우저가 이 상자를 굴려 수첩 위쪽(탭)이 잘린다
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-clip p-4">
      <button
        type="button"
        aria-label={t("characterSheet.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-pointer bg-scene-void/60"
      />
      {/*
        이름이 "수첩"이면 수첩처럼 보여야 한다. 낱장 종이에 이름만 바꾸면 껍데기와
        알맹이가 어긋난다. 왼쪽에 링 제본 여백, 페이지에 모눈, 위쪽에 종이 인덱스 탭.
        전부 CSS다 (globals.css의 .notebook-*).
        높이는 탭과 무관하게 화면을 채운다. 소지품처럼 짧은 탭에서 수첩이 쪼그라들면
        탭을 넘길 때마다 판이 튄다.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("characterSheet.title")}
        className="relative flex h-full max-h-full w-full max-w-5xl animate-fade-rise overflow-clip rounded-lg border border-ink/12 bg-paper text-ink shadow-panel"
      >
        {/* 제본 여백. 구멍이 뚫린 이 폭만큼 페이지가 오른쪽에서 시작한다 */}
        <div
          aria-hidden
          className="notebook-punch w-9 flex-none border-r border-ink/10 bg-bone/40 sm:w-10"
        />
        {/* 접힘 그림자는 페이지 위에 얹는다. 스크롤을 따라 움직이면 접힌 자국이 아니다 */}
        <div
          aria-hidden
          className="notebook-gutter pointer-events-none absolute left-9 top-0 z-20 h-full w-5 sm:left-10"
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/*
            탭은 페이지 위쪽에 붙은 종이 인덱스다. 고른 탭은 아래 헤어라인을 제 배경으로
            덮어 페이지와 한 장으로 이어지고, 나머지는 뒤에 깔린 종이로 물러난다.
          */}
          <div className="flex flex-none items-end justify-between gap-3 px-5 pt-4">
            {/*
              이름만: 나이·소속은 아래에서 가려두는 항목이라 헤더에 적으면 가리는 의미가 없다.
              이름도 문제집 뒤표지를 보기 전까지는 막대다 (BlurredValue와 같은 이유로 본문을 싣지 않는다).
            */}
            <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-2">
              {nameKnown ? (
                <span className="truncate pb-1.5 text-sm font-medium text-ink">
                  {tRoom("characters.hero.name")}
                </span>
              ) : (
                <span className="flex items-center pb-2.5">
                  <span className="sr-only">{t("characterSheet.nameUnknown")}</span>
                  <span aria-hidden className="block h-2.5 w-14 rounded-sm bg-bone/70" />
                </span>
              )}
              <div
                role="tablist"
                aria-label={t("characterSheet.title")}
                className="relative z-10 -mb-px flex flex-none gap-1"
              >
                {tabs.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={`cursor-pointer rounded-t-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
                      tab === id
                        ? "border-ink/15 border-b-transparent bg-paper text-ink"
                        : "border-transparent bg-bone/50 text-graphite hover:text-ink active:bg-bone/70"
                    }`}
                  >
                    {t(TAB_LABEL[id])}
                    {/* 아직 안 펼쳐 본 것이 적힌 페이지: 탭 글자 옆 금빛 점 하나 */}
                    {id !== tab && unread.includes(id) && (
                      <>
                        <span
                          aria-hidden
                          className="ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-memory align-middle"
                        />
                        <span className="sr-only">{t("panel.newEntry")}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("characterSheet.close")}
              className="flex-none cursor-pointer pb-1.5 text-graphite transition-colors hover:text-ink active:text-ink/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
          <div className="h-px flex-none bg-ink/10" />
          {/* 시트는 세로로 길다. 모달을 늘리지 말고 안쪽만 스크롤시킨다 */}
          {/*
            overscroll-contain: 페이지 끝에 닿은 스크롤이 뒤로 새어 나가지 않게 한다.
            없으면 끝까지 넘긴 순간 스크롤이 조상으로 이어져(scroll chaining) 방이
            딸려 움직인다. 수첩을 보는 동안 뒤가 흔들리면 수첩이 화면 위에 얹힌
            종이가 아니라 페이지의 일부처럼 보인다.
          */}
          <div className="notebook-grid scroll-paper min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {tab === "map" ? (
              <NotebookMap />
            ) : tab === "items" ? (
              <NotebookItems />
            ) : tab === "lore" ? (
              /* 갤러리는 3열까지 벌어진다. 프로필처럼 2xl로 묶으면 카드가 눌린다 */
              <div className="mx-auto max-w-4xl py-1">
                <LoreEntries onReplay={() => setOpen(false)} />
              </div>
            ) : (
              /* 시트는 빈자리 없는 세로 상반신이다. 겹치지 말고 넓은 화면에서는 옆에, 좁으면 아래에 둔다 */
              <div className="md:grid md:grid-cols-5 md:items-start md:gap-8">
                <Image
                  src={ASSETS.images.characterHeroSheet}
                  alt={t("characterSheet.alt")}
                  width={1750}
                  height={2653}
                  sizes="(min-width: 768px) 400px, 60vw"
                  className="mx-auto h-auto w-3/5 md:col-span-2 md:w-full"
                />
                <dl className="mt-6 flex w-full flex-col md:col-span-3 md:mt-0">
                  {PROFILE_ROWS.map((row) => {
                    const revealed =
                      "revealAt" in row
                        ? collectedCount >= row.revealAt
                        : discoveries.includes(row.discovery);
                    return (
                      <div
                        key={row.index}
                        className="border-t border-ink/10 py-3.5 first:border-t-0 first:pt-0"
                      >
                        <dt className="text-xs font-medium tracking-[0.06em] text-graphite">
                          {tRoom(
                            `characters.hero.profile.${row.index}.label` as ParseKeys<"memoryRoom">,
                          )}
                        </dt>
                        <dd>
                          {revealed ? (
                            <span className="mt-1.5 block animate-fade-rise break-ko text-pretty text-sm leading-normal text-ink">
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
                                label={t(
                                  "revealAt" in row
                                    ? "characterSheet.locked"
                                    : "characterSheet.lockedClue",
                                )}
                                hint={t(
                                  "revealAt" in row
                                    ? "characterSheet.lockedHint"
                                    : "characterSheet.lockedHintClue",
                                )}
                              />
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {/* 3D 모델은 여기 없다. 자기 모습을 보는 자리는 방의 전신거울이다 (CharacterModelViewer) */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
