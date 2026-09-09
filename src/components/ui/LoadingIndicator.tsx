"use client";

import { ASSETS } from "@/lib/assets";

/** 로딩 애니메이션 + 진행 바. percent가 없으면 훑고 지나가는 바가 된다. */
export function LoadingIndicator({ label, percent }: { label: string; percent?: number }) {
  return (
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
      <div
        className="h-0.5 w-full overflow-hidden rounded-full bg-ivory/15"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {percent === undefined ? (
          <div className="h-full w-1/3 animate-loading-sweep rounded-full bg-memory" />
        ) : (
          <div className="h-full rounded-full bg-memory" style={{ width: `${percent}%` }} />
        )}
      </div>
      <p aria-hidden className="text-xs tracking-[0.06em] text-fog">
        {label}
      </p>
    </div>
  );
}
