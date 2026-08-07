"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StageId } from "@/data/memory-room";
import { useTypewriter } from "@/lib/use-typewriter";

/** 단계가 바뀔 때 옛 줄이 물러나는 시간(ms). globals.css의 transition과 맞춘다. */
const SWAP_FADE_MS = 320;

/**
 * 화면 상단 혼잣말.
 *
 * 타자 연출을 살리려면 훅이 **보이는 시점에** 마운트되어야 한다. 부모(MemoryRoom)
 * 최상단에서 호출하면 타이틀 화면이 떠 있는 동안 보이지도 않는 채로 다 찍혀서,
 * 방에 들어왔을 땐 이미 완성된 문장만 남는다. 그래서 별도 컴포넌트로 떼어냈다.
 *
 * 단계(밝기)가 바뀌면 새 줄을 처음부터 다시 찍는다. 다만 **곧장 갈아치우지
 * 않는다** — 단계는 기억을 하나 완료하는 순간에 넘어가는데, 그때 줄이 통째로
 * 사라졌다 다시 찍히면 대사창이 닫히는 것과 겹쳐서 화면이 깜빡인 것처럼 보인다.
 * 옛 줄을 한 박자 물러나게 한 뒤에 새 줄을 들인다.
 */
export function Monologue({ stageId }: { stageId: StageId }) {
  const { t: tRoom } = useTranslation("memoryRoom");
  /** 지금 찍고 있는 단계. stageId가 바뀌어도 페이드가 끝난 뒤에 따라온다. */
  const [shown, setShown] = useState(stageId);
  const [leaving, setLeaving] = useState(false);
  const monologue = useTypewriter(tRoom(`stages.${shown}.monologue`));

  useEffect(() => {
    if (stageId === shown) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setShown(stageId);
      setLeaving(false);
    }, SWAP_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [stageId, shown]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-32 z-10 w-full max-w-2xl -translate-x-1/2 px-4 text-center md:top-16">
      {/* 좁은 화면에서는 한 줄이 안 나온다 — 글자를 줄이고, 넘칠 땐 어절 단위로 접는다 */}
      <p
        className={`animate-fade-rise break-ko text-pretty font-pixel text-xl text-fog transition-opacity duration-300 sm:text-2xl ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        「 {monologue} 」
      </p>
    </div>
  );
}
