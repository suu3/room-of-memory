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
import type { DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

/**
 * 수집 대상. 배트는 여기 없다 — 문 옆의 배트는 모으는 물건이 아니라 2바퀴를 다
 * 돌았을 때 켜지는 엔딩 트리거다 (layout의 BAT_PLACEMENT, scenes의 EndingTrigger).
 */
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
    phase1: { interaction: { minigameId: "fighter-duel" } },
    phase2: { interaction: { scriptId: "console-echo" } },
  },
  {
    id: "window",
    icon: GridFour,
    /** 커튼을 걷으면 그림 한 장 — 미니게임이라기보다 들여다보는 오브젝트다. */
    phase1: { interaction: { minigameId: "window-view" } },
  },
  {
    id: "frame",
    icon: ImageSquare,
    phase1: { interaction: { minigameId: "photo-wipe", resultScriptId: "frame-photo" } },
    /** 2차 조사: 같은 액자를 다시 닦으면 그늘에 묻혔던 가족 얼굴이 드러난다. */
    phase2: { interaction: { minigameId: "photo-wipe", resultScriptId: "frame-photo-echo" } },
  },
  {
    id: "radio",
    icon: Radio,
    phase1: { interaction: { minigameId: "frequency-tune" } },
    phase2: { interaction: { scriptId: "radio-echo" }, unlockAfter: ["console"] },
  },
  {
    id: "phone",
    icon: DeviceMobile,
    phase1: { interaction: { minigameId: "phone-chat" } },
  },
  {
    id: "calendar",
    icon: CalendarHeart,
    phase1: { interaction: { minigameId: "calendar-flip" }, unlockAfter: ["phone"] },
  },
  {
    id: "ball",
    icon: Baseball,
    phase1: { interaction: { scriptId: "ball-intro", minigameId: "ball-catch" } },
  },
];

export const MEMORY_GOAL = MEMORIES.length;

export const STAGE_IDS = ["dark", "dim", "gold"] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface RoomStage {
  id: StageId;
  /** 방 배경 라디얼 그라디언트 (씬 라이팅 램프 토큰만 사용) */
  background: string;
  /** 창가에서 스며드는 금빛 산광 강도 */
  glowOpacity: number;
  /** 방 곳곳에 흩뿌려진 금빛 산란 강도 */
  scatterOpacity: number;
  vignetteOpacity: number;
}

/**
 * 배경 그라디언트 3단계. 어느 단계를 쓸지는 밝기(0~1)와 바퀴 수가 정하며,
 * 그 판단은 `roomStageIndex`(src/scenes/memory-room/visual-state.ts)가 한다.
 */
export const ROOM_STAGES: RoomStage[] = [
  {
    id: "dark",
    background:
      "radial-gradient(120% 90% at 50% 34%, var(--color-scene-storm) 0%, var(--color-scene-slate) 48%, var(--color-scene-abyss) 100%)",
    glowOpacity: 0.5,
    scatterOpacity: 0.3,
    vignetteOpacity: 0.55,
  },
  {
    id: "dim",
    background:
      "radial-gradient(120% 90% at 55% 32%, var(--color-scene-storm) 0%, var(--color-scene-dusk) 48%, var(--color-scene-slate) 100%)",
    glowOpacity: 0.68,
    scatterOpacity: 0.6,
    vignetteOpacity: 0.42,
  },
  {
    id: "gold",
    background:
      "radial-gradient(120% 95% at 58% 30%, var(--color-scene-olive) 0%, var(--color-scene-dusk) 46%, var(--color-scene-coal) 100%)",
    glowOpacity: 0.9,
    scatterOpacity: 1,
    vignetteOpacity: 0.3,
  },
];

export const MEMORY_BY_ID = Object.fromEntries(
  MEMORIES.map((memory) => [memory.id, memory]),
) as Record<MemoryId, MemoryItem>;

/** 해당 게임 페이즈에서 아이템에 적용되는 설정. Phase 2 미대상이면 undefined. */
export function phaseConfigOf(id: MemoryId, gamePhase: 1 | 2): MemoryPhaseConfig | undefined {
  const item = MEMORY_BY_ID[id];
  return gamePhase === 1 ? item.phase1 : item.phase2;
}

/** 대사 스크립트 레지스트리 — 본문은 i18n 리소스(memoryRoom.scripts.*)에 있다. */
export const SCRIPTS: Record<string, DialogueScript> = {
  "console-echo": {
    id: "console-echo",
    lines: [{ speaker: "hero", textKey: "scripts.console-echo.line1", expression: "smile" }],
  },
  "radio-echo": {
    id: "radio-echo",
    lines: [{ speaker: "hero", textKey: "scripts.radio-echo.line1" }],
  },
  /** 액자를 다 닦은 뒤의 결과 대사 (1차). */
  "frame-photo": {
    id: "frame-photo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo.line1", expression: "smile" },
      { speaker: "hero", textKey: "scripts.frame-photo.line2" },
    ],
  },
  /** 2차 조사에서 가족 얼굴이 드러난 뒤의 결과 대사. */
  "frame-photo-echo": {
    id: "frame-photo-echo",
    lines: [
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.frame-photo-echo.line2", expression: "smile" },
    ],
  },
  "ball-intro": {
    id: "ball-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.ball-intro.line1", expression: "surprised" },
      { speaker: "hero", textKey: "scripts.ball-intro.line2", expression: "smile" },
    ],
  },
};
