/**
 * 창밖 그림(mg-window-view-outside.webp)에서 찾아야 하는 자리들.
 *
 * 좌표는 그림 폭·높이에 대한 %다. 그림을 바꾸면 여기도 같이 재야 한다.
 * 핏자국은 그림에서 손톱만 해서 그냥 보면 대부분 지나친다. 돋보기로 짚어야
 * 보이는 것이 이 인터랙션의 뜻이다: 창밖은 처음부터 이랬는데 안 보고 있었다.
 */
export interface WindowSpot {
  id: "smoke" | "stain" | "dark";
  /** 그림 안 위치 (%). */
  x: number;
  y: number;
}

export const WINDOW_SPOTS: readonly WindowSpot[] = [
  { id: "smoke", x: 57.5, y: 47 },
  { id: "stain", x: 58.5, y: 79 },
  { id: "dark", x: 27, y: 37 },
];

/** 돋보기 중심이 이 거리(%) 안에 들어오면 찾은 것으로 친다. 렌즈 반지름과 같은 감각. */
const SPOT_RADIUS = 8;
/** 키보드로 렌즈를 옮기는 한 걸음 (%). */
export const LENS_STEP = 4;
/** 렌즈 배율. 이보다 낮으면 핏자국이 안 보이고, 높으면 어디를 보는지 모른다. */
export const LENS_ZOOM = 2.4;

export interface LensPosition {
  x: number;
  y: number;
}

/** 렌즈가 그림 밖으로 나가지 않게. */
export function clampLens(position: LensPosition): LensPosition {
  return {
    x: Math.min(100, Math.max(0, position.x)),
    y: Math.min(100, Math.max(0, position.y)),
  };
}

/** 렌즈 중심에서 닿는 자리. 없으면 null. 가까운 것부터. */
export function spotAt(
  position: LensPosition,
  found: readonly WindowSpot["id"][],
): WindowSpot | null {
  let nearest: { spot: WindowSpot; distance: number } | null = null;
  for (const spot of WINDOW_SPOTS) {
    if (found.includes(spot.id)) continue;
    const distance = Math.hypot(spot.x - position.x, spot.y - position.y);
    if (distance <= SPOT_RADIUS && (!nearest || distance < nearest.distance)) {
      nearest = { spot, distance };
    }
  }
  return nearest?.spot ?? null;
}

/** 방향키 한 걸음. */
export function moveLens(position: LensPosition, key: string): LensPosition | null {
  switch (key) {
    case "ArrowLeft":
      return clampLens({ x: position.x - LENS_STEP, y: position.y });
    case "ArrowRight":
      return clampLens({ x: position.x + LENS_STEP, y: position.y });
    case "ArrowUp":
      return clampLens({ x: position.x, y: position.y - LENS_STEP });
    case "ArrowDown":
      return clampLens({ x: position.x, y: position.y + LENS_STEP });
    default:
      return null;
  }
}
