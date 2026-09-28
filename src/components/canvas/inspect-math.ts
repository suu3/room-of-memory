/**
 * 3D 인스펙트의 손과 각도 계산 (InspectTurntable · InspectView가 나눠 쓴다).
 *
 * 화면에서 끈 픽셀을 물건의 상태로 바꾸는 규칙과, 그 상태에서 "봤다"고 칠 수 있는지의
 * 판정을 모아 둔다. 렌더러(three)와 DOM 어느 쪽에도 기대지 않아 그대로 테스트된다.
 */

const CAMERA_Z = 2.3;
const CAMERA_FOV = 30;
/** 카메라 자리와 화각. InspectTurntable의 Canvas가 그대로 쓴다. */
export const INSPECT_CAMERA = { z: CAMERA_Z, fov: CAMERA_FOV } as const;
/** 카메라가 한 화면에 담는 세로 길이 (월드). 확대했을 때 어디까지 옮길 수 있는지의 기준. */
export const VIEW_HEIGHT = 2 * CAMERA_Z * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
/** 발밑 그림자를 물건 아래 끝에서 이만큼 띄운다 (월드). 붙이면 바닥에 박힌 것처럼 보인다. */
export const SHADOW_GAP = 0.03;
/** 확대 배율이 목표를 따라가는 빠르기. */
export const ZOOM_DAMP = 14;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.4;

/** 세로로 끈 픽셀 → 기울기(rad). 75px쯤 끌면 0.45rad(26°). */
const PITCH_PX_TO_RAD = 0.006;
/** 기울기의 한계. 이보다 눕히면 판이 선으로 보인다. */
const PITCH_MAX = 0.75;

/** 위로 끌어 펼치는 데 드는 픽셀. 이만큼 끌면 다 펼쳐진다. */
export const UNFOLD_PX = 160;

/** 이만큼 가로로 끌어야 한 장이 넘어간다. 손가락이 흔들린 것과 넘긴 것을 가른다. */
export const PAGE_SWIPE_PX = 40;

/** 세로 드래그(px, 아래가 양수)를 기울기로. 위로 끌면 윗변이 뒤로 눕는다(음수). */
export function pitchFromDrag(dragY: number): number {
  return Math.max(-PITCH_MAX, Math.min(PITCH_MAX, dragY * PITCH_PX_TO_RAD));
}

/** 세로 드래그(px)를 펼침 정도(0 접힘 ~ 1 펼침)로. 위로 끌어야 펼쳐진다. */
export function unfoldFromDrag(dragY: number): number {
  return Math.max(0, Math.min(1, -dragY / UNFOLD_PX));
}

/** 홀로그램이 빛을 받는 각도. 이 근처에서만 로고가 떠오른다. */
export interface HologramSpot {
  pitch: number;
  yaw: number;
}

/**
 * 각도 차가 이만큼(rad) 벌어지면 밝기가 e^-½로 떨어진다. yaw는 pitch보다 너그럽다.
 *
 * 처음엔 0.13·0.32였는데, 손가락으로는 기울기 ±7°(세로 20px 남짓)와 회전을 동시에 맞춰야
 * 해서 한참 돌리다 포기하고 나가는 일이 생겼다 (2026-09-28). 정면(처음 쥔 자세)에서는
 * 여전히 로고가 안 보이게(< 0.05) 두고, 그 사이만 넓혔다.
 */
const SPOT_SIGMA_PITCH = 0.18;
const SPOT_SIGMA_YAW = 0.45;

/** 홀로그램 로고가 이만큼 떠올라야 읽은 것으로 친다. */
export const HOLOGRAM_READ = 0.5;

/** 두 각의 차이를 -π~π로 접는다. */
function angleGap(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * 지금 각도에서 홀로그램 로고가 얼마나 보이는가 (0~1). 빛을 받는 한 점을 중심으로 한
 * 종 모양이라, 그 각도를 지나칠 때 로고가 잠깐 떠올랐다 사라진다. 뒷면(yaw π)은 0이다.
 */
export function hologramVisibility(pitch: number, yaw: number, spot: HologramSpot): number {
  const dp = (pitch - spot.pitch) / SPOT_SIGMA_PITCH;
  const dy = angleGap(yaw, spot.yaw) / SPOT_SIGMA_YAW;
  return Math.exp(-0.5 * (dp * dp + dy * dy));
}

/** 가로로 끈 거리(px)로 장을 몇 장 넘길지. 왼쪽으로 끌면 다음 장(+1). */
export function swipeStep(dx: number): -1 | 0 | 1 {
  if (dx <= -PAGE_SWIPE_PX) return 1;
  if (dx >= PAGE_SWIPE_PX) return -1;
  return 0;
}

/** 찾을 쪽이 오른쪽(짝수)이면 그 장 수만큼, 왼쪽(홀수)이면 한 장 더 넘겼을 때 보인다. */
export function pageShowing(target: number): number {
  return Math.ceil(target / 2);
}

/** 넘긴 장 수는 0(첫 장)에서 장 수(마지막 장 뒤)까지. */
export function clampPage(page: number, sheets: number): number {
  return Math.max(0, Math.min(sheets, page));
}

/** 기울기로 쓴 세로 드래그를 한계 안으로 되돌린다. 넘게 끈 만큼 되돌아올 때 헛도는 구간을 없앤다. */
export function clampPitchDrag(dragY: number): number {
  const limit = PITCH_MAX / PITCH_PX_TO_RAD;
  return Math.max(-limit, Math.min(limit, dragY));
}

/** 펼침으로 쓴 세로 드래그를 0(접힘)~-UNFOLD_PX(펼침) 안으로 되돌린다. */
export function clampUnfoldDrag(dragY: number): number {
  return Math.max(-UNFOLD_PX, Math.min(0, dragY));
}

/** 이만큼(초) 찾을 것을 마주 보고 있어야 읽은 것으로 친다. 휙 지나간 건 못 본 것이다. */
export const READ_SECONDS = 0.35;

/**
 * "봤다"의 시계. 조건이 이어지는 동안 시간을 쌓고, READ_SECONDS를 채우는 순간 한 번만
 * true를 돌려준다. 그 뒤로는 늘 false다 (발견은 한 번이다).
 */
export class ReadTimer {
  private held = 0;
  private done = false;

  tick(condition: boolean, delta: number): boolean {
    if (this.done) return false;
    if (!condition) {
      this.held = 0;
      return false;
    }
    this.held += delta;
    if (this.held < READ_SECONDS) return false;
    this.done = true;
    return true;
  }
}
