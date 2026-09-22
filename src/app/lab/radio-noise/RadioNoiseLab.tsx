"use client";

import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "@/lib/audio";
import { filmLookInput } from "@/lib/effects/film-look-input";
import { FrequencyTuneMinigame } from "@/minigames/frequency-tune";
import type { MinigameResult } from "@/types/minigame";
import { LabFrame } from "../LabFrame";

const button =
  "rounded-sm border border-fog/30 px-3 py-1.5 text-sm hover:border-memory focus-visible:outline-memory";

/**
 * 라디오 잡음 실험 (docs/visual-experiments.md 4장 라디오 행).
 *
 * 여기에는 3D 캔버스가 없어 필름 룩(색수차·그레인) 자체는 안 보인다. 대신 미니게임이
 * 채널(`filmLookInput.static`)에 써넣는 값을 그대로 읽어 보여 준다: 바늘이 대역에
 * 가까워질수록 0으로 떨어져야 한다. 표시창의 파형은 미니게임 안에 있으니 그대로 보인다.
 *
 * LabFrame의 세 조작 중 gamePhase만 물려 있다. 강도는 슬라이더가 아니라 튜닝 거리
 * (`staticLevel`)에서 오고, `enabled`는 `useEffectEnabled` 한 곳이 OS 모션 설정으로
 * 정한다 (9장). 미니게임 계약상 그 게이트를 밖에서 뒤집는 prop을 두지 않는다.
 */
export function RadioNoiseLab() {
  return (
    <LabFrame
      title="라디오 잡음 · 필름 룩 채널과 표시창 파형"
      note="바늘이 대역에서 멀수록 filmLookInput.static이 오르고 표시창 파형이 거칠어진다. 맞추면 멈춘 화면에서 파형이 memory 색으로 바뀐다. intensity 슬라이더와 enabled 토글은 이 실험에 물려 있지 않다 (강도는 튜닝 거리, 게이트는 OS 모션 설정)."
    >
      {({ gamePhase }) => <RadioNoiseDemo key={gamePhase} gamePhase={gamePhase} />}
    </LabFrame>
  );
}

function RadioNoiseDemo({ gamePhase }: { gamePhase: 1 | 2 }) {
  /** 판을 새로 시작할 때 key로 미니게임을 다시 마운트한다. */
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<"play" | "result">("play");
  const [last, setLast] = useState<MinigameResult | null>(null);
  const readoutRef = useRef<HTMLOutputElement>(null);

  // 첫 제스처에서 AudioContext를 깨운다. 본편에서는 useAudioRuntime이 하는 일이다.
  useEffect(() => {
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // 채널 값은 매 프레임 바뀐다. 상태로 올리면 프레임마다 리렌더라 textContent만 민다.
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      if (readoutRef.current) readoutRef.current.textContent = filmLookInput.static.toFixed(3);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm text-fog">
        <span className="flex items-baseline gap-2">
          filmLookInput.static
          <output ref={readoutRef} className="font-mono text-base tabular-nums text-memory">
            0.000
          </output>
        </span>
        <span>{stage === "result" ? "결과 단계 (멈춘 화면)" : "플레이"}</span>
        {last && (
          <span>
            마지막 결과: {last.cleared ? "clear" : "fail"} · score {last.score ?? 0}
          </span>
        )}
        <button
          type="button"
          className={button}
          onClick={() => {
            setStage("play");
            setRound((value) => value + 1);
          }}
        >
          다시
        </button>
      </div>
      <div className="relative min-h-[60svh]">
        <FrequencyTuneMinigame
          key={round}
          gamePhase={gamePhase}
          stage={stage}
          onComplete={(result) => {
            console.info("[lab/radio-noise] onComplete", result);
            setLast(result);
            // 본편에서 결과 대사가 뜨는 단계. 멈춘 화면의 파형(memory 색)을 보기 위해 넘긴다.
            setStage("result");
          }}
        />
      </div>
    </div>
  );
}
