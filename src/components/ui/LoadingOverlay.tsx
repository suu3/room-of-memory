"use client";

import { ASSETS } from "@/lib/assets";

/** dimmed 배경 위에 로딩 애니메이션 + 진행 바를 띄우는 전체 화면 오버레이. */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-scene-void/85 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex w-56 flex-col items-center gap-5">
        {/* biome-ignore lint/performance/noImgElement: 애니메이션 gif라 next/image를 태우면 프레임이 죽는다. */}
        <img
          src={ASSETS.images.uiLoading}
          alt=""
          aria-hidden
          width={420}
          height={400}
          className="h-auto w-40"
        />
        {/* 실제 진행률을 알 수 없으므로 indeterminate 바 — aria-valuenow를 주지 않는다 */}
        <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-bone/15">
          <div className="h-full w-1/3 animate-loading-sweep rounded-full bg-memory" />
        </div>
        <p className="text-xs tracking-widest text-fog">{label}</p>
      </div>
    </div>
  );
}
