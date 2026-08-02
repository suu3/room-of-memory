"use client";

import ReactDOM from "react-dom";
import { ASSETS } from "@/lib/assets";

/**
 * 화면에 가장 먼저 뜨는 리소스를 문서 헤드에서 미리 받아둔다.
 * App Router에서는 `<link rel="preload">`를 직접 쓰지 않고 ReactDOM.preload를 쓴다
 * (next/dist/docs > generate-metadata > Resource hints).
 */
export function PreloadResources() {
  // 로딩 오버레이의 gif — 이걸 받는 동안 로딩 화면이 비어 보이는 걸 막는다.
  ReactDOM.preload(ASSETS.images.uiLoading, { as: "image" });
  return null;
}
