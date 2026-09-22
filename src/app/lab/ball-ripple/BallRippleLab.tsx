"use client";

import { type MouseEvent, useRef } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { ASSETS } from "@/lib/assets";
import { type InkRippleHandle, InkRippleLayer } from "@/minigames/ball-catch/ink-ripple";
import { lifeMs } from "@/minigames/ball-catch/ripple";

/**
 * 사인볼 필드 파문의 단독 데모 (docs/visual-experiments.md 4장 · 10장 8번).
 *
 * 필드와 같은 크기의 판(들판 그림 + 밤 톤)에 클릭으로 파문을 얹는다. `intensity`가
 * 감쇠다: 0이 가장 밝은 방(천천히 번진다), 1이 가장 어두운 방(잠깐 스치고 만다).
 * 2차는 대사만이라 필드가 없다(4장): `gamePhase` 토글은 여기서 아무것도 바꾸지 않는다.
 * `enabled`를 끄면 층이 빠지고 판만 남는다.
 */
export function BallRippleLab() {
  const handleRef = useRef<InkRippleHandle>(null);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    handleRef.current?.spawn(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  };

  return (
    <LabFrame
      title="사인볼 · 필드 잉크 파문"
      note="판을 클릭하면 그 자리에서 잉크가 번진다. intensity가 감쇠(0 밝은 방, 1 어두운 방). 2차 토글은 자리가 없어 변화 없음."
    >
      {({ intensity, enabled }) => (
        <div className="space-y-3">
          <button
            type="button"
            aria-label="파문 얹기"
            onClick={onClick}
            className="relative block h-96 w-full cursor-crosshair overflow-hidden rounded-xs border-2 border-night"
          >
            <div className="absolute inset-0 bg-scene-abyss" />
            {/* biome-ignore lint/performance/noImgElement: 미니게임 필드와 같은 배경 그림을 그대로 깐다. */}
            <img
              className="absolute inset-0 size-full object-cover object-center"
              src={ASSETS.images.mgBallCatchSunsetField}
              alt=""
            />
            <div className="absolute inset-0 bg-night/20" aria-hidden />
            <div className="ball-catch-sky absolute inset-0" aria-hidden />
            <InkRippleLayer handleRef={handleRef} decay={intensity} enabled={enabled} />
            {/* 링 자리 표시: 게임에서 파문이 서는 높이(top 68%) */}
            <div
              className="absolute left-1/2 top-[68%] size-24 -translate-x-1/2 -translate-y-1/2 border border-dashed border-memory/50"
              aria-hidden
            />
          </button>
          <p className="text-sm text-fog">
            수명 {Math.round(lifeMs(intensity))}ms · 링 셋 + 중심 얼룩, multiply.
          </p>
        </div>
      )}
    </LabFrame>
  );
}
