"use client";

import { hpRatio, MAX_HP } from "./duel";

/**
 * 격투 게임 체력 게이지.
 *
 * 두 겹이다: 앞면은 맞는 즉시 줄고, 뒷면(잔상)은 한 박자 늦게 따라온다. 격투
 * 게임이 늘 쓰는 문법인데 이유가 있다. **얼마나 깎였는지**가 숫자가 아니라
 * 길이로 남아야 "크게 한 방 먹었다"가 눈으로 읽힌다. 잔상만 벽돌빛(ember)인 것도
 * 같은 이유로, 색이 뜻하는 건 남은 체력이 아니라 방금 잃은 체력이다.
 */
export function HealthBar({
  hp,
  label,
  side,
  tone,
  enraged,
}: {
  hp: number;
  label: string;
  /** 게이지가 줄어드는 방향: 두 게이지가 화면 가운데를 향해 마주 준다. */
  side: "left" | "right";
  tone: "memory" | "bone";
  /** 상대가 각성했는가. 테두리가 벽돌빛으로 숨쉰다. */
  enraged?: boolean;
}) {
  const ratio = hpRatio(hp);
  const fill = tone === "memory" ? "bg-memory" : "bg-bone";
  const origin = side === "left" ? "origin-left" : "origin-right";

  return (
    <div className={`min-w-0 flex-1 ${side === "right" ? "text-right" : ""}`}>
      <span className="block truncate font-pixel text-[0.65rem] tracking-widest text-bone/70">
        {label}
      </span>
      {/*
        남은 체력은 그림이 아니라 값이라 읽히기도 해야 한다. 스타일이 필요한 층과
        의미를 지는 층을 갈라 둔다. 눈으로 보는 건 아래 트랙, 읽히는 건 이 meter.
      */}
      <meter className="sr-only" value={hp} min={0} max={MAX_HP} aria-label={label}>
        {Math.round(hp)}/{MAX_HP}
      </meter>
      <div
        aria-hidden
        // 게이지 트랙. 각성하면 테두리만 벽돌빛으로 바뀐다. 게이지 자체를 물들이면
        // 남은 체력과 경고가 같은 색이 돼서 어느 쪽이 정보인지 알 수 없다.
        className={`relative mt-1 h-3 overflow-hidden rounded-sm border bg-night/70 ${
          enraged ? "animate-duel-rage border-ember" : "border-bone/25"
        }`}
      >
        {/* 잔상: 방금 잃은 만큼. 앞면보다 느리게 따라붙는다 */}
        <div
          className={`absolute inset-0 ${origin} bg-ember transition-transform delay-200 duration-500 ease-out`}
          style={{ transform: `scaleX(${ratio})` }}
        />
        <div
          className={`absolute inset-0 ${origin} ${fill} transition-transform duration-150 ease-out`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}
