/**
 * 이 파일은 생성물이다 — 직접 고치지 말 것.
 *
 * 원본은 content/*.yaml, 생성은 `pnpm content:build` (dev 서버의 /admin에서
 * 저장해도 같은 것이 돈다). 손으로 고치면 다음 생성 때 그대로 덮인다.
 */

import {
  Baseball,
  CalendarHeart,
  DeviceMobile,
  GameController,
  GridFour,
  ImageSquare,
  Radio,
} from "@phosphor-icons/react";
import type { MemoryIcon } from "@/components/ui/icons";
import type { Cutscene, DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

/** 기억 id — content/memories.yaml에 적힌 순서 그대로. 패널에도 이 순서로 뜬다. */
export const MEMORY_IDS = [
  "console",
  "window",
  "frame",
  "radio",
  "phone",
  "calendar",
  "ball",
] as const;

export type MemoryId = (typeof MEMORY_IDS)[number];

export interface MemoryItem {
  id: MemoryId;
  /** 수집 패널에 표시할 아이콘 (Phosphor 또는 호환 커스텀) */
  icon: MemoryIcon;
  /** Phase 1: 최초 수집 클릭. 모든 아이템 필수. */
  phase1: MemoryPhaseConfig;
  /** Phase 2: 전원 수집 후 재클릭. 있는 아이템만 재클릭 대상. */
  phase2?: MemoryPhaseConfig;
}

export const MEMORIES: MemoryItem[] = [
  {
    id: "console",
    icon: GameController,
    phase1: {
      interaction: {
        scriptId: "console-intro",
        minigameId: "fighter-duel",
        resultScriptId: "console-alone",
      },
    },
    phase2: { interaction: { scriptId: "console-echo" }, unlockAfter: ["radio"] },
  },
  {
    id: "window",
    icon: GridFour,
    phase1: {
      interaction: { minigameId: "window-view", resultScriptId: "window-silence" },
      replayStill: "/assets/images/mg-window-view-outside.webp",
    },
  },
  {
    id: "frame",
    icon: ImageSquare,
    phase1: {
      interaction: { minigameId: "photo-wipe", resultScriptId: "frame-photo" },
      replayStill: "/assets/images/mg-photo-wipe-phase-1.webp",
    },
    phase2: {
      interaction: { minigameId: "photo-puzzle", resultScriptId: "frame-photo-echo" },
      unlockAfter: ["radio"],
      replayStill: "/assets/images/mg-photo-wipe-phase-2.webp",
    },
  },
  {
    id: "radio",
    icon: Radio,
    phase1: {
      interaction: {
        scriptId: "radio-intro",
        minigameId: "frequency-tune",
        resultScriptId: "radio-broadcast",
      },
      unlockAfter: ["console", "window", "frame", "phone", "calendar", "ball"],
    },
    phase2: {
      interaction: {
        scriptId: "radio-voice-intro",
        minigameId: "frequency-tune",
        resultScriptId: "radio-voice",
      },
    },
  },
  {
    id: "phone",
    icon: DeviceMobile,
    phase1: { interaction: { minigameId: "phone-chat", resultScriptId: "phone-stopped" } },
  },
  {
    id: "calendar",
    icon: CalendarHeart,
    phase1: {
      interaction: {
        scriptId: "calendar-intro",
        minigameId: "calendar-flip",
        resultScriptId: "calendar-tally",
      },
      unlockAfter: ["phone"],
    },
  },
  {
    id: "ball",
    icon: Baseball,
    phase1: {
      interaction: { scriptId: "ball-intro", minigameId: "ball-catch" },
      replayStill: "/assets/images/mg-ball-catch-sunset-field.webp",
    },
    phase2: { interaction: { scriptId: "ball-echo" }, unlockAfter: ["radio"] },
  },
];

/** 대사 스크립트 레지스트리 — 본문은 i18n 리소스(memoryRoom.scripts.*)에 있다. */
export const SCRIPTS: Record<string, DialogueScript> = {
  "ball-intro": {
    id: "ball-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-intro.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.ball-intro.line2", expression: "smile" },
    ],
  },
  "frame-photo": {
    id: "frame-photo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.frame-photo.line2" },
    ],
  },
  "frame-photo-echo": {
    id: "frame-photo-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line2", expression: "smile" },
    ],
  },
  "console-intro": {
    id: "console-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.console-intro.line1" },
      { speaker: "hero", textKey: "scripts.console-intro.line2", expression: "smile" },
    ],
  },
  "console-alone": {
    id: "console-alone",
    lines: [
      { speaker: "hero", textKey: "scripts.console-alone.line1" },
      { speaker: "hero", textKey: "scripts.console-alone.line2" },
    ],
  },
  "console-echo": {
    id: "console-echo",
    lines: [{ speaker: "hero", textKey: "scripts.console-echo.line1", expression: "smile" }],
  },
  "window-silence": {
    id: "window-silence",
    lines: [
      { speaker: "hero", textKey: "scripts.window-silence.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.window-silence.line2" },
    ],
  },
  "phone-stopped": {
    id: "phone-stopped",
    lines: [
      { speaker: "hero", textKey: "scripts.phone-stopped.line1" },
      { speaker: "hero", textKey: "scripts.phone-stopped.line2" },
    ],
  },
  "calendar-intro": {
    id: "calendar-intro",
    lines: [{ speaker: "hero", textKey: "scripts.calendar-intro.line1" }],
  },
  "calendar-tally": {
    id: "calendar-tally",
    lines: [
      { speaker: "hero", textKey: "scripts.calendar-tally.line1" },
      { speaker: "hero", textKey: "scripts.calendar-tally.line2" },
    ],
  },
  "radio-intro": {
    id: "radio-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.radio-intro.line1" },
      { speaker: "hero", textKey: "scripts.radio-intro.line2" },
    ],
  },
  "radio-broadcast": {
    id: "radio-broadcast",
    lines: [
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line1" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line2" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line3" },
      { speaker: "broadcast", textKey: "scripts.radio-broadcast.line4" },
    ],
  },
  "radio-voice-intro": {
    id: "radio-voice-intro",
    lines: [{ speaker: "hero", textKey: "scripts.radio-voice-intro.line1" }],
  },
  "radio-voice": {
    id: "radio-voice",
    lines: [
      { speaker: "signal", textKey: "scripts.radio-voice.line1" },
      { speaker: "signal", textKey: "scripts.radio-voice.line2" },
      { speaker: "hero", textKey: "scripts.radio-voice.line3", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.radio-voice.line4" },
    ],
  },
  "ball-echo": {
    id: "ball-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-echo.line1" },
      { speaker: "hero", textKey: "scripts.ball-echo.line2", expression: "smile" },
    ],
  },
};

export const CUTSCENES: Record<string, Cutscene> = {
  "radio-blackout": {
    id: "radio-blackout",
    cuts: [
      {
        image: "/assets/images/cutscene-radio-room.webp",
        lines: [{ speaker: "hero", textKey: "cutscenes.radio-blackout.cut1.line1" }],
      },
      {
        image: "/assets/images/cutscene-radio-hands.webp",
        holdMs: 3200,
        lines: [{ speaker: "hero", textKey: "cutscenes.radio-blackout.cut2.line1" }],
      },
      {
        image: "/assets/images/cutscene-radio-signal.webp",
        lines: [
          { speaker: "signal", textKey: "cutscenes.radio-blackout.cut3.line1" },
          {
            speaker: "hero",
            textKey: "cutscenes.radio-blackout.cut3.line2",
            expression: "surprised",
          },
        ],
      },
    ],
  },
};
