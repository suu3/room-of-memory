/**
 * 냉장고 아래칸의 치수 (1배 로컬). 그리는 쪽(FridgeDrawer)과 여는 쪽(ampoule-pickup의
 * motion)이 같은 값을 봐야 서랍이 열린 자리에 앰플이 놓인다.
 */

/** 서랍 앞면 크기. 냉장실 문 테두리(y 0.72~1.42) 아래 칸이다. */
export const DRAWER_FRONT = { width: 0.86, height: 0.38 } as const;

/** 서랍이 밀려 나오는 거리. 냉장고 깊이(0.68)의 절반쯤: 안이 보이되 몸통에서 안 빠진다. */
export const DRAWER_TRAVEL = 0.34;
