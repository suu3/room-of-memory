"use client";

import { useEffect, useRef, useState } from "react";
import {
  bakeDisplacement,
  bufferSize,
  cameraRect,
  edgeFalloff,
  framedRect,
  MORPH_AMPLITUDE,
  morphDone,
  morphProgress,
  type Rect,
  visibleBox,
  WHOLE_FRAME,
} from "./photo-morph";

/** 그리는 간격의 하한. 컷 dissolve와 같은 30fps: 밀림은 결이지 움직임이 아니다. */
const MIN_FRAME_MS = 30;
/** 가장자리에서 힘이 빠지는 폭. 자리의 짧은 변에 대한 비율. */
const FEATHER = 0.07;

export interface PhotoMorphProps {
  /** 먼저 서 있는 그림 (1막 사진). */
  from: string;
  /** 밀려 들어오는 그림 (2막 사진). 넘어감이 끝나면 원본 `<img>`가 이 자리를 받는다. */
  to: string;
  /**
   * `from`이 `to`의 어느 부분을 담고 있는가 (정규화 0~1). 두 그림을 겹쳐 세우는 값이다.
   * 없으면 전체로 보고 그냥 겹쳐 지나간다.
   */
  within?: Rect;
  /** 같은 기억은 같은 모양으로 넘어간다. */
  seed: number;
  /** 미는 거리 (버퍼 짧은 변에 대한 비율). 실험실에서 눈으로 잡는 값이라 열어 둔다. */
  amplitude?: number;
  /** 넘어감이 끝났을 때. 호출부가 원본 그림을 켠다. */
  onDone?: () => void;
}

/** 이미지 한 장을 읽는다. 못 읽으면 null: 그때는 넘어감 없이 곧장 끝낸다. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
    if (image.complete && image.naturalWidth > 0) resolve(image);
  });
}

/** 그림 한 장을 프레임마다 다시 앉힐 수 있는 판. 캔버스와 픽셀 배열을 한 번만 만든다. */
interface Layer {
  context: CanvasRenderingContext2D;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

function makeLayer(width: number, height: number): Layer | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  return { context, pixels: new Uint8ClampedArray(width * height * 4), width, height };
}

/**
 * 판에 그림을 앉히고 **알파를 곱한** 픽셀로 읽어 온다.
 *
 * 곱해 두는 이유는 두 그림이 차지하는 자리가 서로 다르기 때문이다. 남는 자리는
 * 투명한데 투명한 픽셀의 색은 0이라 그대로 섞으면 경계가 검게 탄다. 곱해 놓고
 * 섞은 뒤 마지막에 도로 나누면 그 테두리가 제 색으로 옅어진다.
 *
 * `feather`가 있으면 앉은 자리의 테두리에서 알파를 뺀다. 앞 그림은 넘어가는 동안
 * 제 틀이 작아지므로, 빼지 않으면 그 사각형이 자국으로 남는다.
 */
function paintLayer(
  layer: Layer,
  image: HTMLImageElement,
  dest: Rect,
  source: Rect | null,
  feather: number,
): void {
  const { context, width, height } = layer;
  context.clearRect(0, 0, width, height);
  if (source) {
    context.drawImage(
      image,
      source.x * image.naturalWidth,
      source.y * image.naturalHeight,
      source.width * image.naturalWidth,
      source.height * image.naturalHeight,
      dest.x,
      dest.y,
      dest.width,
      dest.height,
    );
  } else {
    context.drawImage(image, dest.x, dest.y, dest.width, dest.height);
  }
  const data = context.getImageData(0, 0, width, height).data;
  const out = layer.pixels;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const fade = feather > 0 ? edgeFalloff(x + 0.5, y + 0.5, dest, feather) : 1;
      const alpha = data[i + 3] * fade;
      out[i] = (data[i] * alpha) / 255;
      out[i + 1] = (data[i + 1] * alpha) / 255;
      out[i + 2] = (data[i + 2] * alpha) / 255;
      out[i + 3] = alpha;
    }
  }
}

/**
 * 사진이 사진으로 밀려 넘어가는 층 (액자 다시보기).
 *
 * 1막의 사진(부모 얼굴이 틀 밖으로 잘린 것)으로 열렸다가 2막의 사진(셋이 다 들어온
 * 것)으로 넘어간다. 겹쳐 지우는 것이 아니라 두 가지가 같이 일어난다.
 *
 * 하나는 **틀이 물러나는 것**이다. 두 사진은 같은 장면의 다른 크롭이라, 1막이 담은
 * 만큼에서 시작해 2막 전체까지 범위를 넓힌다 (cameraRect). 두 그림을 늘 겹쳐 세우니
 * 소년은 제자리에 있고, 넓어진 바깥으로 부모의 얼굴이 들어온다. 물러나지 않으면
 * 크기가 다른 소년 둘이 한 화면에 겹쳐 이중 노출로 보인다.
 *
 * 다른 하나는 **밀림**이다. 물 얼룩을 변위장 삼아 앞 그림을 밀어내고 뒤 그림을
 * 끌어온다 (cut-dissolve의 물 얼룩과 같은 결이라 같은 재생 화면 안에서 재질이
 * 갈라지지 않는다).
 *
 * 화면 해상도로 돌리지 않는다. 긴 변 320px 남짓한 버퍼에서 픽셀마다 두 번 표본을
 * 뜨고 캔버스를 늘려 보여 준다. 넘어가는 1.3초 동안만 서는 그림이고 끝나면 원본
 * `<img>`가 또렷하게 자리를 받으므로 여기에 해상도를 쓸 이유가 없다. WebGL 컨텍스트를
 * 새로 열지 않는 이유이기도 하다: 방의 r3f 캔버스가 이미 하나를 쓰고 있다.
 */
export function PhotoMorph({
  from,
  to,
  within = WHOLE_FRAME,
  seed,
  amplitude: strength = MORPH_AMPLITUDE,
  onDone,
}: PhotoMorphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faded, setFaded] = useState(false);
  // onDone이 바뀌어도 넘어감을 처음부터 다시 돌리지 않는다: 그림 둘만이 이 층의 정체다
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      setFaded(true);
      doneRef.current?.();
    };

    const run = async () => {
      const [head, tail] = await Promise.all([loadImage(from), loadImage(to)]);
      if (cancelled) return;
      const context = canvas.getContext("2d");
      // 한 장이라도 못 읽으면 넘어감이 성립하지 않는다. 곧장 원본 그림에 넘긴다
      if (!head || !tail || !context) return finish();

      const rect = canvas.getBoundingClientRect();
      const size = bufferSize(rect.width, rect.height);
      if (size.width === 0 || size.height === 0) return finish();
      canvas.width = size.width;
      canvas.height = size.height;

      const source = makeLayer(size.width, size.height);
      const target = makeLayer(size.width, size.height);
      if (!source || !target) return finish();

      const field = bakeDisplacement(size.width, size.height, seed);
      const push = Math.min(size.width, size.height) * strength;
      const pixels = context.createImageData(size.width, size.height);
      const out = pixels.data;
      const lastX = size.width - 1;
      const lastY = size.height - 1;
      const feather = Math.min(size.width, size.height) * FEATHER;

      const draw = (progress: number) => {
        const back = 1 - progress;
        const camera = cameraRect(within, progress);
        // 자리는 범위에서 나온다. 두 그림의 자리 사이를 보간하면 겹침이 중간에 풀린다
        const box = visibleBox(
          camera,
          tail.naturalWidth,
          tail.naturalHeight,
          size.width,
          size.height,
        );
        /*
         * 앞 그림은 뒤 그림의 within에 해당한다: 그 자리에 겹쳐 세운다. 테두리에서
         * 힘을 빼는 정도는 진행을 따른다. 0에서는 앞 그림이 자리를 통째로 채우므로
         * 뺄 테두리가 없고, 빼 두면 시작 프레임에 그늘진 액자가 생긴다.
         */
        paintLayer(source, head, framedRect(box, camera, within), null, feather * progress);
        // 뒤 그림은 지금 보는 범위만 잘라 자리에 채운다
        paintLayer(target, tail, box, camera, 0);

        const ahead = source.pixels;
        const behind = target.pixels;
        for (let y = 0; y <= lastY; y += 1) {
          for (let x = 0; x <= lastX; x += 1) {
            const here = y * size.width + x;
            // 가장자리에서는 밀지 않는다. 밀면 그림의 끝이 찢어진 것처럼 들쭉날쭉해진다
            const reach = push * edgeFalloff(x + 0.5, y + 0.5, box, feather);
            const pushX = field.x[here] * reach;
            const pushY = field.y[here] * reach;
            const ax = Math.min(lastX, Math.max(0, Math.round(x + pushX * progress)));
            const ay = Math.min(lastY, Math.max(0, Math.round(y + pushY * progress)));
            const bx = Math.min(lastX, Math.max(0, Math.round(x - pushX * back)));
            const by = Math.min(lastY, Math.max(0, Math.round(y - pushY * back)));
            const ai = (ay * size.width + ax) * 4;
            const bi = (by * size.width + bx) * 4;
            const oi = here * 4;
            const alpha = ahead[ai + 3] * back + behind[bi + 3] * progress;
            out[oi + 3] = alpha;
            if (alpha <= 0) {
              out[oi] = 0;
              out[oi + 1] = 0;
              out[oi + 2] = 0;
              continue;
            }
            // 섞고 나서 알파를 도로 나눈다 (paintLayer의 짝)
            const scale = 255 / alpha;
            out[oi] = (ahead[ai] * back + behind[bi] * progress) * scale;
            out[oi + 1] = (ahead[ai + 1] * back + behind[bi + 1] * progress) * scale;
            out[oi + 2] = (ahead[ai + 2] * back + behind[bi + 2] * progress) * scale;
          }
        }
        context.putImageData(pixels, 0, 0);
      };

      const started = performance.now();
      let lastDrawn = Number.NEGATIVE_INFINITY;
      const loop = (now: number) => {
        const elapsed = now - started;
        if (morphDone(elapsed)) {
          draw(1);
          frame = 0;
          finish();
          return;
        }
        if (now - lastDrawn >= MIN_FRAME_MS) {
          lastDrawn = now;
          draw(morphProgress(elapsed));
        }
        frame = requestAnimationFrame(loop);
      };
      // 첫 프레임을 기다리지 않는다. 한 박자라도 비면 2막 사진이 먼저 비친다
      draw(0);
      lastDrawn = started;
      frame = requestAnimationFrame(loop);
    };

    void run();
    return () => {
      cancelled = true;
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [from, to, seed, strength, within]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      /*
       * 넘어감이 끝나면 300ms에 걸쳐 물러난다. 버퍼가 화면보다 성기므로 마지막 프레임과
       * 원본 `<img>` 사이에 또렷함의 차이가 있는데, 그 차이를 겹쳐 지나가게 한다.
       */
      className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-300 ${
        faded ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}
