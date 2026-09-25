"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type RemarkId, useMemoryRoomStore } from "@/store/memory-room";
import type { CommonTextKey } from "@/types/minigame";

/** 한 줄이 떠 있는 시간(ms). 읽고 한 박자 쉴 만큼: 대사창이 아니라 스치는 혼잣말이다. */
const SHOW_MS = 3200;

/** 혼잣말 id → 본문 키 (common.json). 방문의 두 줄은 예전 자리(door.*)에 그대로 있다. */
const REMARK_TEXT: Record<RemarkId, CommonTextKey> = {
  "door-stay": "door.nudgeStay",
  "door-ready": "door.nudgeBat",
  "computer-off": "remark.computerOff",
  toothbrush: "remark.toothbrush",
  "sink-locked": "remark.sinkLocked",
  "sink-open": "remark.sinkOpen",
  "piano-done": "remark.pianoDone",
  "parents-locked": "remark.parentsLocked",
};

/**
 * 물건을 눌렀을 때 흐르는 한 줄 (docs/content-design.md 3-1).
 *
 * 조사도 기록도 아닌 자리의 혼잣말이다: 1페이즈의 닫힌 방문("나가 봐야 뭐 해."),
 * 꺼진 컴퓨터, 화장실 칫솔컵(쉼표 비트), 아빠 힌트를 보기 전의 하부장 (v4 설계서 3-2 · 3-5).
 * 방문의 줄은 잠긴 게 아니라 **안 여는** 것이라는 걸 말한다.
 */
export function RemarkLine() {
  const { t } = useTranslation();
  const remark = useMemoryRoomStore((state) => state.remark);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (remark === null) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [remark]);

  if (!visible || remark === null) return null;

  return (
    <p
      // 누를 때마다 새로 떠오른다. key가 바뀌어야 애니메이션이 다시 돈다
      key={remark.at}
      className="monologue-text pointer-events-none absolute bottom-20 left-1/2 z-10 w-full max-w-xl -translate-x-1/2 animate-fade-rise break-ko text-pretty px-4 text-center font-pixel text-lg leading-normal text-ivory"
    >
      {t(REMARK_TEXT[remark.id])}
    </p>
  );
}
