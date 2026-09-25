/**
 * 기억의 방 데이터: 대본과 흐름은 content/*.yaml이 소유한다.
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

/**
 * 1바퀴에 조사할 수 있는 기억. phase1이 없는 기억(컴퓨터)은 1바퀴 내내 잠겨 있어
 * 여기 끼지 않는다. 끼우면 절대 못 채우는 수를 분모로 삼는 셈이라 2바퀴가 영영
 * 안 열린다.
 */
export const PHASE1_MEMORIES = MEMORIES.filter((memory) => memory.phase1);

/** 1바퀴 수집 목표. 2바퀴 개방 조건이자 방 밝기 하강 구간의 분모다. */
export const MEMORY_GOAL = PHASE1_MEMORIES.length;

/** 2바퀴에 다시 조사하는 기억. 1바퀴에만 있던 것(창문·달력)은 여기 없다. */
export const PHASE2_MEMORIES = MEMORIES.filter((memory) => memory.phase2);

/**
 * 이 바퀴에 모으는 기억들. 진행 표시와 기억 패널이 같은 목록을 본다.
 * 두 바퀴는 모으는 대상이 다르므로 한 목록으로 합쳐 놓으면 2바퀴 내내
 * "영영 안 채워지는 칸"(창문·달력)이 남는다.
 */
export function memoriesForPhase(gamePhase: 1 | 2) {
  return gamePhase === 1 ? PHASE1_MEMORIES : PHASE2_MEMORIES;
}

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
 * 대본이 아니라 디자인 토큰이라 YAML로 내리지 않았다. 상단 독백은 이 단계가 아니라
 * 조사 개수를 따른다 (content/stages.yaml, src/data/monologue.ts).
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
 * 다시보기에서 1막 사진이 2막 사진의 **어느 부분**을 담고 있는가 (정규화 0~1).
 *
 * 두 바퀴의 그림을 가진 기억은 그 둘을 겹쳐 세워야 넘어갈 때 물체가 둘로 보이지
 * 않는다 (PhotoMorph). 액자의 두 장은 같은 장면의 다른 크롭이다: 1막 사진은 2막
 * 사진의 아래쪽 가운데를 잘라낸 것이라, 위로 21%가 잘려 나간 자리에 부모의 얼굴이
 * 있다. 틀이 그만큼 물러나는 것이 곧 "얼굴이 돌아오는" 동작이다.
 *
 * 값은 두 그림의 밝기를 겹쳐 재서 얻었다 (정규화 상호상관 최대). 그림을 다시 뽑으면
 * 다시 재야 한다. 대본이 아니라 그림의 치수라 YAML이 아니라 여기 있다.
 */
export const REPLAY_MORPH_WITHIN: Partial<Record<MemoryId, ReplayMorphWithin>> = {
  frame: { x: 0.12, y: 0.2125, width: 0.69, height: 0.7867 },
};

export interface ReplayMorphWithin {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 재난방송이 끊긴 자리에서 도는 전환 컷씬: 게임 중 일러스트가 화면을 통째로
 * 차지하는 유일한 자리다. 컷 내용은 content/cutscenes.yaml에 있다.
 */
export const CUTSCENE_RADIO_BLACKOUT = "radio-blackout";
/** 앰플을 쥔 직후의 작별의 회상. 이 재생이 끝나면 2막이 닫히고 3막이 열린다. */
export const CUTSCENE_FAREWELL = "farewell";
/** 현관의 배트를 쥔 순간의 두 줄. 끝나면 스토어가 배트를 쥔 것으로 적는다 (takeBat). */
export const CUTSCENE_BAT_GRIP = "bat-grip";

/**
 * 2막을 닫는 기억: 이걸 되찾으면 3막이 열린다 (docs/content-design.md 2장).
 *
 * 이름을 코드에 박는 대신 여기 한 곳에만 둔다. 흐름은 content/memories.yaml이
 * 소유하고, 코드는 "마지막 칸이 무엇인가"만 안다.
 */
export const ACT2_FINAL_MEMORY = "ampoule" as MemoryId;

/**
 * 2막의 필수 추리 체인. 앰플에서 `unlockAfter`를 거슬러 올라가 얻는다.
 * 목록을 손으로 적으면 YAML을 고칠 때마다 두 곳이 어긋난다.
 *
 * 이 체인 밖의 2차 조사(게임기·컴퓨터·폰)는 곁가지라 3막을 막지 않고, 밝기
 * 상승 곡선의 분모에도 끼지 않는다. 안 본 사람의 방이 덜 밝으면 곁가지가
 * 곁가지가 아니게 된다.
 */
export const ACT2_CHAIN: MemoryId[] = (() => {
  const chain: MemoryId[] = [];
  const walk = (id: MemoryId) => {
    if (chain.includes(id)) return;
    const config = MEMORY_BY_ID[id]?.phase2;
    if (!config) return;
    for (const dep of config.unlockAfter ?? []) walk(dep);
    chain.push(id);
  };
  walk(ACT2_FINAL_MEMORY);
  return chain;
})();
