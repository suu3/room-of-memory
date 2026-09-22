/**
 * 격투 게임 화면의 픽셀 블록 크기 (docs/visual-experiments.md 4장 "게임기").
 *
 * 1막이 진행될수록 게임기 화면의 도트가 굵어진다. 방이 어두워지는 것과 같은 축인데
 * 축 자체는 다르다: 방은 밝기를 잃고, 게임기는 해상도를 잃는다. 물건마다 재질이
 * 다르다는 규칙(3장)이 여기서는 "화면이 뭉개진다"로 나온다.
 *
 * 값은 판이 열릴 때 한 번 정해 고정한다. 한 판 안에서 블록이 바뀌면 그 순간 화면이
 * 튀어 보이고, 이 게임은 실루엣을 프레임 단위로 읽는 게임이라 그게 곧 방해다.
 */

/** 가장 굵어졌을 때의 블록 한 변(CSS px). 4를 넘기면 112px 폭의 캐릭터에서 팔이 안 읽힌다. */
export const MAX_PIXEL_BLOCK = 4;

/**
 * 모은 기억 수에서 블록 크기를 정한다. 항상 1 이상 MAX_PIXEL_BLOCK 이하의 정수.
 *
 * 분모가 `memoryTotal - 1`인 이유: 마지막 기억은 라디오이고, 라디오를 맞추면 1막이
 * 끝나 게임기는 다시 열리지 않는다. 그러니 "라디오 직전"이 이 화면이 가장 굵어질 수
 * 있는 마지막 자리다. 게임기는 대개 가장 먼저 조사하는 물건이라 0에서 1(변화 없음)이
 * 정확히 나와야 한다: 처음 본 화면이 이미 뭉개져 있으면 나중에 굵어지는 게 읽히지 않는다.
 *
 *   memoryTotal 7 기준: 0→1 · 1→2 · 2→2 · 3→3 · 4→3 · 5→4 · 6→4
 */
export function pixelBlock(collectedCount: number, memoryTotal: number): number {
  const span = memoryTotal - 1;
  if (!Number.isFinite(collectedCount) || !Number.isFinite(span) || span <= 0) return 1;
  const progress = Math.min(1, Math.max(0, collectedCount / span));
  return Math.round(1 + (MAX_PIXEL_BLOCK - 1) * progress);
}

/**
 * 블록 하나가 화면 한 픽셀이 되도록 무대를 그릴 때의 축소 배율. 블록 1이면 1(그대로).
 * 무대를 이 배율로 그린 뒤 `block`배로 키우면 한 변 `block`px의 블록이 된다.
 */
export function stageScale(block: number): number {
  return block >= 1 ? 1 / block : 1;
}
