"use client";

import { ASSETS } from "@/lib/assets";

/**
 * 게임의 로딩 표시 — 달리는 아이 + 진행 바 + 문구.
 *
 * 부팅 커튼(BootCurtain)과 시작 버튼을 누른 뒤의 오버레이(LoadingOverlay), 두
 * 자리에서 같은 것을 쓴다. 로딩이라는 같은 사건에 다른 그림을 세우면 두 개의 다른
 * 일처럼 보인다.
 *
 * `percent`를 주면 그만큼 찬 바가 되고, 안 주면 훑고 지나가는 바가 된다 —
 * 셀 것이 아직 없을 때(첫 파일이 도착하기 전) 0%짜리 바는 멈춘 것처럼 보인다.
 */
export function LoadingIndicator({
  label,
  percent,
}: {
  label: string;
  /** 0~100. 없으면 진행을 모르는 상태로 그린다. */
  percent?: number;
}) {
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
        className="h-1 w-full overflow-hidden rounded-full bg-bone/15"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {percent === undefined ? (
          <div className="h-full w-1/3 animate-loading-sweep rounded-full bg-memory" />
        ) : (
          /*
           * width에 transition을 걸지 않는다. 이 값을 주는 쪽이 이미 프레임마다
           * 흐르는 값을 만들어 넘기므로(loading-progress), CSS가 한 번 더 늦추면
           * 바가 100%에 닿기 전에 커튼이 먼저 걷힌다.
           */
          <div className="h-full rounded-full bg-memory" style={{ width: `${percent}%` }} />
        )}
      </div>
      <p aria-hidden className="text-xs tracking-widest text-fog">
        {label}
      </p>
    </div>
  );
}
