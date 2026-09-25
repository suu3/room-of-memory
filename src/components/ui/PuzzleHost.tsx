"use client";

import { ArrowUUpLeft, X } from "@phosphor-icons/react";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { getMinigame } from "@/minigames";
import { MinigameHelp } from "@/minigames/shell";
import { useMemoryRoomStore } from "@/store/memory-room";
import { SuccessBurst } from "./SuccessBurst";
import { BUTTON_QUIET, HUD_ICON_BUTTON_SOLID } from "./ui-classes";

/**
 * 미궁 문제 호스트: 기억 인터랙션 밖에서 도는 미니게임 (거실의 식탁 트럼프,
 * 현관 잠금장치, 거실 피아노).
 *
 * MinigameHost와 닮았지만 더 단순하다: 시작 카드가 없고(미궁은 규칙 설명이
 * 없는 게 규칙이라 카드에 적을 것도 없다. 그림을 바로 들이민다), 결과 대사
 * 단계도 없다(대사가 안 딸린다). 풀리면 solvedPuzzles에 남고 그걸로 끝이다.
 *
 * canvas 모드 문제(피아노)는 씬이 판을 세운다. 여기서는 DOM이어야 하는 두 가지,
 * 조작 안내 한 줄과 돌아가기만 그 위에 얹는다 (MinigameHost가 앰플에 하는 것과 같다).
 */
export function PuzzleHost() {
  const { t } = useTranslation();
  const hint = useControlHint();
  const active = useMemoryRoomStore((state) => state.activePuzzle);
  const finishPuzzle = useMemoryRoomStore((state) => state.finishPuzzle);
  const closePuzzle = useMemoryRoomStore((state) => state.closePuzzle);
  // 손에 든 것. 문제 화면이 "저쪽에서 가져온 것"을 보고 달라진다 (MinigameProps의 carrying)
  const carrying = useMemoryRoomStore((state) => state.inventory);
  /** 결과가 확정돼 더는 닫을 수 없는 문제 id (onSettled: src/types/minigame.ts). */
  const [settledId, setSettledId] = useState<string | null>(null);
  const [burstId, setBurstId] = useState(0);

  const definition = active ? getMinigame(active) : undefined;
  const hosted = definition?.mode === "overlay" ? definition : undefined;
  /** 씬 안에서 도는 판: 여기서는 안내와 닫기만 맡는다. */
  const canvasHosted = definition?.mode === "canvas" ? definition : undefined;
  const sealed = settledId !== null && settledId === active;

  // 미등록 id로는 판을 세울 수 없다. 조용히 닫아서 진행이 막히지 않게 한다
  useEffect(() => {
    if (active && !hosted && !canvasHosted) closePuzzle();
  }, [active, hosted, canvasHosted, closePuzzle]);

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
      {/*
        canvas 판(거실 피아노): 판은 씬이 그리고 있다. 백드롭도 틀도 없이 조작 안내
        한 줄과 닫기만 띄운다. 안내 자리는 근접 안내(RoomInteractionPrompt)와 같다.
      */}
      {canvasHosted && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2">
          <div
            role="status"
            className="rounded-sm border border-line bg-surface px-3 py-1.5 text-center text-xs font-medium text-ivory shadow-chip"
          >
            <MinigameHelp help={hint(canvasHosted.helpKey)} className="break-ko text-pretty" />
          </div>
          {/*
            돌아가기. 오른쪽 위 구석에 두면 HUD(z-30, 메뉴·평면도)에 깔려 눌리지 않았다.
            안내 바로 밑에 글자로 세운다: 답이 확정된 뒤에는 물러난다 (Esc와 같은 규칙).
          */}
          {!sealed && (
            <button
              type="button"
              onClick={() => {
                playSound("close");
                closePuzzle();
              }}
              className={`${BUTTON_QUIET} pointer-events-auto px-4 py-2`}
            >
              <ArrowUUpLeft size={16} weight="bold" />
              {t("minigame.back")}
            </button>
          )}
        </div>
      )}
      {active && hosted && Minigame && (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-scene-void/40 backdrop-blur-sm"
          onPointerDown={(event) => {
            // 입력칸이 있는 문제라 판이 서면 백드롭으로는 안 닫힌다. 닫기 버튼만 남는다
            if (event.target !== event.currentTarget || sealed) return;
            closePuzzle();
          }}
        >
          {/* 닫기는 프레임 우측 상단 모서리에: 화면 구석에 두면 틀과 떨어져 떠 있는다 */}
          <div className="relative">
            {!sealed && (
              <button
                type="button"
                aria-label={t("minigame.close")}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  playSound("close");
                  closePuzzle();
                }}
                className={`absolute right-3 top-3 z-10 ${HUD_ICON_BUTTON_SOLID}`}
              >
                <X size={20} weight="bold" />
              </button>
            )}
            <Suspense fallback={null}>
              <Minigame
                gamePhase={2}
                carrying={carrying}
                onSettled={() => setSettledId(active)}
                onComplete={(result) => {
                  playSound(result.cleared ? "success" : "fail");
                  if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
                  finishPuzzle(result);
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
