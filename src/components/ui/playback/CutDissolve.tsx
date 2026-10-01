"use client";

import { useEffect, useRef } from "react";
import { bakeNoise, dissolveThreshold, type NoiseGrain } from "./cut-dissolve";

/** 노이즈 판 한 변. 캔버스에 늘리거나 깔아 쓰므로 이 이상은 낭비다. */
const NOISE_SIZE = 128;
/**
 * 그리는 간격의 하한. rAF는 60fps로 오지만 문턱값 장막은 30fps로 충분하다
 * (docs/visual-experiments.md 7장). 16.7ms 프레임 둘에 한 번씩 걸리도록 30ms로 잡는다.
 */
const MIN_FRAME_MS = 30;
/** 필름 그레인은 판을 늘리지 않고 깐다. 노이즈 픽셀 하나가 화면에서 이 배수로 보인다. */
const FILM_TILE_SCALE = 2;
/** 한 컷의 시드는 컷 열쇠에서 온다. 결마다 다른 판이 나오도록 결에도 값 하나를 준다. */
const GRAIN_SEED: Record<NoiseGrain, number> = { paper: 101, film: 211, water: 307 };

export interface CutDissolveProps {
  /** 컷의 정체. 바뀔 때마다 장막이 한 번 걷힌다. */
  cutKey: string | number;
  grain: NoiseGrain;
  /** 걷히는 데 걸리는 시간. 기본 600ms. */
  durationMs?: number;
  /** 호출부가 useEffectEnabled로 정해 준다. 끄면 아무것도 그리지 않는다 (지금 화면 그대로). */
  enabled: boolean;
}

/** 문자열 열쇠를 정수 시드로. 같은 컷은 같은 시드, 곧 같은 판. */
function seedFromKey(key: string | number): number {
  if (typeof key === "number") return Math.trunc(key) | 0;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * 계산된 color("rgb(6, 10, 16)")를 바이트 셋으로. 브라우저가 var()를 풀어 준 값만 받는다.
 * 못 읽으면(테스트, 스타일시트 없는 환경) null: 그때는 그리지 않는다.
 */
function parseRgb(color: string): [number, number, number] | null {
  const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(color);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * 컷이 바뀔 때 그림 위에 얹히는 장막 (docs/visual-experiments.md 7장 "회상 컷 간").
 *
 * 앞 컷의 그림을 붙잡아 둘 수는 없다(DOM 이미지를 읽지 못한다). 대신 scene-void 색 장막을
 * 새 컷 위에 통째로 덮고, 노이즈 판을 문턱값으로 잘라 결을 따라 걷어낸다. 노이즈 값이
 * 문턱값보다 낮은 픽셀만 덮인 채 남고, 문턱값이 1에서 0으로 내려가는 동안 밝은 알갱이
 * 부터 차례로 뚫린다. 새 컷이 결 사이로 "스며 나온다".
 *
 * 매 프레임 하는 일은 128×128 ImageData의 알파 채널을 채우고 putImageData 한 번, 그걸
 * 큰 캔버스에 drawImage 한 번(필름은 깔기 때문에 여러 번)이다. 필름은 imageSmoothing을
 * 끄고 노이즈 픽셀이 그대로 서게, 종이·물은 켜서 늘린 판이 얼룩으로 번지게 한다.
 * React 상태는 건드리지 않는다: 시간과 프레임은 전부 ref와 클로저 안에서 산다.
 */
export function CutDissolve({ cutKey, grain, durationMs = 600, enabled }: CutDissolveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    // 장막 색은 토큰에서. 캔버스에 text-scene-void를 입혀 두고 계산된 color를 읽는다
    const rgb = parseRgb(window.getComputedStyle(canvas).color);
    if (!rgb) return;

    // 판은 컷마다 한 번. 16K 픽셀이라 굽는 데 1ms 안팎이다
    const noise = bakeNoise(NOISE_SIZE, NOISE_SIZE, grain, seedFromKey(cutKey) + GRAIN_SEED[grain]);
    const plate = document.createElement("canvas");
    plate.width = NOISE_SIZE;
    plate.height = NOISE_SIZE;
    const plateContext = plate.getContext("2d");
    if (!plateContext) return;
    const pixels = plateContext.createImageData(NOISE_SIZE, NOISE_SIZE);
    // 색은 한 번만 채운다. 프레임마다 바뀌는 건 알파뿐이다
    for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i += 1) {
      pixels.data[i * 4] = rgb[0];
      pixels.data[i * 4 + 1] = rgb[1];
      pixels.data[i * 4 + 2] = rgb[2];
    }

    // 캔버스 해상도는 CSS 픽셀 그대로. 장막 하나에 고해상도를 쓸 이유가 없다
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = width;
    canvas.height = height;

    const started = performance.now();
    let lastDrawn = Number.NEGATIVE_INFINITY;
    let frame = 0;

    const draw = (threshold: number) => {
      // 문턱값을 0..256으로 올려 비교한다: 1이면 바이트 255까지 전부 덮이고, 0이면 아무것도 안 덮인다
      const cutoff = threshold * 256;
      for (let i = 0; i < noise.length; i += 1) {
        pixels.data[i * 4 + 3] = noise[i] < cutoff ? 255 : 0;
      }
      plateContext.putImageData(pixels, 0, 0);
      context.clearRect(0, 0, width, height);
      if (grain === "film") {
        // 필름: 노이즈 픽셀이 그대로 알갱이로 서야 한다. 늘리지 않고 작은 배수로 깐다
        context.imageSmoothingEnabled = false;
        const tile = NOISE_SIZE * FILM_TILE_SCALE;
        for (let y = 0; y < height; y += tile) {
          for (let x = 0; x < width; x += tile) {
            context.drawImage(plate, x, y, tile, tile);
          }
        }
      } else {
        // 종이·물: 판 하나를 화면 크기로 늘린다. 보간이 얼룩의 가장자리를 부드럽게 한다
        context.imageSmoothingEnabled = true;
        context.drawImage(plate, 0, 0, width, height);
      }
    };

    const loop = (now: number) => {
      const elapsed = now - started;
      if (elapsed >= durationMs) {
        // 다 걷혔다: 완전히 투명하게 비우고 루프를 놓는다
        context.clearRect(0, 0, width, height);
        frame = 0;
        return;
      }
      if (now - lastDrawn >= MIN_FRAME_MS) {
        lastDrawn = now;
        draw(dissolveThreshold(elapsed, durationMs));
      }
      frame = requestAnimationFrame(loop);
    };

    // 첫 프레임은 기다리지 않고 바로 덮는다. rAF 한 박자 사이에 새 컷이 맨 채로 비치면 안 된다
    draw(1);
    lastDrawn = started;
    frame = requestAnimationFrame(loop);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
  }, [cutKey, grain, durationMs, enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-scene-void"
    />
  );
}
