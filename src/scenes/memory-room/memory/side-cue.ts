"use client";

import { onboardingStep, storyPhase, useMemoryRoomStore } from "@/store/memory-room";

/**
 * 곁가지(단서·눌러 볼 물건·서랍)가 다가가지 않아도 옅은 윤곽선으로 먼저 보이는가.
 *
 * 1페이즈에만 켠다. 라디오가 좀비를 말하기 전까지는 평범한 수험생의 방을 충분히
 * 만져 봐야 그 한마디가 방을 뒤집는다. 기억만 빛나면 기억에서 기억으로 곧장 건너뛰어
 * 방이 쌓일 틈이 없다. 등급은 그대로 `prop`(윤곽선 한 줄)이라 기억의 금빛과 섞이지 않는다.
 *
 * 문제집 차례(onboardingStep의 "workbook")에는 끈다. 첫 신호가 여럿이면 문제집이
 * 먼저라는 말이 흐려진다. 이름을 알고 나면 방이 한꺼번에 열린다.
 *
 * 다가가야만 쓸 수 있는 가구(의자·스탠드·커튼)는 여기 끼지 않는다. 멀리서 빛나는데
 * 누르면 거절하면 거짓말이 된다.
 */
export function useSideCue(): boolean {
  return useMemoryRoomStore(
    (state) => storyPhase(state) === "p1" && onboardingStep(state) !== "workbook",
  );
}
