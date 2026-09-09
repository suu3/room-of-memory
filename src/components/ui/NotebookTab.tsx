"use client";

import { useTranslation } from "react-i18next";
import { memoriesForPhase } from "@/data/memory-room";
import { playSound } from "@/lib/audio";
import { gamePhaseOf, selectCollected, useMemoryRoomStore } from "@/store/memory-room";
import { FOCUS_RING } from "./ui-classes";

/**
 * 화면 오른쪽 가장자리의 "기억 수집" 손잡이. 예전에는 자체 드로어(목록 + 다시보기)를
 * 열었지만, 그 목록이 수첩의 "기록" 페이지와 하는 말이 같아서 합쳤다 — 지금은
 * 수첩을 기록 페이지로 펼치는 입구이고, 손잡이에는 이 바퀴의 수집 개수만 남는다.
 */
export function NotebookTab() {
  const { t } = useTranslation();
  const collected = useMemoryRoomStore(selectCollected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const gamePhase = useMemoryRoomStore(gamePhaseOf);
  const setCharacterSheetOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  /*
   * 두 바퀴는 모으는 대상이 다르다. 1바퀴는 창문·달력까지 일곱 개, 2바퀴는
   * 다시 열리는 여섯 개(컴퓨터가 새로 끼고 창문·달력이 빠진다). 한 목록으로
   * 합쳐 두면 2바퀴 내내 영영 안 채워지는 칸이 남는다.
   */
  const memories = memoriesForPhase(gamePhase);
  const doneIds = gamePhase === 1 ? collected : revisited;
  const count = memories.filter((memory) => doneIds.includes(memory.id)).length;

  return (
    <button
      type="button"
      onClick={() => {
        playSound("open");
        setCharacterSheetOpen(true, "lore");
      }}
      aria-label={t("panel.open")}
      // 손잡이는 장면 가장자리에 붙은 어두운 탭이다 — 밝은 종이 덩어리가 떠 있으면 안 된다
      className={`absolute right-0 top-1/2 z-30 flex h-30 w-11 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 border-line bg-surface text-fog transition-colors duration-150 hover:bg-surface-strong hover:text-ivory active:bg-surface-strong ${FOCUS_RING}`}
    >
      <span className="text-xs font-medium tracking-[0.06em] [writing-mode:vertical-rl]">
        {t("panel.title")}
      </span>
      <span className="grid h-4 min-w-4 place-items-center rounded-sm bg-memory px-1 text-xs font-medium tabular-nums text-night">
        {count}
      </span>
    </button>
  );
}
