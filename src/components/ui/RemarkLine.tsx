"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { lastVisitDone } from "@/data/story-phase";
import { usePointerKind } from "@/i18n/control-hint";
import { type RemarkId, useMemoryRoomStore } from "@/store/memory-room";
import type { CommonTextKey } from "@/types/minigame";

/** 한 줄이 떠 있는 최소 시간(ms). 읽고 한 박자 쉴 만큼: 대사창이 아니라 스치는 혼잣말이다. */
const SHOW_MS = 3200;
/** 긴 줄(다 본 기억의 기록)은 글자 수만큼 더 머문다. 한국어를 소리 없이 읽는 속도쯤. */
const SHOW_PER_CHAR_MS = 90;

/** 혼잣말 id → 본문 키 (common.json). 방문의 두 줄은 예전 자리(door.*)에 그대로 있다. */
const REMARK_TEXT: Record<Exclude<RemarkId, "seen">, CommonTextKey> = {
  "door-stay": "door.nudgeStay",
  "door-ready": "door.nudgeBat",
  "computer-off": "remark.computerOff",
  toothbrush: "remark.toothbrush",
  "sink-locked": "remark.sinkLocked",
  "sink-open": "remark.sinkOpen",
  "piano-done": "remark.pianoDone",
  "parents-locked": "remark.parentsLocked",
  "clock-stopped": "remark.clockStopped",
  "clock-running": "remark.clockRunning",
  aircon: "remark.aircon",
};

/**
 * 물건을 눌렀을 때 흐르는 한 줄 (docs/content-design.md 3-1).
 *
 * 조사도 기록도 아닌 자리의 혼잣말이다: 1페이즈의 닫힌 방문("나가 봐야 뭐 해."),
 * 꺼진 컴퓨터, 화장실 칫솔컵(쉼표 비트), 아빠 힌트를 보기 전의 하부장 (v4 설계서 3-2 · 3-5).
 * 방문의 줄은 잠긴 게 아니라 **안 여는** 것이라는 걸 말한다.
 *
 * 이미 본 기억을 다시 누르면(`seen`) 수첩에 남은 그 기억의 마지막 기록 문장이 흐른다.
 * 조사를 다시 시키지 않으면서, 누른 손에 아무 대답도 없는 일은 만들지 않는다.
 */
/**
 * 줄이 서는 높이. 마우스 기기는 바닥 위 80px. 터치 기기는 왼쪽 아래에 조이스틱
 * (MovementJoystick: 바닥 위 96~208px, 그 밑에 "이동" 라벨 72~88px)이 있어 같은 높이면
 * 긴 문장의 왼쪽 끝이 원판 아랫단과 라벨을 물고 지나갔다. 원판 위(224px)로 올린다.
 */
const POSITION_CLASS = { keys: "bottom-20", touch: "bottom-56" } as const;

export function RemarkLine() {
  const { t } = useTranslation();
  const pointerKind = usePointerKind();
  const { t: tRoom } = useTranslation("memoryRoom");
  const remark = useMemoryRoomStore((state) => state.remark);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const rechecked = useMemoryRoomStore((state) => state.rechecked);
  const [visible, setVisible] = useState(false);

  let text = "";
  if (remark?.id === "seen") {
    const visit = remark.memoryId
      ? lastVisitDone({ collected, revisited, rechecked }, remark.memoryId)
      : undefined;
    if (remark.memoryId && visit) {
      text = tRoom(`lore.${remark.memoryId}.phase${visit}` as ParseKeys<"memoryRoom">);
    }
  } else if (remark) {
    text = t(REMARK_TEXT[remark.id]);
  }
  const showMs = Math.max(SHOW_MS, Array.from(text).length * SHOW_PER_CHAR_MS);

  useEffect(() => {
    if (remark === null) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), showMs);
    return () => window.clearTimeout(timer);
  }, [remark, showMs]);

  if (!visible || remark === null || text === "") return null;

  return (
    <p
      // 누를 때마다 새로 떠오른다. key가 바뀌어야 애니메이션이 다시 돈다
      key={remark.at}
      className={`monologue-text pointer-events-none absolute ${POSITION_CLASS[pointerKind]} left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-ivory`}
    >
      {text}
    </p>
  );
}
