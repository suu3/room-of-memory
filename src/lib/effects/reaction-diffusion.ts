/**
 * Gray-Scott 반응확산을 CPU에서 한 번 굽는다 (docs/visual-experiments.md 11장 "화장실 타일").
 *
 * 매 프레임 돌리는 시뮬레이션이 아니다. 화장실은 2막에 처음 열리는 공간이고 30일 동안
 * 아무도 쓰지 않았으니 무늬는 이미 다 자란 상태로 서 있으면 된다. 첫 마운트에 N스텝을
 * 돌리고 결과를 텍스처 한 장으로 남긴다. 96×96에 300스텝이면 수 ms다.
 *
 * 값은 순수 함수라 브라우저 없이 검증한다. 씨앗은 해시로 뽑아 새로고침마다 같은 무늬다.
 */

export interface GrayScottOptions {
  width: number;
  height: number;
  steps: number;
  seed: number;
  /** 공급률·소멸률. 0.055/0.062는 산호 모양의 얼룩, 0.035/0.065는 점무늬 쪽이다. */
  feed?: number;
  kill?: number;
  /** 확산 계수 (A, B). */
  diffuseA?: number;
  diffuseB?: number;
}

/** 물때 무늬로 잡은 기본값. 줄눈 따라 번지는 얼룩에 가깝다. */
const STAIN_PRESET = { feed: 0.055, kill: 0.062, diffuseA: 1, diffuseB: 0.5 } as const;

function hash01(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * B 농도(0~1)의 격자를 돌려준다. 값이 클수록 무늬가 진하다.
 *
 * 씨앗은 몇 군데 점이다. 격자 전체에 잡음을 뿌리면 균일한 반점이 되고, 점 몇 개에서
 * 자라게 하면 가장자리에서 번져 들어온 얼룩으로 읽힌다.
 */
export function bakeGrayScott({
  width,
  height,
  steps,
  seed,
  feed = STAIN_PRESET.feed,
  kill = STAIN_PRESET.kill,
  diffuseA = STAIN_PRESET.diffuseA,
  diffuseB = STAIN_PRESET.diffuseB,
}: GrayScottOptions): Float32Array {
  const size = width * height;
  let a = new Float32Array(size).fill(1);
  let b = new Float32Array(size);
  let nextA = new Float32Array(size);
  let nextB = new Float32Array(size);

  // 씨앗: 격자 크기의 1/12쯤 되는 씨앗 몇 개를 가장자리 쪽에 심는다
  const seeds = 5;
  const radius = Math.max(2, Math.floor(Math.min(width, height) / 12));
  for (let index = 0; index < seeds; index += 1) {
    const cx = Math.floor(hash01(index, 1, seed) * width);
    const cy = Math.floor(hash01(index, 2, seed) * height);
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (x * x + y * y > radius * radius) continue;
        const px = (cx + x + width) % width;
        const py = (cy + y + height) % height;
        b[py * width + px] = 1;
      }
    }
  }

  const dt = 1;
  for (let step = 0; step < steps; step += 1) {
    for (let y = 0; y < height; y += 1) {
      const up = ((y - 1 + height) % height) * width;
      const down = ((y + 1) % height) * width;
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        const left = (x - 1 + width) % width;
        const right = (x + 1) % width;
        const i = row + x;
        // 9점 라플라시안 (가운데 -1, 상하좌우 0.2, 대각 0.05)
        const lapA =
          -a[i] +
          0.2 * (a[row + left] + a[row + right] + a[up + x] + a[down + x]) +
          0.05 * (a[up + left] + a[up + right] + a[down + left] + a[down + right]);
        const lapB =
          -b[i] +
          0.2 * (b[row + left] + b[row + right] + b[up + x] + b[down + x]) +
          0.05 * (b[up + left] + b[up + right] + b[down + left] + b[down + right]);
        const reaction = a[i] * b[i] * b[i];
        nextA[i] = Math.min(
          1,
          Math.max(0, a[i] + (diffuseA * lapA - reaction + feed * (1 - a[i])) * dt),
        );
        nextB[i] = Math.min(
          1,
          Math.max(0, b[i] + (diffuseB * lapB + reaction - (kill + feed) * b[i]) * dt),
        );
      }
    }
    [a, nextA] = [nextA, a];
    [b, nextB] = [nextB, b];
  }
  return b;
}

/**
 * 농도 격자 → 곱셈 블렌딩용 회색 픽셀(RGBA). 무늬가 진할수록 어둡다. `depth`는 가장 진한
 * 자리에서 얼마나 어두워지는가(0~1). 물때는 낮은 대비다: 공포가 아니라 쓸쓸함이어야 한다.
 */
export function stainPixels(field: Float32Array, depth: number): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(new ArrayBuffer(field.length * 4));
  const clampedDepth = Math.min(1, Math.max(0, depth));
  for (let index = 0; index < field.length; index += 1) {
    const dark = Math.min(1, Math.max(0, field[index])) * clampedDepth;
    const value = Math.round(255 * (1 - dark));
    pixels[index * 4] = value;
    pixels[index * 4 + 1] = value;
    pixels[index * 4 + 2] = value;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}
