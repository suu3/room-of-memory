"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SCRIPTS } from "@/data/memory-room";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { FrequencyTuneMinigame } from "../frequency-tune";
import { useOnceCompleter } from "../shell";

/**
 * 라디오 1차의 결과 대사. 이 판은 그 앞의 방송 줄을 라디오 화면에 흘리고, 대사창에는
 * 도해의 마지막 한 줄만 남긴다 (MinigameResult.shownResultLines).
 * content/memories.yaml의 radio.phase1.resultScript와 같아야 한다 (index.test가 지킨다).
 */
export const BROADCAST_SCRIPT = "radio-broadcast";

/** 방송 한 줄이 다음 줄로 넘어가는 간격(ms). 손을 대지 않아도 방송은 흐른다. */
const LINE_MS = 4200;
/** 마지막 줄이 선 뒤 판이 끝나기까지(ms). "…반복합니다."가 한 번 가라앉을 틈. */
const END_HOLD_MS = 2600;
/** 자막 상자에 남기는 방송 줄 수. 지난 줄은 하나만 옅게 남는다. */
const VISIBLE_LINES = 2;

/** 도해의 속말. 방송 앞 절반에 첫 줄, 뒤 절반에 둘째 줄이 서로 스며들듯 바뀐다. */
const WHISPER_KEYS = [
  "minigame.emergencyBroadcast.whisper0",
  "minigame.emergencyBroadcast.whisper1",
] as const;
/**
 * 재난 방송: 주파수가 잡힌 라디오에서 그날의 방송이 흐르고, 그 밑으로 도해의 속말이
 * 하나씩 떠올랐다 가라앉는다 ("…듣고 싶지 않아." → "그만해…").
 *
 * 조작은 없다. 전원·볼륨 버튼을 두고 "꺼도 안 꺼지는" 연출을 했었으나 뺐다 (2026-09-29).
 * 방송은 제 속도로 흘러 15초 남짓이면 끝나므로 스킵도 없다.
 *
 * 스토어를 만지지 않는다. 결과는 onComplete 한 번뿐이다 (.claude/rules/minigames.md).
 */
export function BroadcastBoard({
  onComplete,
  onSettled,
  stage = "play",
}: Pick<MinigameProps, "onComplete" | "onSettled" | "stage">) {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const complete = useOnceCompleter(onComplete);
  const frozen = stage === "result";

  // 결과 대사 중 대사창이 맡는 마지막 줄(도해)은 빼고, 방송 줄만 화면에 흘린다
  const script = SCRIPTS[BROADCAST_SCRIPT];
  const lines = (script?.lines ?? []).filter((line) => line.speaker === "broadcast");
  const total = lines.length;

  const [shown, setShown] = useState(frozen ? total : Math.min(1, total));
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const done = shown >= total;

  // 방송이 잡히는 순간의 지직
  useEffect(() => {
    if (!frozen) playSound("radioStatic");
  }, [frozen]);

  // 방송은 손과 상관없이 제 속도로 흐른다
  // biome-ignore lint/correctness/useExhaustiveDependencies: shown은 본문에서 읽지 않고, 줄이 바뀔 때 시계를 다시 재는 신호로만 쓴다.
  useEffect(() => {
    if (frozen || done) return;
    const timer = setTimeout(() => setShown((value) => Math.min(total, value + 1)), LINE_MS);
    return () => clearTimeout(timer);
  }, [frozen, done, total, shown]);

  // 마지막 줄이 서면: 결과가 확정됐다. 한 번 가라앉힌 뒤 대사창(도해의 한 줄)으로 넘긴다
  useEffect(() => {
    if (frozen || !done) return;
    onSettledRef.current?.();
    const timer = setTimeout(
      () => complete({ cleared: true, shownResultLines: total }),
      END_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [frozen, done, complete, total]);

  const latest = shown - 1;
  // 방송이 절반을 넘으면 둘째 속말로. 방송이 끝나면 속말도 걷힌다
  const whisperIndex = done ? -1 : shown * 2 > total ? 1 : 0;

  return (
    <div
      className={`flex w-[min(40rem,94vw)] flex-col items-center gap-5 ${frozen ? "" : "pt-14"}`}
      aria-hidden={frozen || undefined}
    >
      {/* 라디오: 주파수가 잡힌 채 멈춘 그림 */}
      <div className="w-full">
        <FrequencyTuneMinigame onComplete={() => {}} stage="result" />
      </div>

      {/* 방송: 최신 줄이 밝고, 지난 줄은 옅게 남는다. 스크린리더에는 새 줄이 읽힌다 */}
      <div
        aria-live="polite"
        className="flex min-h-32 w-full flex-col gap-2 rounded-lg border border-line bg-scene-void/70 px-5 py-4"
      >
        <p className="font-pixel text-[0.7rem] tracking-[0.25em] text-ember/80">
          {tRoom("characters.broadcast.name" as never)}
        </p>
        {/* 최근 두 줄만: 줄이 쌓여 상자가 자라면 속말이 폰 화면 아래로 밀린다 */}
        {lines.slice(Math.max(0, shown - VISIBLE_LINES), shown).map((line) => (
          <p
            key={line.textKey}
            className={`animate-fade-rise break-ko text-pretty leading-relaxed ${
              line === lines[latest] ? "text-paper" : "text-bone/45"
            }`}
          >
            {tRoom(line.textKey as never)}
          </p>
        ))}
      </div>

      {/*
        도해의 속말. 두 줄을 한자리에 겹쳐 두고 불투명도만 넘긴다: 앞 줄이 가라앉는 사이
        다음 줄이 떠오른다. 자리를 미리 잡아 두어 판이 출렁이지 않는다
      */}
      {!frozen && (
        <div className="grid min-h-6 w-full animate-fade-rise">
          {WHISPER_KEYS.map((key, index) => (
            <p
              key={key}
              aria-hidden={index !== whisperIndex || undefined}
              className={`col-start-1 row-start-1 break-ko text-center text-bone/70 transition-opacity duration-1000 ${
                index === whisperIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              {t(key)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 1바퀴 라디오 인터랙션 전체: 주파수 잡기(frequency-tune) 뒤에 재난 방송이 이어지는
 * 2단계 미니게임이다. 시나리오 스키마는 기억 하나에 미니게임 하나라, 단계 연결은
 * 엔진이 아니라 이 래퍼가 든다. 결과 보고는 여기서 한 번만 나간다.
 *
 * 주파수 단계 실패는 전체 실패로 올린다(재도전 가능). 주파수 단계의 스킵은 그 단계만
 * 건너뛴다. 방송은 접근성 장치로도 건너뛰지 않는다: 이야기의 반전이고, 가만히 있어도 흐른다.
 */
export function EmergencyBroadcastMinigame({
  onComplete,
  gamePhase = 1,
  difficulty = "easy",
  stage = "play",
  onSettled,
}: MinigameProps) {
  const complete = useOnceCompleter(onComplete);
  const [step, setStep] = useState<"tune" | "broadcast">("tune");

  // 결과 대사 단계는 늘 방송까지 끝난 뒤다. 다 흐른 방송을 배경으로 남긴다.
  if (stage === "result") {
    return <BroadcastBoard onComplete={complete} stage="result" />;
  }

  if (step === "tune") {
    return (
      <FrequencyTuneMinigame
        gamePhase={gamePhase}
        difficulty={difficulty}
        onComplete={(result) => {
          if (!result.cleared) {
            complete(result);
            return;
          }
          // 주파수가 잡혔다. 방송이 들어온다.
          playSound("radioLock");
          setStep("broadcast");
        }}
      />
    );
  }

  return <BroadcastBoard onComplete={complete} onSettled={onSettled} />;
}
