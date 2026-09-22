"use client";

import { useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { MEMORY_GOAL } from "@/data/memory-room";
import { ASSETS } from "@/lib/assets";
import { FighterDuelMinigame } from "@/minigames/fighter-duel";
import { Fighter } from "@/minigames/fighter-duel/Fighter";
import { PixelStage } from "@/minigames/fighter-duel/PixelStage";
import { MAX_PIXEL_BLOCK, pixelBlock, stageScale } from "@/minigames/fighter-duel/pixel-block";
import { useMemoryRoomStore } from "@/store/memory-room";
import type { MinigameResult } from "@/types/minigame";

/**
 * 게임기 픽셀화의 단독 데모 (docs/visual-experiments.md 4장 "게임기" · 10장 12번).
 *
 * 위쪽 표본 무대는 `intensity`가 곧 진행도다: 블록 1(0)에서 4(1)까지 같은 격자 위에
 * 스프라이트·색 블록·글자가 뭉개진다. 아래쪽은 실제 미니게임 그대로다. 본편의 블록은
 * 판이 열릴 때 스토어의 `collected.length`에서 한 번 정해지므로 슬라이더가 닿지 않고,
 * 실험실은 저장된 진행도에서 나올 값을 옆에 적어 준다. 2차는 대사만이라 화면이 없다(4장):
 * `gamePhase` 토글은 여기서 아무것도 바꾸지 않는다. `enabled`를 끄면 블록 1로 떨어지고
 * PRESS START는 깜빡이지 않는 글자로 남는다.
 */
export function ConsolePixelsLab() {
  const [round, setRound] = useState(0);
  const [last, setLast] = useState<MinigameResult | null>(null);
  const collectedCount = useMemoryRoomStore((state) => state.collected.length);

  return (
    <LabFrame
      title="게임기 · 픽셀 블록과 PRESS START"
      note="표본 무대는 intensity로 블록 1~4를 훑는다(0 처음 본 화면, 1 라디오 직전). 아래 실제 판은 저장된 진행도로 블록을 정하고, 2P 슬롯에 PRESS START가 1Hz로 깜빡인다. 2차 토글은 자리가 없어 변화 없음."
    >
      {({ intensity, enabled }) => {
        const block = enabled ? Math.round(1 + (MAX_PIXEL_BLOCK - 1) * intensity) : 1;
        return (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm text-fog">
                표본 무대 · block {block}px · 무대 해상도 ×{stageScale(block)}
              </h2>
              <div className="overflow-hidden rounded-md border-2 border-night bg-scene-abyss">
                <PixelStage
                  block={block}
                  className="relative h-64 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "linear-gradient(var(--color-scene-storm), var(--color-scene-abyss) 78%)",
                  }}
                >
                  <span className="absolute inset-x-0 bottom-0 h-6 bg-night/50" aria-hidden />
                  <span
                    className="duel-scanline pointer-events-none absolute inset-0 opacity-25"
                    aria-hidden
                  />
                  {/* 색 블록: 격자가 실제로 몇 px인지 가장자리에서 바로 읽힌다 */}
                  <div className="absolute left-6 top-6 flex items-end gap-3" aria-hidden>
                    <span className="size-12 rounded-full bg-memory" />
                    <span className="size-9 rotate-12 bg-bone" />
                    <span className="h-14 w-3 rounded-sm bg-ember" />
                    <span className="size-6 rounded-full border-2 border-ivory" />
                  </div>
                  <span
                    className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap font-pixel text-lg tracking-widest text-memory"
                    aria-hidden
                  >
                    3 HIT
                  </span>
                  {/* 본편과 같은 자리·같은 크기의 두 사람 (시트가 없으면 블록 캐릭터) */}
                  <div className="absolute bottom-6 left-[30%] -translate-x-1/2">
                    <Fighter
                      pose="strike"
                      tone="memory"
                      facing="right"
                      sprite={ASSETS.images.mgFighterDuelHero}
                      offsetY={12}
                    />
                  </div>
                  <div className="absolute bottom-6 left-[70%] -translate-x-1/2">
                    <Fighter
                      pose="guard"
                      tone="bone"
                      facing="left"
                      sprite={ASSETS.images.mgFighterDuelRival}
                    />
                  </div>
                </PixelStage>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm text-fog">
                <span>
                  실제 판 · 저장된 진행도 {collectedCount}/{MEMORY_GOAL} → block{" "}
                  {enabled ? pixelBlock(collectedCount, MEMORY_GOAL) : 1}px
                </span>
                {last && <span>마지막 결과: {last.cleared ? "clear" : "fail"}</span>}
                <button
                  type="button"
                  className="rounded-sm border border-fog/30 px-3 py-1.5 hover:border-memory focus-visible:outline-memory"
                  onClick={() => setRound((value) => value + 1)}
                >
                  다시
                </button>
              </div>
              <div className="flex justify-center">
                <FighterDuelMinigame
                  key={round}
                  onComplete={(result) => {
                    console.info("[lab/console-pixels] onComplete", result);
                    setLast(result);
                  }}
                />
              </div>
            </section>
          </div>
        );
      }}
    </LabFrame>
  );
}
