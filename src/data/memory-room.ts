import type { DialogueScript, MemoryPhaseConfig } from "@/types/interaction";

export const MEMORY_IDS = ["bat", "window", "radio", "phone", "calendar", "ball"] as const;
export type MemoryId = (typeof MEMORY_IDS)[number];

export interface MemoryItem {
  id: MemoryId;
  /** 씬 프레임 기준 핫스팟 위치 (%) */
  x: string;
  y: string;
  /** 24x24 stroke 아이콘의 path d */
  iconPath: string;
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
    iconPath: "M4.5 19.5 14.5 9.5M14.5 9.5 19 3.8 20.4 5.2 14.5 9.5M3.6 17.2 6.8 20.4",
    phase1: { interaction: { scriptId: "bat-intro" } },
    phase2: { interaction: { scriptId: "bat-echo" } },
  },
  {
    id: "window",
    x: "80%",
    y: "30%",
    iconPath: "M4.8 3.8h14.4v16.4H4.8zM12 3.8v16.4M4.8 12h14.4",
    phase1: {},
  },
  {
    id: "radio",
    x: "64%",
    y: "58%",
    iconPath:
      "M3.6 9.4h16.8a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1v-8.2a1 1 0 0 1 1-1zM6.4 9.4 17 4.2M11.8 14.5a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0M14.8 12.8h3.6M14.8 16h3.6",
    phase1: {},
    phase2: { interaction: { scriptId: "radio-echo" }, unlockAfter: ["bat"] },
  },
  {
    id: "phone",
    x: "44%",
    y: "69%",
    iconPath:
      "M8 2.8h8a1.4 1.4 0 0 1 1.4 1.4v15.6A1.4 1.4 0 0 1 16 21.2H8a1.4 1.4 0 0 1-1.4-1.4V4.2A1.4 1.4 0 0 1 8 2.8zM10.6 18.2h2.8",
    phase1: {},
  },
  {
    id: "calendar",
    x: "55%",
    y: "22%",
    iconPath:
      "M5 5.6h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1zM4 10h16M8.4 3.2v4M15.6 3.2v4M16.1 14.4a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0",
    phase1: { unlockAfter: ["phone"] },
  },
  {
    id: "ball",
    x: "28%",
    y: "58%",
    iconPath:
      "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M7.2 5.4c2.4 2.6 2.4 10.6 0 13.2M16.8 5.4c-2.4 2.6-2.4 10.6 0 13.2",
    phase1: {},
  },
];

export const MEMORY_GOAL = MEMORIES.length;

export const STAGE_IDS = ["dark", "dim", "gold"] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface RoomStage {
  id: StageId;
  /** 방 배경 라디얼 그라디언트 (씬 라이팅 램프 토큰만 사용) */
  background: string;
  beamWidth: number;
  beamOpacity: number;
  washOpacity: number;
  vignetteOpacity: number;
}

/** 수집 개수 0~2 / 3~4 / 5~6에 대응하는 방의 밝기 3단계 */
export const ROOM_STAGES: RoomStage[] = [
  {
    id: "dark",
    background:
      "radial-gradient(120% 90% at 50% 34%, var(--color-scene-slate) 0%, var(--color-scene-mist) 45%, var(--color-scene-deep) 100%)",
    beamWidth: 54,
    beamOpacity: 0.5,
    washOpacity: 0,
    vignetteOpacity: 0.75,
  },
  {
    id: "dim",
    background:
      "radial-gradient(120% 90% at 55% 32%, var(--color-scene-storm) 0%, var(--color-scene-slate) 48%, var(--color-scene-abyss) 100%)",
    beamWidth: 150,
    beamOpacity: 0.7,
    washOpacity: 0.35,
    vignetteOpacity: 0.6,
  },
  {
    id: "gold",
    background:
      "radial-gradient(120% 95% at 58% 30%, var(--color-scene-olive) 0%, var(--color-scene-dusk) 46%, var(--color-scene-coal) 100%)",
    beamWidth: 260,
    beamOpacity: 0.9,
    washOpacity: 1,
    vignetteOpacity: 0.42,
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
