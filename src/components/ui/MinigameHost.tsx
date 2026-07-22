"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { phaseConfigOf } from "@/data/memory-room";
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
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const cancelMinigame = useMemoryRoomStore((state) => state.cancelMinigame);
  /** 시작 버튼을 누른 인터랙션 키 — 인터랙션이 바뀌면 자연히 시작 카드로 돌아간다. */
  const [startedKey, setStartedKey] = useState<string | null>(null);
  /** 성공 파티클 리트리거 키 — 모달이 닫힌 뒤에도 버스트는 끝까지 재생된다. */
  const [burstId, setBurstId] = useState(0);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const minigameId =
    active?.phase === "minigame"
      ? phaseConfigOf(active.memoryId, active.gamePhase)?.interaction?.minigameId
      : undefined;
  const definition = minigameId ? getMinigame(minigameId) : undefined;
  const hosted = definition?.mode === "overlay" ? definition : undefined;

  useEffect(() => {
    if (active?.phase === "minigame" && !hosted) {
      finishMinigame({ cleared: true });
    }
  }, [active, hosted, finishMinigame]);

  const activeKey = active ? `${active.memoryId}:${active.gamePhase}` : null;
  const started = startedKey !== null && startedKey === activeKey;

  // 시작 카드가 뜨면 버튼에 포커스 (키보드 플레이)
  useEffect(() => {
    if (hosted && !started) startButtonRef.current?.focus();
  }, [hosted, started]);

  // Esc = 바깥 클릭과 같은 닫기 (키보드 접근성)
  useEffect(() => {
    if (!hosted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") cancelMinigame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hosted, cancelMinigame]);

  const Minigame = hosted?.component;
  return (
    <>
      {burstId > 0 && <SuccessBurst key={burstId} onDone={() => setBurstId(0)} />}
      {active?.phase === "minigame" && hosted && Minigame && (
        // 바깥(백드롭) 클릭 시 완료 처리 없이 닫는다 — 핫스팟은 다시 클릭 가능
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-scene-void/40 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) cancelMinigame();
          }}
        >
          {started ? (
            <Suspense fallback={null}>
              <Minigame
                onComplete={(result) => {
                  if (result.cleared) setBurstId((id) => id + 1);
                  finishMinigame(result);
                }}
              />
            </Suspense>
          ) : (
            <div className="w-[30rem] max-w-[94vw] rotate-1 animate-fade-rise rounded-lg border-2 border-bone bg-paper p-6 text-center shadow-panel">
              <h2 className="flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-ink">
                <span aria-hidden className="w-4 border-t-2 border-dashed border-ember" />
                {t(hosted.titleKey)}
                <span aria-hidden className="w-4 border-t-2 border-dashed border-ember" />
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-ink/70">{t(hosted.helpKey)}</p>
              <button
                ref={startButtonRef}
                type="button"
                onClick={() => setStartedKey(activeKey)}
                className="mt-4 cursor-pointer rounded-full border-2 border-ember bg-ember px-7 py-1.5 text-sm font-bold tracking-widest text-paper transition-colors hover:bg-ember/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
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
