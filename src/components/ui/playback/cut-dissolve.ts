/**
 * 컷 dissolve의 수치 (docs/direction/visual-experiments.md 7장 "회상 컷 간").
 *
 * 컷씬·다시보기에서 컷이 바뀔 때 그림이 opacity로 겹쳐 지나가는 대신, 노이즈 판을
 * 문턱값으로 잘라 "결을 따라" 드러난다. 여기는 브라우저 없이 도는 부분만: 컷마다 어떤
 * 결을 쓸지, 시간이 문턱값으로 어떻게 내려가는지, 노이즈 판 자체를 어떻게 굽는지.
 * 캔버스에 칠하는 쪽은 CutDissolve.tsx다.
 *
 * 노이즈는 매 컷 굽지 않고 작은 판(128×128)을 한 번 구워 늘리거나 깔아 쓴다.
 * 시드가 같으면 같은 판이 나온다: 같은 컷을 다시 봐도 같은 결로 넘어간다.
 */

/**
 * 노이즈의 결 셋. 2D 재생 화면의 "기록물의 결"(DESIGN.md > Texture)과 같은 재질이다.
 *   paper  종이 섬유: 가로로 결이 선 부드러운 얼룩
 *   film   필름 그레인: 픽셀마다 제각각인 백색 잡음
 *   water  물 얼룩: 큼직하고 느린 덩어리
 */
export type NoiseGrain = "paper" | "film" | "water";

/** 컷 번호에 결을 배정하는 순서. 세 결이 한 번씩 돌고 다시 처음으로. */
const GRAIN_CYCLE: readonly NoiseGrain[] = ["paper", "film", "water"];

/** 이 컷으로 넘어올 때 쓰는 결. 컷 번호만으로 정해지니 다시 봐도 같다. */
export function grainForCut(cutIndex: number): NoiseGrain {
  const slot = Math.abs(Math.trunc(cutIndex)) % GRAIN_CYCLE.length;
  return GRAIN_CYCLE[slot];
}

/**
 * 경과 시간을 문턱값(1 → 0)으로. 노이즈 값이 문턱값 아래인 픽셀만 아직 장막에 덮여 있다.
 * 시작에서는 전부 덮이고(1), 끝에서는 아무것도 안 남는다(0). 직선이 아니라 smoothstep:
 * 첫 조각과 마지막 조각이 천천히 떨어져야 잘라 붙인 것이 아니라 스며든 것으로 읽힌다.
 */
export function dissolveThreshold(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const eased = progress * progress * (3 - 2 * progress);
  return 1 - eased;
}

/**
 * 정수 격자점 하나의 해시 → [0, 1). 곱셈 상수는 흔한 정수 해시의 것이고 의미는 없다.
 * Math.random을 쓰지 않는 이유는 WAVE_SHAPE와 같다: 시드가 같으면 판이 같아야 한다.
 */
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 종이 결에서 가로로 평균 내는 창의 폭. 픽셀 수. 길면 섬유가 아니라 줄무늬가 된다. */
const PAPER_KERNEL = 5;
/** 물 얼룩의 격자 칸 수 (첫 옥타브). 두 번째 옥타브는 두 배로 잘다. */
const WATER_CELLS = 4;

/** [0,1) 값을 0..255 바이트로. */
function toByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}

/** 필름: 픽셀마다 독립인 잡음. 문턱값이 내려가면 판 전체에 고르게 구멍이 뚫린다. */
function bakeFilm(out: Uint8Array, width: number, height: number, seed: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      out[y * width + x] = toByte(hash(x, y, seed));
    }
  }
}

/**
 * 종이: 같은 잡음을 가로로 짧게 평균 내면 결이 x 방향으로 눕는다. 평균은 대비를 죽이므로
 * (n개 평균의 표준편차는 1/sqrt(n)) sqrt(n)배로 도로 펴서 문턱값이 0..1을 다 훑게 한다.
 * x는 판 폭으로 감아 이어 붙여도 이음새가 안 보이게.
 */
function bakePaper(out: Uint8Array, width: number, height: number, seed: number): void {
  const half = Math.floor(PAPER_KERNEL / 2);
  const stretch = Math.sqrt(PAPER_KERNEL);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -half; k <= half; k += 1) {
        sum += hash((x + k + width) % width, y, seed);
      }
      const mean = sum / PAPER_KERNEL;
      out[y * width + x] = toByte(0.5 + (mean - 0.5) * stretch);
    }
  }
}

/**
 * 격자 value noise 한 옥타브. 격자점 값은 해시, 그 사이는 겹선형 보간이다. 격자를 판
 * 크기로 감아 타일이 이어진다. cells가 클수록 잘다.
 */
function valueNoise(
  x: number,
  y: number,
  width: number,
  height: number,
  cells: number,
  seed: number,
) {
  const gx = (x / width) * cells;
  const gy = (y / height) * cells;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const x1 = (x0 + 1) % cells;
  const y1 = (y0 + 1) % cells;
  const top = hash(x0, y0, seed) * (1 - tx) + hash(x1, y0, seed) * tx;
  const bottom = hash(x0, y1, seed) * (1 - tx) + hash(x1, y1, seed) * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * 물: 낮은 주파수 두 옥타브. 보간은 값을 가운데로 모으므로 조금 펴 준다 (1.6배).
 * 큼직한 얼룩이 먼저 뚫리고 그 가장자리가 천천히 넓어지는 모양이 된다.
 */
function bakeWater(out: Uint8Array, width: number, height: number, seed: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coarse = valueNoise(x, y, width, height, WATER_CELLS, seed);
      const fine = valueNoise(x, y, width, height, WATER_CELLS * 2, seed + 1);
      const mixed = (coarse + fine * 0.5) / 1.5;
      out[y * width + x] = toByte(0.5 + (mixed - 0.5) * 1.6);
    }
  }
}

/**
 * 노이즈 판을 굽는다. 결과는 width*height 길이의 밝기(0..255) 배열, 행 우선.
 * 크기는 작게(128 안팎): 캔버스에서 늘리거나 깔아 쓰므로 그 이상은 낭비다.
 */
export function bakeNoise(
  width: number,
  height: number,
  grain: NoiseGrain,
  seed: number,
): Uint8Array {
  const out = new Uint8Array(Math.max(0, width * height));
  if (width <= 0 || height <= 0) return out;
  const safeSeed = Math.trunc(seed) | 0;
  if (grain === "film") bakeFilm(out, width, height, safeSeed);
  else if (grain === "paper") bakePaper(out, width, height, safeSeed);
  else bakeWater(out, width, height, safeSeed);
  return out;
}

/**
 * 판이 얼마나 거친지: 이웃 픽셀(오른쪽·아래)과의 밝기 차의 평균. 테스트가 "물이 필름보다
 * 부드럽다"를 확인하는 자다. 백색 잡음은 85 근처, 얼룩은 한 자리 수다.
 */
export function meanNeighborDifference(noise: Uint8Array, width: number, height: number): number {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = noise[y * width + x];
      if (x + 1 < width) {
        sum += Math.abs(here - noise[y * width + x + 1]);
        count += 1;
      }
      if (y + 1 < height) {
        sum += Math.abs(here - noise[(y + 1) * width + x]);
        count += 1;
      }
    }
  }
  return count === 0 ? 0 : sum / count;
}
