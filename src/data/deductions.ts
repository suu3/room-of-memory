import { CUTSCENE_TRIP_DOUBT, type MemoryId } from "./memory-room";

/**
 * 추리: 도해가 결론을 말하기 전에 플레이어가 수첩 기록 두 장을 직접 잇는 자리.
 *
 * 예전에는 단서를 다 보는 순간 결론 컷씬이 저절로 흘렀다. 그러면 플레이어가 하는 일은
 * 금빛 물건을 누르고 결론을 듣는 것뿐이라, 미스터리인데 탐정 역을 주인공이 가져갔다.
 * 지금은 컷씬 앞에 물음이 서고, 맞는 두 장을 이어야 그 결론이 흐른다.
 *
 * 꼴은 "모순 찾기"다: 누군가의 말 한 줄이 서고, 그 말과 어긋나는 기록 두 장을 찾는다.
 * 변종은 표에 한 줄을 더하는 것으로 는다.
 */
export const DEDUCTION_IDS = ["trip-doubt"] as const;
export type DeductionId = (typeof DEDUCTION_IDS)[number];

interface Deduction {
  /**
   * 누구의 말에서 모순을 찾는가 (characters.<id>.name). 그 말 자체는 i18n의
   * `deduction.claims.<id>`에 있다.
   */
  claimant: "dad" | "mom";
  /** 이 기억들의 2차 조사를 다 마쳐야 물음이 선다. 답이 되는 두 장은 반드시 여기 든다. */
  needs: readonly MemoryId[];
  /** 이어야 하는 두 장 (순서 없음). */
  answer: readonly [MemoryId, MemoryId];
  /** 맞게 이으면 흐르는 결론 컷씬 (cutscenes.yaml의 id). */
  cutscene: string;
}

export const DEDUCTIONS: Record<DeductionId, Deduction> = {
  /*
   * 캐리어 개수 추리 (v4.1 3장). 아빠의 말 "2박 3일, 가볍게"가 판 위에 서고, 답은 그 말과
   * 어긋나는 두 기록이다: 한 달 치 식량(냉장고)과 두고 간 등산화·캐리어 둘(신발장).
   * 냉장고도 조건에 든다: 결론의 첫 줄이 냉장고라, 열어 보기 전에 서면 본 적 없는 것을 말한다.
   */
  "trip-doubt": {
    claimant: "dad",
    needs: ["fridge", "shoes", "computer"],
    answer: ["fridge", "shoes"],
    cutscene: CUTSCENE_TRIP_DOUBT,
  },
};

/** 이 추리의 단서를 다 봤는가. */
export function deductionReady(id: DeductionId, revisited: readonly MemoryId[]): boolean {
  return DEDUCTIONS[id].needs.every((memory) => revisited.includes(memory));
}

/** 단서는 다 봤는데 아직 잇지 않은 추리. 없으면 null. */
export function pendingDeduction(
  revisited: readonly MemoryId[],
  deduced: readonly DeductionId[],
): DeductionId | null {
  return DEDUCTION_IDS.find((id) => !deduced.includes(id) && deductionReady(id, revisited)) ?? null;
}

/** 이 컷씬이 어느 추리의 결론인가. 추리에 걸리지 않은 컷씬이면 null. */
export function deductionOfCutscene(cutsceneId: string | undefined): DeductionId | null {
  return DEDUCTION_IDS.find((id) => DEDUCTIONS[id].cutscene === cutsceneId) ?? null;
}

/** 고른 두 장이 답인가. 순서는 보지 않는다. */
export function pairSolves(id: DeductionId, picked: readonly MemoryId[]): boolean {
  const { answer } = DEDUCTIONS[id];
  return picked.length === 2 && picked[0] !== picked[1] && answer.every((m) => picked.includes(m));
}
