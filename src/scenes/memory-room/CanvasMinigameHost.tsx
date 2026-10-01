"use client";

import { Suspense } from "react";
import { playSound } from "@/lib/audio";
import { liveMinigameOf, selectCanvasPuzzle } from "@/minigames/active";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";

/**
 * canvas 모드 미니게임 호스트: 씬의 Canvas 안에서 판을 세운다.
 *
 * overlay 호스트(src/components/ui/minigame/MinigameHost.tsx)의 짝이다. 그쪽은 DOM 층에 판을
 * 띄우고 시작 카드·결과 카드·닫기를 맡는다. 여기는 3D 물건 자체가 판이라 카드가
 * 없다: 결과는 곧장 스토어로 간다 (물건을 집는 데 "계속" 버튼은 없다). 조작 안내와
 * 닫기 버튼은 DOM이어야 해서 overlay 호스트가 canvas 판에도 그 둘만 얹는다.
 *
 * 세계 좌표에 자기 자리를 아는 것은 미니게임 쪽이다 (기억 자리 MEMORY_PLACEMENTS).
 * 판이 도는 동안 그 기억의 평소 모습은 숨는다 (selectCanvasMinigameMemory).
 *
 * 두 갈래가 들어온다: 기억 인터랙션(냉장고 앰플)과 미궁 문제(거실 피아노). 둘은
 * 스토어에서 사는 자리가 달라(activeInteraction / activePuzzle) 완료도 각자의
 * 액션으로 간다. 판을 세우는 방식만 같다.
 */
export function CanvasMinigameHost() {
  return (
    <>
      <CanvasInteraction />
      <CanvasPuzzle />
    </>
  );
}

/** 기억 인터랙션의 canvas 판. */
function CanvasInteraction() {
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const live = liveMinigameOf(active);
  if (live?.definition.mode !== "canvas") return null;

  const Minigame = live.definition.component;
  return (
    <Suspense fallback={null}>
      <Minigame
        // 같은 물건을 다시 조사하면 새 판. 결과 대사 단계에서는 같은 인스턴스가 남는다
        key={`${live.memoryId}:${live.gamePhase}`}
        gamePhase={live.gamePhase}
        stage={live.stage}
        onComplete={finishMinigame}
      />
    </Suspense>
  );
}

/**
 * 미궁 문제의 canvas 판 (거실 피아노).
 *
 * 소리는 여기서 낸다: overlay 쪽 PuzzleHost가 하던 몫이다. 풀리면 곧장 닫지 않고
 * settlePuzzle로 알린다. 결과 카드는 DOM이라 PuzzleHost가 세운다.
 * 손에 든 것(carrying)은 문제 화면이 "저쪽에서 가져온 것"을 보고 달라지는 데 쓴다.
 */
function CanvasPuzzle() {
  const puzzle = useMemoryRoomStore(selectCanvasPuzzle);
  const finishPuzzle = useMemoryRoomStore((state) => state.finishPuzzle);
  const settlePuzzle = useMemoryRoomStore((state) => state.settlePuzzle);
  const blockPuzzle = useMemoryRoomStore((state) => state.blockPuzzle);
  const carrying = useMemoryRoomStore((state) => state.inventory);
  if (!puzzle) return null;

  const Minigame = puzzle.component;
  return (
    <Suspense fallback={null}>
      <Minigame
        key={puzzle.id}
        gamePhase={2}
        carrying={carrying}
        onBlocked={blockPuzzle}
        onComplete={(result) => {
          playSound(result.cleared ? "success" : "fail");
          if (result.cleared) settlePuzzle();
          else finishPuzzle(result);
        }}
      />
    </Suspense>
  );
}
