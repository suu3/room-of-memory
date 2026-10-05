"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { lastVisitDone } from "@/data/story-phase";
import { usePointerKind } from "@/i18n/control-hint";
import { getMinigame } from "@/minigames";
import {
  type RemarkId,
  selectBatReady,
  selectDoorReady,
  useMemoryRoomStore,
} from "@/store/memory-room";
import type { CommonTextKey } from "@/types/minigame";

/** 한 줄이 떠 있는 최소 시간(ms). 읽고 한 박자 쉴 만큼: 대사창이 아니라 스치는 혼잣말이다. */
const SHOW_MS = 3200;
/** 긴 줄(다 본 기억의 기록)은 글자 수만큼 더 머문다. 한국어를 소리 없이 읽는 속도쯤. */
const SHOW_PER_CHAR_MS = 90;

/** 혼잣말 id → 본문 키 (common.json). 방문의 두 줄은 예전 자리(door.*)에 그대로 있다. */
const REMARK_TEXT: Record<Exclude<RemarkId, "seen" | "needs-item">, CommonTextKey> = {
  "door-stay": "door.nudgeStay",
  "door-ready": "door.nudgeBat",
  "computer-off": "remark.computerOff",
  toothbrush: "remark.toothbrush",
  "rabbit-doll": "remark.rabbitDoll",
  "drawer-locked": "remark.drawerLocked",
  "drawer-open": "remark.drawerOpen",
  "piano-done": "remark.pianoDone",
  "sheet-taken": "remark.sheetTaken",
  "code-found": "remark.codeFound",
  "parents-locked": "remark.parentsLocked",
  "clock-stopped": "remark.clockStopped",
  "clock-running": "remark.clockRunning",
  aircon: "remark.aircon",
  locked: "remark.locked",
  "sink-still": "remark.sinkStill",
  "sink-drained": "remark.sinkDrained",
  "sanitizer-found": "remark.sanitizerFound",
};

/**
 * 물건을 눌렀을 때 흐르는 한 줄 (docs/story/content-design.md 3-1).
 *
 * 조사도 기록도 아닌 자리의 혼잣말이다: 1페이즈의 닫힌 방문("나가 봐야 뭐 해."),
 * 꺼진 컴퓨터, 화장실 칫솔컵(쉼표 비트), 아빠 힌트를 보기 전의 협탁 서랍 (v4 설계서 3-2 · 3-5).
 * 방문의 줄은 잠긴 게 아니라 **안 여는** 것이라는 걸 말한다.
 *
 * 이미 본 기억을 다시 누르면(`seen`) 수첩에 남은 그 기억의 마지막 기록 문장이 흐른다.
 * 조사를 다시 시키지 않으면서, 누른 손에 아무 대답도 없는 일은 만들지 않는다.
 */
/**
 * 줄이 서는 높이. 마우스 기기는 바닥 위 80px. 터치 기기는 왼쪽 아래에 조이스틱
 * (MovementJoystick: 바닥 위 96~208px, 그 밑에 "이동" 라벨 72~88px)이 있어 같은 높이면
 * 긴 문장의 왼쪽 끝이 원판 아랫단과 라벨을 물고 지나갔다. 원판 위(224px)로 올린다.
 *
 * 넓은 화면에서 문·배트 안내 줄("방문이 빛난다", MemoryRoom)이 떠 있으면 그 줄이
 * 바닥 위 64~92px에 선다. 80px에 서면 두 줄짜리 기록 문장의 아랫단이 그 위를 덮어서
 * (2026-09-27) 안내 줄 위(112px)로 비켜선다. 좁은 화면의 안내 줄은 32px라 닿지 않는다.
 */
const POSITION_CLASS = { keys: "bottom-20", touch: "bottom-56" } as const;
const ABOVE_CALLOUT_CLASS = { keys: "bottom-20 md:bottom-28", touch: "bottom-56" } as const;
/**
 * 씬 안의 문제 판(피아노)이 떠 있을 때. 바닥 위 24px부터 조작 안내 칩과 돌아가기
 * 버튼(PuzzleHost)이 약 110px까지 쌓여 있어 그 위로 비켜선다.
 */
const ABOVE_PUZZLE_CLASS = { keys: "bottom-32", touch: "bottom-56" } as const;

export function RemarkLine() {
  const { t } = useTranslation();
  const pointerKind = usePointerKind();
  const { t: tRoom } = useTranslation("memoryRoom");
  const remark = useMemoryRoomStore((state) => state.remark);
  // MemoryRoom의 문·배트 안내 줄과 같은 조건
  // 문제 판이 떠 있으면 바닥에 판의 안내·돌아가기(PuzzleHost)가 서 있다
  const puzzleOpen = useMemoryRoomStore((state) => state.activePuzzle !== null);
  const calloutShown = useMemoryRoomStore(
    (state) => (selectDoorReady(state) || selectBatReady(state)) && !state.endingStarted,
  );
  const position = (
    puzzleOpen ? ABOVE_PUZZLE_CLASS : calloutShown ? ABOVE_CALLOUT_CLASS : POSITION_CLASS
  )[pointerKind];
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const rechecked = useMemoryRoomStore((state) => state.rechecked);
  const activePuzzle = useMemoryRoomStore((state) => state.activePuzzle);
  const inventory = useMemoryRoomStore((state) => state.inventory);
  const [visible, setVisible] = useState(false);

  let text = "";
  if (remark?.id === "seen") {
    const visit = remark.memoryId
      ? lastVisitDone({ collected, revisited, rechecked }, remark.memoryId)
      : undefined;
    if (remark.memoryId && visit) {
      text = tRoom(`lore.${remark.memoryId}.phase${visit}` as ParseKeys<"memoryRoom">);
    }
  } else if (remark?.id === "needs-item") {
    // 떠 있는 판이 무엇을 기다리는지. 판을 내려놓으면 줄도 같이 물러난다
    const needs = activePuzzle ? getMinigame(activePuzzle)?.needsItem : undefined;
    if (needs && !(inventory as readonly string[]).includes(needs.id)) text = t(needs.hintKey);
  } else if (remark) {
    text = t(REMARK_TEXT[remark.id]);
  }
  const showMs = Math.max(SHOW_MS, Array.from(text).length * SHOW_PER_CHAR_MS);
  // 길이는 ref로 읽는다. 의존성에 넣으면 언어를 바꾸거나 진행이 바뀌어 글이 달라질 때
  // 이미 사라진 줄이 다시 떠올랐다
  const showMsRef = useRef(showMs);
  showMsRef.current = showMs;

  useEffect(() => {
    if (remark === null) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), showMsRef.current);
    return () => window.clearTimeout(timer);
  }, [remark]);

  if (!visible || remark === null || text === "") return null;

  return (
    <p
      // 누를 때마다 새로 떠오른다. key가 바뀌어야 애니메이션이 다시 돈다
      key={remark.at}
      className={`monologue-text pointer-events-none absolute ${position} left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-ivory`}
    >
      {text}
    </p>
  );
}
