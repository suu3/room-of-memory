/**
 * 3D 인스펙트 판을 한 장의 정지 그림으로 찍는다.
 *
 * 판의 Canvas는 투명(alpha)이고 어두운 무대는 DOM(.inspect-stage)이 깐다. 캔버스만 찍으면
 * 물건이 허공에 뜬 투명 그림이 되어, 대사 뒤·수첩 카드·다시보기처럼 바탕이 다른 자리마다
 * 다르게 보인다. 그래서 무대의 두 겹 그라디언트(globals.css의 .inspect-stage)를 먼저 그리고
 * 그 위에 물건을 얹어 불투명한 한 장으로 굳힌다. 불투명이라 JPEG로 충분히 작다.
 *
 * 저장소(localStorage)에 쌓이므로 폭을 묶는다. 판의 최대 폭(34rem)을 2배 화소로 찍은
 * 값이라, 대사 뒤에 판 크기 그대로 설 때는 원본과 같고 다시보기에서 키워도 덜 뭉개진다.
 */
const STILL_MAX_WIDTH = 1088;
const STILL_QUALITY = 0.82;

/** globals.css의 토큰을 읽는다. 없으면(테스트 환경) 같은 값의 대체색. */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** 타원 방사 그라디언트: 캔버스의 원형 그라디언트를 세로로 늘려 CSS의 `W% H% at X% Y%`를 흉내낸다. */
function fillEllipse(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: { rx: number; ry: number; cx: number; cy: number },
  stops: [number, string][],
  alpha = 1,
) {
  const rx = shape.rx * width;
  const ry = shape.ry * height;
  context.save();
  context.globalAlpha = alpha;
  context.translate(shape.cx * width, shape.cy * height);
  context.scale(1, ry / rx);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  // 늘린 좌표계에서 화면 전체를 덮는 사각형
  const cover = Math.max(width, height) * 4;
  context.fillRect(-cover, -cover, cover * 2, cover * 2);
  context.restore();
}

/**
 * 방금 그린 WebGL 캔버스를 무대 바탕과 합쳐 JPEG data URL로. 실패하면 null.
 *
 * 부르는 쪽은 같은 태스크 안에서 `gl.render`를 먼저 불러야 한다. preserveDrawingBuffer
 * 없이도 그린 직후에는 버퍼가 살아 있다.
 */
export function composeStill(source: HTMLCanvasElement): string | null {
  if (source.width === 0 || source.height === 0) return null;
  const scale = Math.min(1, STILL_MAX_WIDTH / source.width);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // .inspect-stage의 아래 겹: 120% 100% at 50% 38%, storm → deep(58%) → night
  context.fillStyle = token("--color-night", "#0b1320");
  context.fillRect(0, 0, width, height);
  fillEllipse(context, width, height, { rx: 1.2, ry: 1, cx: 0.5, cy: 0.38 }, [
    [0, token("--color-scene-storm", "#2a3d48")],
    [0.58, token("--color-scene-deep", "#0f181e")],
    [1, token("--color-night", "#0b1320")],
  ]);
  // 위 겹: 46% 52% at 50% 40%, 기억 빛 16% → 투명(72%)
  const memory = token("--color-memory", "#d5ae78");
  fillEllipse(
    context,
    width,
    height,
    { rx: 0.46, ry: 0.52, cx: 0.5, cy: 0.4 },
    [
      [0, memory],
      [0.72, `${memory}00`],
    ],
    0.16,
  );

  try {
    context.drawImage(source, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", STILL_QUALITY);
  } catch {
    return null;
  }
}
