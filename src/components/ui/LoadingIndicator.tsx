"use client";

import { ASSETS } from "@/lib/assets";

/**
 * 게임의 로딩 표시 — 달리는 아이 + 진행 바 + 문구.
 *
 * 전체 화면 오버레이(LoadingOverlay)와 타이틀 화면의 시작 버튼 아래, 두 자리에서
 * 같은 것을 쓴다. 로딩이라는 같은 사건에 다른 그림을 세우면 두 개의 다른 일처럼
 * 보인다.
 *
 * `percent`를 주면 그만큼 찬 바가 되고, 안 주면 훑고 지나가는 바가 된다 —
 * 셀 것이 아직 없을 때(첫 파일이 도착하기 전) 0%짜리 바는 멈춘 것처럼 보인다.
 */
export function LoadingIndicator({
  label,
  percent,
  size = "full",
}: {
  label: string;
  /** 0~100. 없으면 진행을 모르는 상태로 그린다. */
  percent?: number;
  /** 화면을 덮을 때는 크게, 타이틀 안에 얹을 때는 작게. */
  size?: "full" | "inline";
}) {
  const full = size === "full";
  return (
    <div className={`flex flex-col items-center ${full ? "w-56 gap-5" : "w-52 gap-3"}`}>
      {/* biome-ignore lint/performance/noImgElement: 애니메이션 gif라 next/image를 태우면 프레임이 죽는다. */}
      <img
        src={ASSETS.images.uiLoading}
        alt=""
        aria-hidden
        width={420}
        height={400}
        className={`h-auto ${full ? "w-40" : "w-24"}`}
      />
      <div
        className={`h-1 w-full overflow-hidden rounded-full ${
          // 타이틀에서는 뒤에 밝은 방이 비쳐 회색 트랙이 묻힌다 — 어둡게 깔고 테두리를 준다
          full ? "bg-bone/15" : "bg-night/50 ring-1 ring-inset ring-bone/25"
        }`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {percent === undefined ? (
          <div className="h-full w-1/3 animate-loading-sweep rounded-full bg-memory" />
        ) : (
          <div
            className="h-full rounded-full bg-memory transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      <p
        aria-hidden
        className={
          full
            ? "text-xs tracking-widest text-fog"
            : "text-[0.6875rem] font-bold tracking-[0.18em] text-bone [text-shadow:0_2px_8px_var(--color-scene-void),0_0_3px_var(--color-scene-void)]"
        }
      >
        {label}
      </p>
    </div>
  );
}
