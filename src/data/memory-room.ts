/**
 * 기억의 방 데이터 — 대본과 흐름은 content/*.yaml이 소유한다.
 *
 * 여기 남아 있는 것은 대본이 아닌 것들이다: 방 단계의 시각값(그라디언트·글로우),
 * 컷씬 id 상수, 그리고 흐름 데이터를 다루는 헬퍼. 기억 목록·해금 조건·대사는
 * content/에서 생성돼 `./generated/content`로 들어온다.
 *
 * 대사나 진행을 고치려면 content/*.yaml을 고치고 `pnpm content:build`.
 * dev 서버의 /admin에서 편집하면 저장할 때 같은 파이프라인이 돈다.
 */
import type { MemoryPhaseConfig } from "@/types/interaction";
import { MEMORIES, type MemoryId } from "./generated/content";

export { CUTSCENES, MEMORIES, MEMORY_IDS, type MemoryItem, SCRIPTS } from "./generated/content";
export type { MemoryId };

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
 *
 * 대본이 아니라 디자인 토큰이라 YAML로 내리지 않았다 — 단계별 독백 텍스트만
 * content/stages.yaml에 있다.
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
) as Record<MemoryId, (typeof MEMORIES)[number]>;

/** 해당 게임 페이즈에서 아이템에 적용되는 설정. Phase 2 미대상이면 undefined. */
export function phaseConfigOf(id: MemoryId, gamePhase: 1 | 2): MemoryPhaseConfig | undefined {
  const item = MEMORY_BY_ID[id];
  return gamePhase === 1 ? item.phase1 : item.phase2;
}

/**
 * 재난방송이 끊긴 자리에서 도는 전환 컷씬 — 게임 중 일러스트가 화면을 통째로
 * 차지하는 유일한 자리다. 컷 내용은 content/cutscenes.yaml에 있다.
 */
export const CUTSCENE_RADIO_BLACKOUT = "radio-blackout";
