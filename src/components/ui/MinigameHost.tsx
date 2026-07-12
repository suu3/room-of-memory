"use client";

import { Suspense, useEffect } from "react";
import { phaseConfigOf } from "@/data/memory-room";
import { getMinigame } from "@/minigames";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";

/**
 * overlay 모드 미니게임 호스트. canvas 모드는 3D 씬 도입 전까지 스킵 처리(진행이
 * 막히지 않게), 씬 도입 시 씬 쪽 호스트가 담당.
 * 미등록 id는 스킵(cleared: true) 처리해 진행이 막히지 않게 한다.
 */
export function MinigameHost() {
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);

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

  if (active?.phase !== "minigame" || !hosted) return null;

  const Minigame = hosted.component;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-scene-void/70 backdrop-blur-sm">
      <Suspense fallback={null}>
        <Minigame onComplete={finishMinigame} />
      </Suspense>
    </div>
  );
}
