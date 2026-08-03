import type { Move } from "./duel";

/**
 * 격투 게임 화면의 도트 캐릭터. 이미지 에셋 없이 블록 몇 개로 자세만 만든다 —
 * 플레이어가 읽어야 하는 건 얼굴이 아니라 "팔이 어디 있는가"다.
 */
export type Pose = Move | "idle" | "hurt";

/**
 * 팔 각도(deg). 어깨에 고정하고 회전만 시킨다 — 0이 정면으로 쭉 뻗은 상태,
 * 양수는 아래로, 음수는 위로. 몸통 밖으로 확실히 나가야 자세가 읽힌다.
 */
const ARMS: Record<Pose, { front: number; back: number }> = {
  // 기본 자세 — 두 팔을 늘어뜨린 채 상대를 본다
  idle: { front: 62, back: 76 },
  // 때리기 — 앞팔이 정면으로 쭉
  strike: { front: 0, back: 104 },
  // 막기 — 두 팔을 얼굴 앞으로 올린다
  guard: { front: -100, back: -118 },
  // 잡기 — 두 팔을 앞으로 나란히 내민다
  throw: { front: 6, back: 20 },
  // 맞았을 때 — 팔이 뒤로 풀린다
  hurt: { front: 128, back: 142 },
};

const ARM_CLASS = "absolute top-[36%] h-2.5 w-10 origin-left rounded-sm transition-transform";

export function Fighter({
  pose,
  tone,
  facing,
  shake,
}: {
  pose: Pose;
  /** 도트 색 — 플레이어는 금빛, 상대는 바랜 크림. */
  tone: "memory" | "bone";
  facing: "right" | "left";
  shake?: boolean;
}) {
  const arms = ARMS[pose];
  const body = tone === "memory" ? "bg-memory" : "bg-bone";
  const dark = tone === "memory" ? "bg-memory/55" : "bg-bone/50";
  const lean = pose === "hurt" ? -14 : pose === "strike" ? 8 : 0;

  return (
    <div
      aria-hidden
      className={`relative h-40 w-28 ${facing === "left" ? "-scale-x-100" : ""} ${
        shake ? "animate-batting-field-shake" : ""
      }`}
    >
      <div
        className="absolute inset-0 origin-bottom transition-transform duration-200"
        style={{ transform: `rotate(${lean}deg)` }}
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
    </div>
  );
}
