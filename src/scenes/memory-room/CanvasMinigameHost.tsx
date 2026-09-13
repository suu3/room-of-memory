"use client";

import { Suspense } from "react";
import { liveMinigameOf } from "@/minigames/active";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";

/**
 * canvas 모드 미니게임 호스트: 씬의 Canvas 안에서 판을 세운다.
 *
 * overlay 호스트(src/components/ui/MinigameHost.tsx)의 짝이다. 그쪽은 DOM 층에 판을
 * 띄우고 시작 카드·결과 카드·닫기를 맡는다. 여기는 3D 물건 자체가 판이라 카드가
 * 없다: 결과는 곧장 스토어로 간다 (물건을 집는 데 "계속" 버튼은 없다). 조작 안내와
 * 닫기 버튼은 DOM이어야 해서 overlay 호스트가 canvas 판에도 그 둘만 얹는다.
 *
 * 세계 좌표에 자기 자리를 아는 것은 미니게임 쪽이다 (기억 자리 MEMORY_PLACEMENTS).
 * 판이 도는 동안 그 기억의 평소 모습은 숨는다 (selectCanvasMinigameMemory).
 */
export function CanvasMinigameHost() {
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  const live = liveMinigameOf(active);
  if (live?.definition.mode !== "canvas") return null;

  const Minigame = live.definition.component;
  return (
    <Suspense fallback={null}>
      <Minigame
        // 같은 물건을 다시 조사하면 새 판. 결과 대사 단계에서는 같은 인스턴스가 남는다
        key={`${live.memoryId}:${live.gamePhase}`}
        gamePhase={live.gamePhase}
        difficulty={difficulty}
        stage={live.stage}
        onComplete={finishMinigame}
      />
    </Suspense>
  );
}
