"use client";

import { ASSETS } from "@/lib/assets";

/** 진행 막대의 칸 수. 퍼센트를 칸으로 옮겨 찍는다. 가는 선보다 픽셀 화면의 문법에 맞다. */
const SEGMENTS = 8;

/**
 * 로딩 애니메이션 + 분절 진행 막대 + 한 줄 안내.
 *
 * 달리는 도해(gif) 아래에 앰버 칸이 왼쪽부터 찬다. 퍼센트를 모르면(percent 없음) 칸을
 * 다 비운 채 한 칸 폭의 빛이 왕복한다. 숫자는 안내 문구 안에 같이 실린다.
 * 막대는 감각, 숫자는 확인.
 */
export function LoadingIndicator({ label, percent }: { label: string; percent?: number }) {
  const filled = percent === undefined ? 0 : Math.round((percent / 100) * SEGMENTS);

  return (
    <div className="flex w-56 flex-col items-center gap-5">
      {/* biome-ignore lint/performance/noImgElement: 애니메이션 gif라 next/image를 태우면 프레임이 죽는다. */}
      <img
        src={ASSETS.images.uiLoading}
        alt=""
        aria-hidden
        width={420}
        height={400}
        className="h-auto w-24"
      />
      <div
        className="relative flex gap-1.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 칸의 반복이라 인덱스 말고 구분할 값이 없다.
            key={index}
            aria-hidden
            className={`block size-2.5 rounded-[2px] transition-colors duration-300 ${
              index < filled ? "bg-memory" : "bg-ivory/15"
            }`}
          />
        ))}
        {percent === undefined ? (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/3 animate-loading-sweep rounded-[2px] bg-memory/60"
          />
        ) : null}
      </div>
      <p aria-hidden className="break-ko text-center text-sm leading-normal text-fog">
        {label}
      </p>
    </div>
  );
}
