import { lazy } from "react";
import type { MinigameDefinition } from "@/types/minigame";

/**
 * 미니게임 레지스트리. 새 미니게임은 src/minigames/<id>/index.tsx로 만들고
 * lazy import로 등록한다 (게이트 도달 직전 로드 — .claude/rules/minigames.md).
 * 부착은 src/data/memory-room.ts의 phase 설정에 `interaction: { minigameId }`로.
 */
export const MINIGAMES: Record<string, MinigameDefinition> = {
  "frequency-tune": {
    id: "frequency-tune",
    mode: "overlay",
    component: lazy(() =>
      import("./frequency-tune").then((m) => ({ default: m.FrequencyTuneMinigame })),
    ),
    titleKey: "minigame.frequencyTune.title",
    helpKey: "minigame.frequencyTune.help",
  },
  "photo-wipe": {
    id: "photo-wipe",
    mode: "overlay",
    component: lazy(() => import("./photo-wipe").then((m) => ({ default: m.PhotoWipeMinigame }))),
    titleKey: "minigame.photoWipe.title",
    helpKey: "minigame.photoWipe.help",
  },
  "photo-puzzle": {
    id: "photo-puzzle",
    mode: "overlay",
    component: lazy(() =>
      import("./photo-puzzle").then((m) => ({ default: m.PhotoPuzzleMinigame })),
    ),
    titleKey: "minigame.photoPuzzle.title",
    helpKey: "minigame.photoPuzzle.help",
  },
  "calendar-flip": {
    id: "calendar-flip",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() =>
      import("./calendar-flip").then((m) => ({ default: m.CalendarFlipMinigame })),
    ),
    titleKey: "minigame.calendarFlip.title",
    helpKey: "minigame.calendarFlip.help",
  },
  "phone-chat": {
    id: "phone-chat",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./phone-chat").then((m) => ({ default: m.PhoneChatMinigame }))),
    titleKey: "minigame.phoneChat.title",
    helpKey: "minigame.phoneChat.help",
  },
  "computer-browse": {
    id: "computer-browse",
    mode: "overlay",
    // 책상 위 컴퓨터를 들여다보는 인터랙션 — 패널 없이 모니터만 떠오른다
    presentation: "bare",
    component: lazy(() =>
      import("./computer-browse").then((m) => ({ default: m.ComputerBrowseMinigame })),
    ),
    titleKey: "minigame.computerBrowse.title",
    helpKey: "minigame.computerBrowse.help",
  },
  "phone-lock": {
    id: "phone-lock",
    mode: "overlay",
    // phone-chat과 같은 폰을 집어 드는 인터랙션 — 패널 없이 기기만 떠오른다
    presentation: "bare",
    component: lazy(() => import("./phone-lock").then((m) => ({ default: m.PhoneLockMinigame }))),
    titleKey: "minigame.phoneLock.title",
    helpKey: "minigame.phoneLock.help",
  },
  "fighter-duel": {
    id: "fighter-duel",
    mode: "overlay",
    component: lazy(() =>
      import("./fighter-duel").then((m) => ({ default: m.FighterDuelMinigame })),
    ),
    titleKey: "minigame.fighterDuel.title",
    helpKey: "minigame.fighterDuel.help",
    /*
     * 두 줄 — 상성과 필살기 횟수. 미니게임 하나 붙잡고 읽을 분량이 아니라 시작
     * 버튼을 누르기 전에 훑는 분량이어야 한다 (UT: "미니겜이니까 더 짧아도 될 듯").
     *
     * 조작은 바로 위 helpKey가 이미 말하므로 여기 다시 적지 않는다. 나머지는
     * 화면이 스스로 말한다: 남은 시간은 게이지가 줄어드는 것으로, 페인트는 자세가
     * 바뀌는 순간 붉은 글씨로, 간파·콤보는 들어간 뒤에 뜬다. 몰라도 판이 도는
     * 규칙은 카드에 적지 않는다.
     */
    rulesKeys: ["minigame.fighterDuel.rules.triangle", "minigame.fighterDuel.rules.special"],
  },
  "window-view": {
    id: "window-view",
    mode: "overlay",
    presentation: "bare",
    component: lazy(() => import("./window-view").then((m) => ({ default: m.WindowViewMinigame }))),
    titleKey: "minigame.windowView.title",
    helpKey: "minigame.windowView.help",
  },
  "ball-catch": {
    id: "ball-catch",
    mode: "overlay",
    component: lazy(() => import("./ball-catch").then((m) => ({ default: m.BallCatchMinigame }))),
    titleKey: "minigame.ballCatch.title",
    helpKey: "minigame.ballCatch.help",
  },
};

export function getMinigame(id: string): MinigameDefinition | undefined {
  return MINIGAMES[id];
}
