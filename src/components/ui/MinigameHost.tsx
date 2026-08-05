"use client";

import { X } from "@phosphor-icons/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { phaseConfigOf } from "@/data/memory-room";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { getMinigame } from "@/minigames";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";
import { SuccessBurst } from "./SuccessBurst";

/**
 * overlay 모드 미니게임 호스트. canvas 모드는 3D 씬 도입 전까지 스킵 처리(진행이
 * 막히지 않게), 씬 도입 시 씬 쪽 호스트가 담당.
 * 미등록 id는 스킵(cleared: true) 처리해 진행이 막히지 않게 한다.
 * 게임은 시작 카드에서 시작 버튼을 눌러야 마운트된다 — 타이머·라운드가
 * 조작법을 읽기 전에 돌지 않도록.
 */
export function MinigameHost() {
  const { t } = useTranslation();
  const hint = useControlHint();
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const cancelMinigame = useMemoryRoomStore((state) => state.cancelMinigame);
  /** 시작 버튼을 누른 인터랙션 키 — 인터랙션이 바뀌면 자연히 시작 카드로 돌아간다. */
  const [startedKey, setStartedKey] = useState<string | null>(null);
  /**
   * 결과가 확정돼 더는 취소할 수 없는 인터랙션 키.
   * 미니게임이 onSettled로 알린다 (src/types/minigame.ts).
   */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  /** 성공 파티클 리트리거 키 — 모달이 닫힌 뒤에도 버스트는 끝까지 재생된다. */
  const [burstId, setBurstId] = useState(0);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  /** 결과 대사 단계 — 미니게임 화면은 남기고 대사창이 그 위에 뜬다. */
  const resultStage = active?.phase === "dialogue" && active.keepMinigame === true;
  const minigameId =
    active?.phase === "minigame" || resultStage
      ? phaseConfigOf(active.memoryId, active.gamePhase)?.interaction?.minigameId
      : undefined;
  const definition = minigameId ? getMinigame(minigameId) : undefined;
  const hosted = definition?.mode === "overlay" ? definition : undefined;
  /** 탐색형 오브젝트 — 시작 카드도 패널도 없이 물건만 떠오른다. */
  const bare = hosted?.presentation === "bare";

  useEffect(() => {
    if (active?.phase === "minigame" && !hosted) {
      finishMinigame({ cleared: true });
    }
  }, [active, hosted, finishMinigame]);

  const activeKey = active ? `${active.memoryId}:${active.gamePhase}` : null;
  // bare는 "시작"을 거치지 않는다 — 물건을 집었으면 이미 들여다보는 중이다.
  const started = bare || (startedKey !== null && startedKey === activeKey);
  /**
   * 승부가 난 뒤부터 결과 대사가 끝날 때까지는 닫을 수 없다.
   * 이 구간에서 닫히면 다 이긴 판이 수집도 안 된 채 사라진다.
   */
  const sealed = resultStage || (settledKey !== null && settledKey === activeKey);

  // 시작 카드가 뜨면 버튼에 포커스 (키보드 플레이)
  useEffect(() => {
    if (hosted && !bare && !started) startButtonRef.current?.focus();
  }, [hosted, bare, started]);

  // Esc = 바깥 클릭과 같은 닫기 (키보드 접근성). 승부가 난 뒤에는 닫기를 막는다
  useEffect(() => {
    if (!hosted || sealed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") cancelMinigame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hosted, sealed, cancelMinigame]);

  const Minigame = hosted?.component;
  return (
    <>
      {burstId > 0 && <SuccessBurst key={burstId} onDone={() => setBurstId(0)} />}
      {(active?.phase === "minigame" || resultStage) && hosted && Minigame && (
        /*
         * 바깥(백드롭) 클릭 시 완료 처리 없이 닫는다 — 핫스팟은 다시 클릭 가능.
         * 결과 대사 중에는 화면을 더 어둡게 깔고, 아래쪽을 대사창 자리로 비워둔다.
         *
         * 단, 게임이 **시작된 뒤에는** 백드롭으로 닫히지 않는다. 손가락으로 하는
         * 게임(닦기·다이얼)은 획이 판 밖에서 시작되는 일이 잦은데, 그때마다 판이
         * 통째로 닫혀 버렸다. 대신 오른쪽 위 닫기 버튼이 늘 떠 있어 나갈 길은 남는다.
         */
        <div
          className={`absolute inset-0 z-40 grid place-items-center ${
            // 탐색형은 방을 덜 가린다 — 물건을 든 채로도 방이 보여야 "그 방 안"이다.
            bare ? "bg-scene-void/55 backdrop-blur-[2px]" : "backdrop-blur-sm"
          } ${resultStage ? "bg-scene-void/75 pb-56" : bare ? "" : "bg-scene-void/40"}`}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || sealed || started) return;
            cancelMinigame();
          }}
        >
          {/*
            닫기. 백드롭이 잠긴 동안 유일하게 남는 출구라 늘 보인다 — 스킵(건너뛰기)은
            일정 시간이 지나야 뜨고 의미도 다르다(스킵은 수집으로 친다, 닫기는 아니다).
          */}
          {started && !sealed && (
            <button
              type="button"
              aria-label={t("minigame.close")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                playSound("close");
                cancelMinigame();
              }}
              className="absolute right-4 top-4 z-10 grid size-11 cursor-pointer place-items-center rounded-full border border-bone/40 bg-scene-void/70 text-xl font-bold leading-none text-bone backdrop-blur-sm transition-all hover:border-bone hover:text-paper active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              <X size={20} weight="bold" />
            </button>
          )}
          {started ? (
            <Suspense fallback={null}>
              <Minigame
                gamePhase={active.gamePhase}
                onSettled={() => setSettledKey(activeKey)}
                onComplete={(result) => {
                  playSound(result.cleared ? "success" : "fail");
                  if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
                  finishMinigame(result);
                }}
              />
            </Suspense>
          ) : (
            <div className="w-[38rem] max-w-[94vw] animate-fade-rise rounded-xl border border-bone bg-paper p-8 text-center shadow-panel">
              <h2 className="break-ko text-2xl font-bold tracking-tight text-ink">
                {t(hosted.titleKey)}
              </h2>
              <p className="mt-3 break-ko text-pretty text-base leading-relaxed text-ink/70">
                {hint(hosted.helpKey)}
              </p>
              <button
                ref={startButtonRef}
                type="button"
                onClick={() => {
                  playSound("select");
                  setStartedKey(activeKey);
                }}
                className="mt-7 cursor-pointer rounded-full bg-ink px-10 py-2.5 text-base font-bold tracking-widest text-paper transition-all hover:bg-ink/85 active:translate-y-px active:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
              >
                {t("minigame.start")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
