"use client";

import { X } from "@phosphor-icons/react";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { getMinigame } from "@/minigames";
import { useMemoryRoomStore } from "@/store/memory-room";
import { SuccessBurst } from "./SuccessBurst";

/**
 * 미궁 문제 호스트 — 기억 인터랙션 밖에서 도는 미니게임 (거실의 식탁 트럼프,
 * 현관 잠금장치).
 *
 * MinigameHost와 닮았지만 더 단순하다: 시작 카드가 없고(미궁은 규칙 설명이
 * 없는 게 규칙이라 카드에 적을 것도 없다 — 그림을 바로 들이민다), 결과 대사
 * 단계도 없다(대사가 안 딸린다). 풀리면 solvedPuzzles에 남고 그걸로 끝이다.
 */
export function PuzzleHost() {
  const { t } = useTranslation();
  const active = useMemoryRoomStore((state) => state.activePuzzle);
  const finishPuzzle = useMemoryRoomStore((state) => state.finishPuzzle);
  const closePuzzle = useMemoryRoomStore((state) => state.closePuzzle);
  /** 결과가 확정돼 더는 닫을 수 없는 문제 id (onSettled — src/types/minigame.ts). */
  const [settledId, setSettledId] = useState<string | null>(null);
  const [burstId, setBurstId] = useState(0);

  const definition = active ? getMinigame(active) : undefined;
  const hosted = definition?.mode === "overlay" ? definition : undefined;
  const sealed = settledId !== null && settledId === active;

  // 미등록 id로는 판을 세울 수 없다 — 조용히 닫아서 진행이 막히지 않게 한다
  useEffect(() => {
    if (active && !hosted) closePuzzle();
  }, [active, hosted, closePuzzle]);

  useEffect(() => {
    if (active === null) setSettledId(null);
  }, [active]);

  // Esc = 내려놓기. 답이 확정된 뒤에는 막는다 (MinigameHost와 같은 규칙)
  useEffect(() => {
    if (!active || sealed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") closePuzzle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, sealed, closePuzzle]);

  const Minigame = hosted?.component;
  return (
    <>
      {burstId > 0 && <SuccessBurst key={burstId} onDone={() => setBurstId(0)} />}
      {active && hosted && Minigame && (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-scene-void/40 backdrop-blur-sm"
          onPointerDown={(event) => {
            // 입력칸이 있는 문제라 판이 서면 백드롭으로는 안 닫힌다 — 닫기 버튼만 남는다
            if (event.target !== event.currentTarget || sealed) return;
            closePuzzle();
          }}
        >
          {!sealed && (
            <button
              type="button"
              aria-label={t("minigame.close")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                playSound("close");
                closePuzzle();
              }}
              className="absolute right-4 top-4 z-10 grid size-11 cursor-pointer place-items-center rounded-full border border-bone/40 bg-scene-void/70 text-xl font-bold leading-none text-bone backdrop-blur-sm transition-all hover:border-bone hover:text-paper active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              <X size={20} weight="bold" />
            </button>
          )}
          <Suspense fallback={null}>
            <Minigame
              gamePhase={2}
              onSettled={() => setSettledId(active)}
              onComplete={(result) => {
                playSound(result.cleared ? "success" : "fail");
                if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
                finishPuzzle(result);
              }}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
