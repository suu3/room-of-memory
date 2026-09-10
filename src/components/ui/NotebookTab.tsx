"use client";

import { useTranslation } from "react-i18next";
import { MEMORIES } from "@/data/memory-room";
import { playSound } from "@/lib/audio";
import { isSeen, useMemoryRoomStore } from "@/store/memory-room";
import { FOCUS_RING } from "./ui-classes";

/**
 * 화면 오른쪽 가장자리의 "기억 수집" 손잡이. 예전에는 자체 드로어(목록 + 다시보기)를
 * 열었지만, 그 목록이 수첩의 "기록" 페이지와 하는 말이 같아서 합쳤다. 지금은
 * 수첩을 기록 페이지로 펼치는 입구이고, 손잡이에는 수첩에 적힌 기억의 수가 남는다.
 */
export function NotebookTab() {
  const { t } = useTranslation();
  const setCharacterSheetOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  /*
   * 이 바퀴의 진행이 아니라 **수첩에 적힌 것 전부**를 센다. HUD는 바퀴마다 목록을
   * 갈지만 수첩은 갈지 않는다. 2바퀴에 들어서는 순간 배지가 7에서 0으로 떨어지면,
   * 열어 보면 일곱 개가 그대로 있는 수첩과 배지가 서로 다른 말을 한다.
   */
  const count = useMemoryRoomStore(
    (state) => MEMORIES.filter((memory) => isSeen(state, memory.id)).length,
  );

  return (
    <button
      type="button"
      onClick={() => {
        playSound("open");
        setCharacterSheetOpen(true, "lore");
      }}
      aria-label={t("panel.open")}
      // 손잡이는 장면 가장자리에 붙은 어두운 탭이다. 밝은 종이 덩어리가 떠 있으면 안 된다
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
