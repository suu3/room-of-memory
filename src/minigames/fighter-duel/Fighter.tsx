"use client";

import type { Move } from "./duel";
import { frameBackgroundSize, framePosition, useSpriteSheet } from "./sprites";

/**
 * 격투 게임 화면의 캐릭터.
 *
 * 스프라이트 시트(`sprite`)가 리포에 있으면 그걸 그리고, 없으면 블록 몇 개로
 * 자세만 만든다. 에셋이 없어도 게임이 돌아야 하고, 넣으면 코드를 안 고치고도
 * 바로 바뀌어야 한다 — 시트 규격은 ./sprites.ts 주석에 적어 뒀다.
 *
 * 어느 쪽이든 플레이어가 읽어야 하는 건 얼굴이 아니라 "팔이 어디 있는가"다.
 */
export type Pose = Move | "idle" | "hurt" | "ko" | "win";

/**
 * 팔 각도(deg). 어깨에 고정하고 회전만 시킨다 — 0이 정면으로 쭉 뻗은 상태,
 * 양수는 아래로, 음수는 위로. 몸통 밖으로 확실히 나가야 자세가 읽힌다.
 */
const ARMS: Record<Pose, { front: number; back: number }> = {
  // 기본 자세 — 두 팔을 늘어뜨린 채 상대를 본다
  idle: { front: 62, back: 76 },
  // 공격 — 앞팔이 정면으로 쭉
  strike: { front: 0, back: 104 },
  // 방어 — 두 팔을 얼굴 앞으로 올린다
  guard: { front: -100, back: -118 },
  // 필살기 — 두 팔을 앞으로 나란히 모아 내민다 (id는 코드가 쓰는 키라 throw 그대로)
  throw: { front: 6, back: 20 },
  // 맞았을 때 — 팔이 뒤로 풀린다
  hurt: { front: 128, back: 142 },
  // 쓰러졌을 때 — 팔이 완전히 늘어진다 (몸통은 아래 KO_TILT가 눕힌다)
  ko: { front: 96, back: 108 },
  // 이겼을 때 — 한 팔을 하늘로
  win: { front: -80, back: 70 },
};

/** 자세마다 몸이 얼마나 기우는가(deg). 팔만으로는 안 되는 무게중심 이동. */
const LEAN: Partial<Record<Pose, number>> = {
  strike: 8,
  hurt: -14,
  ko: -78,
  win: -3,
};

const ARM_CLASS = "absolute top-[36%] h-2.5 w-10 origin-left rounded-sm transition-transform";

/** 에셋 없이 버티는 쪽. 여기가 기준이고 스프라이트는 그 위에 얹는 선택지다. */
function BlockFighter({ pose, tone }: { pose: Pose; tone: "memory" | "bone" }) {
  const arms = ARMS[pose];
  const body = tone === "memory" ? "bg-memory" : "bg-bone";
  const dark = tone === "memory" ? "bg-memory/55" : "bg-bone/50";

  return (
    <div
      className="absolute inset-0 origin-bottom transition-transform duration-200"
      style={{ transform: `rotate(${LEAN[pose] ?? 0}deg)` }}
    >
      {/* 뒷팔 — 몸통 뒤라 한 톤 어둡게. 어깨는 몸통 안쪽에 둔다 */}
      <div
        className={`${ARM_CLASS} ${dark} left-[calc(50%-6px)] duration-200`}
        style={{ transform: `rotate(${arms.back}deg)` }}
      />
      {/* 머리 */}
      <div className={`absolute left-1/2 top-[6%] size-9 -translate-x-1/2 rounded-sm ${body}`} />
      {/* 몸통 */}
      <div
        className={`absolute left-1/2 top-[32%] h-14 w-12 -translate-x-1/2 rounded-sm ${body}`}
      />
      {/* 다리 */}
      <div className={`absolute bottom-0 left-[26%] h-12 w-3.5 rounded-sm ${body}`} />
      <div className={`absolute bottom-0 right-[26%] h-12 w-3.5 rounded-sm ${dark}`} />
      {/* 앞팔 — 어깨가 몸통 바깥 모서리라 뻗으면 실루엣이 확실히 바뀐다 */}
      <div
        className={`${ARM_CLASS} ${body} left-[calc(50%+14px)] duration-200`}
        style={{ transform: `rotate(${arms.front}deg)` }}
      />
    </div>
  );
}

/**
 * 시트에서 해당 자세 프레임 한 칸만 잘라 보여준다.
 * 시트를 프레임 수만큼 늘려 깔고 background-position으로 칸을 옮기는 방식이라,
 * 프레임이 바뀌어도 새 요청이 나가지 않는다 (한 장을 계속 재사용).
 */
function SpriteFighter({ pose, sprite }: { pose: Pose; sprite: string }) {
  return (
    <div
      className="absolute inset-0 bg-no-repeat [image-rendering:pixelated]"
      style={{
        backgroundImage: `url(${sprite})`,
        backgroundSize: frameBackgroundSize,
        backgroundPosition: framePosition(pose),
      }}
    />
  );
}

export function Fighter({
  pose,
  tone,
  facing,
  shake,
  flash,
  sprite,
  offsetY = 0,
}: {
  pose: Pose;
  /** 블록 캐릭터일 때의 도트 색 — 플레이어는 금빛, 상대는 바랜 크림. */
  tone: "memory" | "bone";
  facing: "right" | "left";
  shake?: boolean;
  /** 맞은 순간 한 프레임 하얗게 뜬다 — 격투 게임의 히트 플래시. */
  flash?: boolean;
  /** 스프라이트 시트 경로. 파일이 없으면 자동으로 블록 캐릭터가 나온다. */
  sprite: string;
  /**
   * 세로 미세 조정(px, 양수가 아래). 시트마다 프레임 안에서 발이 앉은 높이가
   * 조금씩 달라서, 그대로 두면 한쪽만 바닥에서 떠 보인다. 그림을 다시 그리는
   * 대신 여기서 맞춘다.
   */
  offsetY?: number;
}) {
  const sheet = useSpriteSheet(sprite);

  return (
    /*
      움직임을 한 층에 하나씩만 맡긴다. 흔들림·숨쉬기·자세는 전부 transform이라
      같은 요소에 겹치면 나중 것이 앞의 것을 통째로 덮어쓴다 — 맞고 흔들리는 동안
      기울기가 풀리거나 숨쉬기가 흔들림을 지운다.
      (좌우 뒤집기만 예외로 바깥에 남는다. Tailwind v4의 scale은 별도 속성이라
      transform과 부딪히지 않는다.)
    */
    <div
      aria-hidden
      className={`relative h-40 w-28 ${facing === "left" ? "-scale-x-100" : ""}`}
      // 자리 잡기는 바깥에서 한 번만. 안쪽 층은 흔들림·숨쉬기·자세가 이미 쓰고 있다
      style={offsetY ? { transform: `translateY(${offsetY}px)` } : undefined}
    >
      <div className={`absolute inset-0 ${shake ? "animate-batting-field-shake" : ""}`}>
        {/* 숨쉬기는 자세 레이어 바깥 — 안쪽에 걸면 자세 전환과 겹쳐 팔이 제자리에 안 선다 */}
        <div className={`absolute inset-0 ${pose === "idle" ? "animate-duel-breathe" : ""}`}>
          <div className={`absolute inset-0 ${flash ? "animate-duel-flash" : ""}`}>
            {sheet === "ready" ? (
              <SpriteFighter pose={pose} sprite={sprite} />
            ) : (
              <BlockFighter pose={pose} tone={tone} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
