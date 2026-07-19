import {
  Baseball,
  CalendarHeart,
  DeviceMobile,
  GridFour,
  ImageSquare,
  Radio,
} from "@phosphor-icons/react";
import { BatIcon, type MemoryIcon } from "@/components/ui/icons";
import type { DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

export const MEMORY_IDS = ["bat", "window", "frame", "radio", "phone", "calendar", "ball"] as const;
export type MemoryId = (typeof MEMORY_IDS)[number];

export interface MemoryItem {
  id: MemoryId;
  /** 씬 프레임 기준 핫스팟 위치 (%) */
  x: string;
  y: string;
  /** 수집 패널에 표시할 아이콘 (Phosphor 또는 호환 커스텀) */
  icon: MemoryIcon;
  /** Phase 1: 최초 수집 클릭. 모든 아이템 필수. */
  phase1: MemoryPhaseConfig;
  /** Phase 2: 전원 수집 후 재클릭. 있는 아이템만 재클릭 대상. */
  phase2?: MemoryPhaseConfig;
}

export const MEMORIES: MemoryItem[] = [
  {
    id: "bat",
    x: "13%",
    y: "72%",
    icon: BatIcon,
    phase1: { interaction: { scriptId: "bat-intro" } },
    phase2: { interaction: { scriptId: "bat-echo" } },
  },
  {
    id: "window",
    x: "80%",
    y: "30%",
    icon: GridFour,
    phase1: {},
  },
  {
    id: "frame",
    x: "34%",
    y: "32%",
    icon: ImageSquare,
    phase1: { interaction: { minigameId: "photo-wipe" } },
  },
  {
    id: "radio",
    x: "64%",
    y: "58%",
    icon: Radio,
    phase1: { interaction: { minigameId: "frequency-tune" } },
    phase2: { interaction: { scriptId: "radio-echo" }, unlockAfter: ["bat"] },
  },
  {
    id: "phone",
    x: "44%",
    y: "69%",
    icon: DeviceMobile,
    phase1: {},
  },
  {
    id: "calendar",
    x: "55%",
    y: "22%",
    icon: CalendarHeart,
    phase1: { unlockAfter: ["phone"] },
  },
  {
    id: "ball",
    x: "28%",
    y: "58%",
    icon: Baseball,
    phase1: { interaction: { minigameId: "ball-catch" } },
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

/** 수집 개수 0~2 / 3~4 / 5~6에 대응하는 방의 밝기 3단계 */
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

export function stageIndexFromCount(count: number): number {
  if (count <= 2) return 0;
  if (count <= 4) return 1;
  return 2;
}

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
  "bat-intro": {
    id: "bat-intro",
    lines: [
      { speaker: "hero", textKey: "scripts.bat-intro.line1" },
      { speaker: "hero", textKey: "scripts.bat-intro.line2" },
    ],
  },
  "bat-echo": {
    id: "bat-echo",
    lines: [{ speaker: "hero", textKey: "scripts.bat-echo.line1" }],
  },
  "radio-echo": {
    id: "radio-echo",
    lines: [{ speaker: "hero", textKey: "scripts.radio-echo.line1" }],
  },
};
