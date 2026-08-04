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
  "fighter-duel": {
    id: "fighter-duel",
    mode: "overlay",
    component: lazy(() =>
      import("./fighter-duel").then((m) => ({ default: m.FighterDuelMinigame })),
    ),
    titleKey: "minigame.fighterDuel.title",
    helpKey: "minigame.fighterDuel.help",
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
