"use client";

import { ASSETS } from "@/lib/assets";

/** dimmed 배경 위에 로딩 이미지를 띄우는 전체 화면 오버레이. */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-scene-void/85 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-5">
        {/* biome-ignore lint/performance/noImgElement: public/ 정적 SVG라 next/image 최적화가 불필요하다. */}
        <img
          src={ASSETS.images.uiLoading}
          alt=""
          aria-hidden
          width={96}
          height={96}
          className="size-24"
        />
        <p className="text-xs tracking-widest text-fog">{label}</p>
      </div>
    </div>
  );
}
