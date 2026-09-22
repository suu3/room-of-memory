"use client";

import dynamic from "next/dynamic";

// 미니게임이 스프라이트 시트 확인(Image)과 rAF를 쓰므로 서버에서는 렌더하지 않는다 (radio-noise와 같은 방식).
const ConsolePixelsLab = dynamic(
  () => import("./ConsolePixelsLab").then((m) => m.ConsolePixelsLab),
  { ssr: false },
);

export default function ConsolePixelsLabPage() {
  return <ConsolePixelsLab />;
}
