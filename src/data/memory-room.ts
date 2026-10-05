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
import type { MemoryPhaseConfig, Visit } from "@/types/interaction";
import { MEMORIES, type MemoryId } from "./generated/content";
import { visitConfig } from "./story-phase";

export { CUTSCENES, MEMORIES, MEMORY_IDS, SCRIPTS } from "./generated/content";
export type { MemoryId };

/**
 * 1바퀴에 조사할 수 있는 기억. phase1이 없는 기억(컴퓨터)은 1바퀴 내내 잠겨 있어
 * 여기 끼지 않는다. 끼우면 절대 못 채우는 수를 분모로 삼는 셈이라 2바퀴가 영영
 * 안 열린다.
 */
export const PHASE1_MEMORIES = MEMORIES.filter((memory) => memory.phase1);

/** 1바퀴 수집 목표. 2바퀴 개방 조건이자 방 밝기 하강 구간의 분모다. */
export const MEMORY_GOAL = PHASE1_MEMORIES.length;

/**
 * 2바퀴에 조사하는 기억: 2차나 3차가 있는 것. 1바퀴에만 있던 것(창문·달력)은 없다.
 * 곁가지(게임기·공의 2차)는 뺀다. 진행 표시의 분모가 곁가지를 세면 안 본 사람의
 * 칸이 영영 안 찬다.
 */
const PHASE2_MEMORIES = MEMORIES.filter(
  (memory) => (memory.phase2 && !memory.phase2.side) || memory.phase3,
);

/**
 * 이 바퀴에 모으는 기억들. 진행 표시와 기억 패널이 같은 목록을 본다.
 * 두 바퀴는 모으는 대상이 다르므로 한 목록으로 합쳐 놓으면 2바퀴 내내
 * "영영 안 채워지는 칸"(창문·달력)이 남는다.
 */
export function memoriesForPhase(gamePhase: 1 | 2) {
  return gamePhase === 1 ? PHASE1_MEMORIES : PHASE2_MEMORIES;
}

export const MEMORY_BY_ID = Object.fromEntries(
  MEMORIES.map((memory) => [memory.id, memory]),
) as Record<MemoryId, (typeof MEMORIES)[number]>;

/** 그 차수(1·2·3차 조사)에 적용되는 설정. 그 차수가 없으면 undefined. */
export function phaseConfigOf(id: MemoryId, visit: Visit): MemoryPhaseConfig | undefined {
  return visitConfig(id, visit);
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
 * 라디오 1차(재난방송)를 마친 순간 도는 이미지 나열 컷씬 (v4 3-3). 컷 내용은
 * content/cutscenes.yaml에 있다.
 */
export const CUTSCENE_RADIO_BLACKOUT = "radio-blackout";
/** 문제집 뒤표지에서 이름을 찾고 내려놓은 순간의 자기소개 세 줄 (store의 closeClue). */
export const CUTSCENE_WORKBOOK_NAME = "workbook-name";
/** 캐리어 개수 추리가 맞물린 순간의 결론 한 줄 (v4.1 3장, store의 tripDoubted). */
export const CUTSCENE_TRIP_DOUBT = "trip-doubt";
/** 2페이즈 필수 조사를 다 마친 순간의 한 줄 (v4 3-4). */
export const CUTSCENE_P2_CLOSE = "p2-close";
/** 4페이즈 안방 서류를 다 본 순간의 한 줄. 끝나면 방의 액자가 금빛으로 돈다 (v4 3-6). */
export const CUTSCENE_P4_CLOSE = "p4-close";
/** 현관의 배트를 쥔 순간의 두 줄. 끝나면 스토어가 배트를 쥔 것으로 적는다 (takeBat). */
export const CUTSCENE_BAT_GRIP = "bat-grip";
/** 거실 피아노를 끝까지 친 순간의 회상 (store의 finishPuzzle). */
export const CUTSCENE_PIANO_FLASHBACK = "piano-flashback";

/**
 * 4페이즈의 마지막 칸: 방의 액자 2차. 안방 서류를 다 보면 이 칸이 열리는데, 열리는
 * 순간이 p4-close가 도는 자리다. 이름을 코드에 박는 대신 여기 한 곳에만 둔다.
 */
export const P4_FINAL_MEMORY = "frame" as MemoryId;
