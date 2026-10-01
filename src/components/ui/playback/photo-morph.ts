/**
 * 사진 한 장이 다른 한 장으로 밀려 넘어가는 계산 (액자 다시보기).
 *
 * 액자는 **같은 장면을 두 장 가진 유일한 기억**이다. 1막의 사진은 부모의 얼굴이 틀
 * 밖으로 잘려 있고, 2막의 사진은 셋이 다 들어온다. 2막에 이 기억을 되짚으면 먼저
 * 1막의 사진이 서 있다가 2막의 사진으로 넘어간다: 외면에서 직면으로 가는 이 게임의
 * 문장을 그림 한 동작으로 말하는 자리다.
 *
 * 넘어가는 방식은 겹쳐 지워지는 것(opacity)이 아니라 **밀림**이다. 낮은 주파수 얼룩을
 * 변위장으로 써서 앞 그림을 밀어내고 뒤 그림을 끌어온다. 얼룩의 결은 컷 dissolve의
 * "물 얼룩"과 같은 것을 쓴다 (cut-dissolve의 bakeNoise): 같은 재생 화면 안에서 전환이
 * 둘 다 기록물의 결이어야지, 한쪽만 다른 재질이면 효과가 장식으로 읽힌다.
 *
 * 여기는 브라우저 없이 도는 부분만이다. 캔버스에 칠하는 쪽은 PhotoMorph.tsx다.
 */

import { bakeNoise } from "./cut-dissolve";

/** 1막 사진을 먼저 알아볼 시간. 곧장 넘어가면 "뭐가 바뀌었지"가 남지 않는다. */
export const MORPH_DELAY_MS = 700;
/** 넘어가는 데 걸리는 시간. 컷 dissolve(600ms)보다 길다: 이건 전환이 아니라 사건이다. */
export const MORPH_DURATION_MS = 1300;
/** 미는 거리. 버퍼의 짧은 변에 대한 비율. */
export const MORPH_AMPLITUDE = 0.08;
/** 변위를 계산하는 버퍼의 긴 변(px). 넘어가는 동안만 서는 그림이라 이 이상이 필요 없다. */
export const MORPH_BUFFER_SIDE = 320;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * 흐른 시간 → 넘어간 정도(0~1). 지연 동안은 0이고, 그 뒤 smoothstep으로 1까지 간다.
 * 양끝이 느려야 사진이 갈아끼워진 것이 아니라 밀려 넘어간 것으로 읽힌다.
 */
export function morphProgress(
  elapsedMs: number,
  delayMs = MORPH_DELAY_MS,
  durationMs = MORPH_DURATION_MS,
): number {
  if (durationMs <= 0) return elapsedMs >= delayMs ? 1 : 0;
  const t = clamp01((elapsedMs - delayMs) / durationMs);
  return t * t * (3 - 2 * t);
}

/** 넘어감이 끝났는가. 끝나면 캔버스를 걷고 원본 그림에 자리를 넘긴다. */
export function morphDone(
  elapsedMs: number,
  delayMs = MORPH_DELAY_MS,
  durationMs = MORPH_DURATION_MS,
): boolean {
  return elapsedMs >= delayMs + durationMs;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 그림을 상자 안에 통째로(잘리지 않게) 앉히는 자리. CSS `object-contain`과 같은 계산이다.
 *
 * 두 사진은 비율이 다르다(1막 560×511, 2막 620×496). 각자 제 비율로 앉아야 넘어감이
 * 끝난 자리가 원본 `<img>`가 서는 자리와 딱 맞는다. 안 맞으면 마지막 프레임에서
 * 그림이 한 번 튄다.
 */
export function containRect(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): Rect {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

/**
 * 화면 크기 → 변위를 계산할 버퍼 크기. 긴 변을 maxSide로 줄이되 비율은 지킨다.
 *
 * 픽셀마다 두 번 표본을 뜨는 계산이라 화면 해상도로 돌릴 이유가 없다. 넘어가는
 * 1.3초 동안만 서는 그림이고, 끝나면 원본 `<img>`가 또렷하게 그 자리를 받는다.
 */
export function bufferSize(
  width: number,
  height: number,
  maxSide = MORPH_BUFFER_SIDE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 두 그림을 나란히 세우는 자리 전체를 차지하는 사각형. 정규화 좌표(0~1)다. */
export const WHOLE_FRAME: Rect = { x: 0, y: 0, width: 1, height: 1 };

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** 사각형 둘 사이를 t(0~1)로 오간다. */
export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  };
}

/**
 * 지금 보고 있는 범위. 뒤 그림의 정규화 좌표계에서 잰다.
 *
 * 0에서는 `within`, 곧 **앞 그림이 담고 있는 만큼**만 본다. 1에서는 뒤 그림 전체를
 * 본다. 그 사이를 오가는 동안 틀이 뒤로 물러나며 앞 그림에 없던 바깥이 들어온다:
 * 액자에서는 그 바깥이 부모의 얼굴이다.
 */
export function cameraRect(within: Rect, progress: number): Rect {
  return lerpRect(within, WHOLE_FRAME, clamp01(progress));
}

/**
 * 뒤 그림의 정규화 사각형 하나가, 지금 범위(`camera`)로 볼 때 `box` 안의 어디에 앉는가.
 *
 * 앞 그림을 뒤 그림과 **겹쳐 세우는** 계산이다. 두 그림이 늘 같은 자리에 있어야
 * 넘어가는 동안 물체가 둘로 보이지 않는다.
 */
export function framedRect(box: Rect, camera: Rect, target: Rect): Rect {
  if (camera.width <= 0 || camera.height <= 0) return { ...box };
  return {
    x: box.x + ((target.x - camera.x) / camera.width) * box.width,
    y: box.y + ((target.y - camera.y) / camera.height) * box.height,
    width: (target.width / camera.width) * box.width,
    height: (target.height / camera.height) * box.height,
  };
}

/**
 * 지금 범위가 화면에서 차지하는 자리.
 *
 * 자리를 두 그림의 자리 사이에서 보간하면 안 된다. 그러면 자리의 가로세로가 범위가
 * 뜻하는 가로세로와 어긋나서 두 그림이 **서로 다르게 늘어나고**, 겹쳐 세운 것이
 * 중간에 풀려 물체가 둘로 보인다. 범위가 잘라낸 만큼을 그대로 재서 앉히면 둘 다
 * 늘어나지 않고 늘 겹쳐 있다.
 */
export function visibleBox(
  camera: Rect,
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): Rect {
  return containRect(camera.width * imageWidth, camera.height * imageHeight, boxWidth, boxHeight);
}

/**
 * 사각형 안쪽이면 1, 가장자리로 갈수록 0으로 빠지는 값. 밖이면 0.
 *
 * 두 군데에 쓴다. 앞 그림은 넘어가는 동안 제 틀이 작아지므로 그 테두리가 그대로
 * 남으면 사각형 자국이 보인다. 변위도 그림의 가장자리에서 그대로 밀면 종이 끝이
 * 찢어진 것처럼 들쭉날쭉해진다. 둘 다 가장자리에서 힘을 빼면 사라진다.
 */
export function edgeFalloff(x: number, y: number, rect: Rect, feather: number): number {
  if (feather <= 0) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
      ? 1
      : 0;
  }
  const inset = Math.min(x - rect.x, rect.x + rect.width - x, y - rect.y, rect.y + rect.height - y);
  return clamp01(inset / feather);
}

/** 픽셀마다의 밀 방향. 각 성분은 -1~1이고, 실제 거리는 진폭이 곱한다. */
export interface Displacement {
  x: Float32Array;
  y: Float32Array;
}

/**
 * 변위장을 굽는다. 물 얼룩 두 장(가로 밀기 · 세로 밀기)을 -1~1로 옮겨 놓은 것이다.
 * 시드가 같으면 같은 장이 나온다: 같은 기억을 다시 되짚어도 같은 모양으로 넘어간다.
 */
export function bakeDisplacement(width: number, height: number, seed: number): Displacement {
  const count = Math.max(0, width * height);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  if (count === 0) return { x, y };
  const plateX = bakeNoise(width, height, "water", seed);
  const plateY = bakeNoise(width, height, "water", seed + 977);
  for (let i = 0; i < count; i += 1) {
    x[i] = (plateX[i] / 255) * 2 - 1;
    y[i] = (plateY[i] / 255) * 2 - 1;
  }
  return { x, y };
}

/**
 * 컷 열쇠 → 변위장 시드. 같은 기억을 몇 번을 되짚어도 같은 모양으로 넘어간다.
 * 곱셈 상수는 흔한 문자열 해시의 것이고 의미는 없다.
 */
export function morphSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h;
}
