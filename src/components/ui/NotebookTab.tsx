"use client";

import { useTranslation } from "react-i18next";
import { MEMORIES } from "@/data/memory-room";
import { playSound } from "@/lib/audio";
import { isSeen, selectOnboardingStep, useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "./hover-sfx";
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
  /*
   * 햄버거 메뉴 패널이 열려 있는 동안은 물러난다. 패널이 화면 오른쪽 가운데까지 내려와
   * 손잡이와 겹치는데, 손잡이가 DOM에서 뒤에 있어 패널 위로 올라탔다.
   */
  const menuOpen = useMemoryRoomStore((state) => state.uiLocks.includes("hud-menu"));
  /*
   * 문제집 뒤표지에서 이름을 찾은 직후, 수첩을 한 번도 안 열었으면 손잡이가 금빛으로
   * 숨쉰다 (store의 onboardingStep). 이름을 알았다는 건 수첩이 말하는데, 이 손잡이가
   * 수첩인 줄 모르면 그 말이 닿지 않는다. 막지는 않는다: 한 번 열면 다시는 안 부른다.
   */
  const calling = useMemoryRoomStore(selectOnboardingStep) === "notebook";
  const count = useMemoryRoomStore(
    (state) => MEMORIES.filter((memory) => isSeen(state, memory.id)).length,
  );

  return (
    <button
      type="button"
      onClick={() => {
        playSound("open");
        // 부르던 참이면 이름이 적힌 첫 장으로 편다. 방금 알게 된 게 거기 있다
        setCharacterSheetOpen(true, calling ? "profile" : "lore");
      }}
      aria-label={t("panel.open")}
      aria-hidden={menuOpen || undefined}
      tabIndex={menuOpen ? -1 : undefined}
      onPointerEnter={playHoverSound}
      // 손잡이는 장면 가장자리에 붙은 어두운 탭이다. 밝은 종이 덩어리가 떠 있으면 안 된다.
      // 넓은 화면에서는 HUD 버튼과 같은 배율로 통째로 커진다 (--hud-zoom)
      // 커서가 얹히면 손잡이가 4px 넓어진다. 서랍 손잡이처럼 "당겨진다"는 몸짓이다.
      // 통째로 밀면 오른쪽 끝이 화면 가장자리에서 떨어져 틈이 보인다. 폭으로 늘린다
      className={`absolute right-0 top-1/2 z-30 flex h-30 w-11 -translate-y-1/2 cursor-pointer [zoom:var(--hud-zoom)] flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 border-line bg-surface text-fog transition-[color,background-color,width,opacity] duration-150 ease-out hover:w-12 hover:bg-surface-strong hover:text-ivory focus-visible:w-12 active:w-11 active:bg-surface-strong ${FOCUS_RING} ${menuOpen ? "pointer-events-none opacity-0" : ""} ${calling ? "animate-hotspot-glow text-ivory" : ""}`}
    >
      <span className="text-xs font-medium tracking-[0.06em] [writing-mode:vertical-rl]">
        {t("panel.title")}
      </span>
      <span className="grid h-4 min-w-4 place-items-center rounded-sm bg-memory px-1 text-xs font-medium tabular-nums text-night">
        {count}
      </span>
      {calling && <span className="sr-only">{t("panel.newEntry")}</span>}
    </button>
  );
}
