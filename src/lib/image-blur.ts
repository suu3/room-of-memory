import type { CSSProperties } from "react";
import { IMAGE_BLUR } from "@/data/generated/image-blur";

/**
 * 큰 그림의 흐린 미리보기 (scripts/build-image-blur.mjs가 굽는다).
 *
 * 그림이 받아지기 전 빈 칸 대신 흐린 판을 세운다. 서비스 워커가 한 번 받은 그림은
 * 캐시에서 바로 읽으므로 실제로 보이는 건 대개 첫 방문뿐이다. 구워 둔 게 없는 경로
 * (작은 그림, 찍어 둔 스틸의 data URL)는 undefined라 아무것도 깔지 않는다.
 */
export function blurDataUrlOf(src: string | undefined): string | undefined {
  if (!src) return undefined;
  return IMAGE_BLUR[src.split("?")[0]];
}

/**
 * `<img>`에 그대로 거는 배경. 불투명한 그림만 구워 두므로 받아진 원본이 판을 다 덮는다.
 * `fit`은 그 `<img>`의 object-fit과 맞춘다. 안 맞으면 받아지는 순간 형태가 튄다.
 */
export function blurBackdrop(
  src: string | undefined,
  fit: "cover" | "contain" | "fill" = "cover",
): CSSProperties | undefined {
  const data = blurDataUrlOf(src);
  if (!data) return undefined;
  return {
    backgroundImage: `url(${data})`,
    backgroundSize: fit === "fill" ? "100% 100%" : fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}
