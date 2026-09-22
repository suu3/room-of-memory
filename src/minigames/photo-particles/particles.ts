/**
 * 액자 사진을 입자로 풀었다가 모으는 순수 계산 (docs/visual-experiments.md 4장 "가족사진 액자").
 *
 * 그리는 쪽(PhotoParticles.tsx)은 여기 함수를 부르고 Canvas 2D에 네모를 찍기만 한다.
 * 샘플링·스프링·커서 밀림은 전부 브라우저 없이 테스트한다 (9장 "바인딩은 순수 함수로").
 *
 * 좌표 단위는 **캔버스 폭**이다. x는 0~1, y는 0~높이/폭. 두 축을 같은 단위로 두어야
 * 커서 반경이 원으로 서고, 표시 크기가 바뀌어도 입자 자리가 그대로다.
 *
 * 입자마다 집(home)이 있고 스프링으로 돌아간다. 얼굴 입자만 다르다: `faceSpring`이 0이면
 * 집으로 가지 않고 집 근처를 떠돈다. 1차 사진은 얼굴이 끝까지 안 모이고(부모의 얼굴이
 * 그늘에 묻힌 사진), 2차 `photo-puzzle`을 맞추면 같은 입자가 얼굴까지 모인다. 얼굴 자리는
 * 마스크 에셋 없이 아래 정규화 사각형으로 잡는다.
 */

/** ImageData와 같은 모양. 테스트에서 합성 픽셀을 넣을 수 있게 인터페이스로 받는다 */
export interface ImageLike {
  width: number;
  height: number;
  /** RGBA, 픽셀당 4바이트 */
  data: Uint8ClampedArray;
}

/** 격자로 뽑은 픽셀들. 좌표는 원본 픽셀 단위 */
export interface PhotoSample {
  count: number;
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  /** 0~1 */
  alpha: Float32Array;
}

/** 정규화 사각형(0~1). 사진 파일이 바뀌면 여기만 고친다 */
export interface FaceRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 페이즈별 부모 얼굴 자리 (정규화). 1차 `mg-photo-wipe-phase-1.webp` 1313×1198,
 * 2차 `mg-photo-wipe-phase-2.webp` 1402×1122. 둘 다 위쪽 가운데에 두 사람이 나란히 있다.
 */
export const FACE_REGIONS: Record<1 | 2, readonly FaceRegion[]> = {
  1: [
    { x: 0.3, y: 0.18, w: 0.18, h: 0.22 },
    { x: 0.55, y: 0.16, w: 0.18, h: 0.22 },
  ],
  2: [
    { x: 0.28, y: 0.2, w: 0.17, h: 0.24 },
    { x: 0.56, y: 0.18, w: 0.17, h: 0.24 },
  ],
};

/** 정규화 좌표(u, v)가 얼굴 사각형 중 하나 안에 있는가 */
export function inFaceRegion(u: number, v: number, regions: readonly FaceRegion[]): boolean {
  for (const region of regions) {
    if (u >= region.x && u < region.x + region.w && v >= region.y && v < region.y + region.h) {
      return true;
    }
  }
  return false;
}

/** 목표 입자 수. Canvas 2D fillRect 5천 개가 폰에서도 한 프레임에 든다 */
export const PARTICLE_TARGET = 5000;

/** 표시 크기에서 입자 수가 target쯤 되는 격자 간격(px). 1 아래로는 내려가지 않는다 */
export function spacingFor(width: number, height: number, target = PARTICLE_TARGET): number {
  const area = Math.max(0, width) * Math.max(0, height);
  if (area === 0 || target <= 0) return 1;
  return Math.max(1, Math.sqrt(area / target));
}

/**
 * 이미지를 격자로 샘플링한다. 칸의 가운데 픽셀 하나를 읽고, 완전히 투명한 픽셀은 건너뛴다.
 * 좌표는 칸의 가운데(픽셀 단위)라 입자가 모였을 때 칸 크기 네모로 찍으면 사진이 빈틈없이 선다.
 */
export function samplePhoto(image: ImageLike, spacing: number): PhotoSample {
  const step = Math.max(1, spacing);
  const columns = Math.max(0, Math.floor(image.width / step));
  const rows = Math.max(0, Math.floor(image.height / step));
  const capacity = columns * rows;
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const r = new Float32Array(capacity);
  const g = new Float32Array(capacity);
  const b = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  let count = 0;

  for (let row = 0; row < rows; row += 1) {
    const centerY = (row + 0.5) * step;
    const pixelY = Math.min(image.height - 1, Math.floor(centerY));
    for (let column = 0; column < columns; column += 1) {
      const centerX = (column + 0.5) * step;
      const pixelX = Math.min(image.width - 1, Math.floor(centerX));
      const offset = (pixelY * image.width + pixelX) * 4;
      const a = image.data[offset + 3];
      if (a === 0) continue;
      x[count] = centerX;
      y[count] = centerY;
      r[count] = image.data[offset];
      g[count] = image.data[offset + 1];
      b[count] = image.data[offset + 2];
      alpha[count] = a / 255;
      count += 1;
    }
  }

  return {
    count,
    x: x.subarray(0, count),
    y: y.subarray(0, count),
    r: r.subarray(0, count),
    g: g.subarray(0, count),
    b: b.subarray(0, count),
    alpha: alpha.subarray(0, count),
  };
}

/** 정수 → 0~1 해시. 입자마다 고정된 "성격"(소용돌이 방향, 떠도는 위상)을 주는 데 쓴다 */
export function hash01(seed: number): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 입자 하나가 집에서 떠돌 수 있는 최대 거리(폭 단위). 얼굴 입자가 날아가 버리지 않게 */
export const FACE_MAX_DRIFT = 0.08;
/** 최대 거리 밖으로 밀려난 얼굴 입자를 안으로 되미는 세기. 벽이 아니라 젤리로 막는다 */
const DRIFT_FENCE_SPRING = 60;
/** 이 배율 너머는 위치를 직접 자른다. 커서가 세게 밀어도 얼굴 구름은 여기서 끝난다 */
const DRIFT_HARD_RATIO = 1.5;
/** 커서 밀림에서 반지름 방향과 접선 방향의 비율. 접선이 커야 소용돌이로 읽힌다 */
const PUSH_RADIAL = 0.55;
const PUSH_TANGENT = 0.85;

export interface ParticleState {
  count: number;
  /** 집 (폭 단위) */
  homeX: Float32Array;
  homeY: Float32Array;
  /** 지금 자리 */
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** 1이면 얼굴 입자 */
  face: Uint8Array;
  /** 누적 시간(s). 얼굴 입자의 떠도는 위상에 쓴다 */
  time: number;
}

export interface CreateParticleOptions {
  /** 샘플이 나온 이미지의 픽셀 폭. 좌표를 폭 단위로 바꾸는 기준 */
  width: number;
  height: number;
  /** 얼굴 사각형. 비우면 얼굴 입자가 없다 */
  regions: readonly FaceRegion[];
  /**
   * 처음에 집에서 흩어 놓는 거리(폭 단위). 0이면 사진 그대로 시작한다.
   * 얼굴 입자는 이보다 멀리 흩지 않는다(FACE_MAX_DRIFT 안쪽): 스프링이 없어도
   * 얼굴 구름은 처음부터 제자리 근처에 있어야 한다.
   */
  scatter: number;
}

/** 샘플을 입자 상태로 세운다. 흩어 놓는 방향·거리는 해시라 같은 입력이면 같은 그림이다 */
export function createParticleState(
  sample: PhotoSample,
  { width, height, regions, scatter }: CreateParticleOptions,
): ParticleState {
  const count = sample.count;
  const state: ParticleState = {
    count,
    homeX: new Float32Array(count),
    homeY: new Float32Array(count),
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    face: new Uint8Array(count),
    time: 0,
  };
  const unit = Math.max(1, width);
  for (let i = 0; i < count; i += 1) {
    const hx = sample.x[i] / unit;
    const hy = sample.y[i] / unit;
    const face = inFaceRegion(sample.x[i] / unit, sample.y[i] / Math.max(1, height), regions);
    state.homeX[i] = hx;
    state.homeY[i] = hy;
    state.face[i] = face ? 1 : 0;
    const angle = hash01(i * 3 + 1) * Math.PI * 2;
    const reach = face
      ? Math.min(scatter, FACE_MAX_DRIFT * (0.3 + 0.7 * hash01(i * 3 + 2)))
      : scatter * (0.4 + 0.6 * hash01(i * 3 + 2));
    state.x[i] = hx + Math.cos(angle) * reach;
    state.y[i] = hy + Math.sin(angle) * reach;
  }
  return state;
}

export interface Pointer {
  /** 폭 단위 */
  x: number;
  y: number;
  /** false면 밀지 않는다 (커서가 캔버스 밖) */
  active: boolean;
}

export interface StepOptions {
  /** 커서가 미는 반경(폭 단위) */
  radius: number;
  /** 미는 가속도(폭/s²). 반경 가운데에서 최대, 가장자리에서 0 */
  pushStrength: number;
  /** 집으로 돌아가는 스프링(1/s²) */
  springStrength: number;
  /** 얼굴 입자의 스프링. 0이면 집으로 가지 않는다 */
  faceSpring: number;
  /** 속도 감쇠(1/s) */
  damping: number;
  /**
   * 얼굴 입자가 떠도는 가속도(폭/s²). 스프링이 없는 얼굴 입자에 이게 없으면 감쇠만 받아
   * 어딘가에 멈춰 선다: 멈추면 "안 모이는" 게 아니라 "잘못 모인" 것으로 보인다.
   * 기본은 faceSpring이 0일 때만 켠다.
   */
  faceWander?: number;
}

/** 그리는 쪽이 쓰는 기본값. 스프링 40 · 감쇠 8이면 1초 안에 잦아들고 살짝 튕긴다 */
export const DEFAULT_STEP_OPTIONS: Readonly<Required<StepOptions>> = {
  radius: 0.12,
  pushStrength: 14,
  springStrength: 40,
  faceSpring: 0,
  damping: 8,
  faceWander: 0.9,
};

/** 한 프레임에 허용하는 최대 dt(s). 탭이 잠들었다 깨면 큰 dt로 스프링이 터진다 */
export const MAX_DT = 1 / 30;

/**
 * 입자를 dt만큼 전진시킨다. 상태를 제자리에서 고친다 (프레임마다 새 배열을 만들지 않는다).
 *
 * 커서 반경 안의 입자는 반지름 방향과 접선 방향을 섞은 쪽으로 밀린다. 접선의 부호는
 * 입자마다 해시로 고정이라 한 무리가 양쪽으로 갈라져 소용돌이처럼 보인다. 값싼 curl.
 */
export function stepParticles(
  state: ParticleState,
  dt: number,
  pointer: Pointer,
  options: StepOptions,
): void {
  const step = Math.min(MAX_DT, Math.max(0, dt));
  if (step === 0) return;
  state.time += step;
  const { radius, pushStrength, springStrength, faceSpring, damping } = options;
  const wander = options.faceWander ?? (faceSpring === 0 ? DEFAULT_STEP_OPTIONS.faceWander : 0);
  const radius2 = radius * radius;
  const decay = Math.max(0, 1 - damping * step);
  const hardLimit = FACE_MAX_DRIFT * DRIFT_HARD_RATIO;
  const time = state.time;

  for (let i = 0; i < state.count; i += 1) {
    let x = state.x[i];
    let y = state.y[i];
    let vx = state.vx[i];
    let vy = state.vy[i];
    const face = state.face[i] === 1;

    if (pointer.active) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius2) {
        const d = Math.sqrt(d2);
        // 정확히 커서 위면 방향이 없다. 해시로 하나 정한다
        const angle = hash01(i * 5 + 3) * Math.PI * 2;
        const rx = d > 1e-6 ? dx / d : Math.cos(angle);
        const ry = d > 1e-6 ? dy / d : Math.sin(angle);
        const swirl = hash01(i * 5 + 4) < 0.5 ? -1 : 1;
        const falloff = 1 - d / radius;
        const force = pushStrength * falloff * falloff * step;
        vx += (rx * PUSH_RADIAL - ry * PUSH_TANGENT * swirl) * force;
        vy += (ry * PUSH_RADIAL + rx * PUSH_TANGENT * swirl) * force;
      }
    }

    const toHomeX = state.homeX[i] - x;
    const toHomeY = state.homeY[i] - y;
    const spring = face ? faceSpring : springStrength;
    vx += toHomeX * spring * step;
    vy += toHomeY * spring * step;

    if (face && wander > 0) {
      // 입자마다 위상과 속도가 다른 원운동 가속도. 소음이 아니라 천천히 감도는 느낌
      const phase = hash01(i * 5 + 5) * Math.PI * 2;
      const rate = 0.5 + hash01(i * 5 + 6) * 0.9;
      const a = phase + time * rate;
      vx += Math.cos(a) * wander * step;
      vy += Math.sin(a) * wander * step;
    }

    vx *= decay;
    vy *= decay;
    x += vx * step;
    y += vy * step;

    if (face) {
      // 얼굴 구름은 집 근처를 벗어나지 않는다. 울타리 밖에서는 안쪽으로 되밀고,
      // 그래도 멀면 자른다
      const ox = x - state.homeX[i];
      const oy = y - state.homeY[i];
      const dist = Math.sqrt(ox * ox + oy * oy);
      if (dist > FACE_MAX_DRIFT) {
        const nx = ox / dist;
        const ny = oy / dist;
        const excess = dist - FACE_MAX_DRIFT;
        vx -= nx * excess * DRIFT_FENCE_SPRING * step;
        vy -= ny * excess * DRIFT_FENCE_SPRING * step;
        if (dist > hardLimit) {
          x = state.homeX[i] + nx * hardLimit;
          y = state.homeY[i] + ny * hardLimit;
          // 바깥으로 향하는 속도만 지운다. 접선 성분은 남겨 구름이 미끄러진다
          const outward = vx * nx + vy * ny;
          if (outward > 0) {
            vx -= nx * outward;
            vy -= ny * outward;
          }
        }
      }
    }

    state.x[i] = x;
    state.y[i] = y;
    state.vx[i] = vx;
    state.vy[i] = vy;
  }
}

/** 집에서 가장 멀리 있는 입자의 거리(폭 단위). 테스트와 "다 모였나" 판정용 */
export function maxDistanceFromHome(state: ParticleState, onlyFace?: boolean): number {
  let max = 0;
  for (let i = 0; i < state.count; i += 1) {
    if (onlyFace !== undefined && (state.face[i] === 1) !== onlyFace) continue;
    const dx = state.x[i] - state.homeX[i];
    const dy = state.y[i] - state.homeY[i];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > max) max = d;
  }
  return max;
}
