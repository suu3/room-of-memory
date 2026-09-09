"use client";

import { LoadingIndicator } from "./LoadingIndicator";

/** dimmed 배경 위에 로딩 애니메이션 + 진행 바를 띄우는 전체 화면 오버레이. */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-scene-void/85 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* 실제 진행률을 알 수 없는 자리다 — percent를 주지 않으면 훑고 지나가는 바가 된다 */}
      <LoadingIndicator label={label} />
    </div>
  );
}
