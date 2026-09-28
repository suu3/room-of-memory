"use client";

import { Minus, Power } from "@phosphor-icons/react";
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
/** 전원을 끈 뒤 라디오가 스스로 다시 켜지기까지(ms). 확실히 꺼졌다가 켜져야 한다. */
const BLACKOUT_MS = 700;
/** 두 번째부터는 끝까지 안 돌고 되튕긴다. 화면은 짧게 깜빡이기만 한다(ms). */
const FLICKER_MS = 260;
/** 자막 상자에 남기는 방송 줄 수. 지난 줄은 하나만 옅게 남는다. */
const VISIBLE_LINES = 2;
/** 볼륨이 내려갔다 저 혼자 다시 차오르는 시간(ms). */
const VOLUME_RECOVER_MS = 1200;

/** 몇 번째로 끄려 했는가에 따라 다이얼이 얼마나 돌아가는지(deg). 점점 덜 돈다: 거부다. */
const KNOB_TURN = [-110, -55, -18] as const;
/** 도해의 속말: 처음 · 한 번 끄려 한 뒤 · 두 번 이상. */
const WHISPER_KEYS = [
  "minigame.emergencyBroadcast.whisper0",
  "minigame.emergencyBroadcast.whisper1",
  "minigame.emergencyBroadcast.whisper2",
] as const;

/**
 * 재난 방송: 끄려 해도 꺼지지 않는다.
 *
 * 1막은 외면의 체험이다 (docs/content-design.md 1장). 게임 내내 플레이어는 도해처럼
 * 현실을 피해 왔고, 여기서 처음으로 피하려는 손이 먹히지 않는다. 전원 다이얼과 볼륨이
 * 금빛으로 서서 "끄고 싶으면 꺼 보라"고 한다.
 *
 * 고장처럼 보이면 안 된다. 그래서:
 * - 누를 때마다 확실히 반응한다. 다이얼이 돌고, 딸깍 끊기는 소리가 나고, 화면이 꺼진다.
 *   그리고 라디오가 **스스로** 다시 켜진다. 먹통이 아니라 거부다.
 * - 두 번째부터 다이얼은 반만 돌다 되튕기고, 세 번째는 거의 안 돈다. 저항이 보인다.
 * - 도해의 속말이 답한다 ("…왜 안 꺼져."). 연출이라는 게 글로도 읽힌다.
 * - 안 눌러도 방송은 흐른다. 조작은 선택이라 막히는 순간이 없다. 그래서 스킵도 없다:
 *   가만히 있어도 15초 남짓이면 끝난다.
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
  const [tries, setTries] = useState(0);
  const [dark, setDark] = useState<"off" | "flicker" | null>(null);
  const [knob, setKnob] = useState(0);
  const [volumeLow, setVolumeLow] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const done = shown >= total;

  // 방송이 잡히는 순간의 지직
  useEffect(() => {
    if (!frozen) playSound("radioStatic");
  }, [frozen]);

  // 방송은 손과 상관없이 흐른다. 끄려 한 순간 다음 줄이 앞당겨지면 이 시계도 새로 잰다
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

  /** 끄려는 손: 몇 번째냐에 따라 다이얼이 덜 돌고, 라디오는 늘 스스로 다시 말한다. */
  const resist = (kind: "power" | "volume") => {
    if (frozen || done || dark) return;
    const attempt = Math.min(tries, KNOB_TURN.length - 1);
    setTries((value) => value + 1);
    playSound("radioCut");

    if (kind === "volume") {
      setVolumeLow(true);
      setTimeout(() => setVolumeLow(false), VOLUME_RECOVER_MS / 2);
    } else {
      setKnob(KNOB_TURN[attempt]);
    }

    // 첫 번째만 확실히 꺼진다. 그 뒤로는 화면이 깜빡이기만 한다: 꺼지지도 않는다
    const off = attempt === 0 && kind === "power";
    setDark(off ? "off" : "flicker");
    setTimeout(
      () => {
        setDark(null);
        setKnob(0);
        playSound(off ? "radioWake" : "radioStatic");
        // 다시 켜진 라디오는 하던 말을 이어 간다
        setShown((value) => Math.min(total, value + 1));
      },
      off ? BLACKOUT_MS : FLICKER_MS,
    );
  };

  const whisper = t(WHISPER_KEYS[Math.min(tries, WHISPER_KEYS.length - 1)]);
  const latest = shown - 1;

  return (
    <div
      className={`flex w-[min(40rem,94vw)] flex-col items-center gap-5 ${frozen ? "" : "pt-14"}`}
      aria-hidden={frozen || undefined}
    >
      {/* 라디오: 주파수가 잡힌 채 멈춘 그림. 꺼지면 화면째 어두워진다 */}
      <div
        className={`w-full transition-[filter,opacity] duration-150 ${
          dark === "off" ? "opacity-30 brightness-0" : dark === "flicker" ? "brightness-50" : ""
        }`}
      >
        <FrequencyTuneMinigame onComplete={() => {}} stage="result" />
      </div>

      {/* 방송: 최신 줄이 밝고, 지난 줄은 옅게 남는다. 스크린리더에는 새 줄이 읽힌다 */}
      <div
        aria-live="polite"
        className={`flex min-h-32 w-full flex-col gap-2 rounded-lg border border-line bg-scene-void/70 px-5 py-4 transition-opacity duration-150 ${
          dark === "off" ? "opacity-0" : ""
        }`}
      >
        <p className="font-pixel text-[0.7rem] tracking-[0.25em] text-ember/80">
          {tRoom("characters.broadcast.name" as never)}
        </p>
        {/* 최근 두 줄만: 줄이 쌓여 상자가 자라면 다이얼과 속말이 폰 화면 아래로 밀린다 */}
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

      {/* 끄려는 손: 라디오 몸체의 다이얼 둘. 방송이 끝나면 빛을 잃는다 */}
      {!frozen && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => resist("power")}
              disabled={done}
              aria-label={t("minigame.emergencyBroadcast.power")}
              className="group grid size-16 cursor-pointer place-items-center rounded-full border-2 border-memory/70 bg-surface text-memory shadow-panel transition-colors hover:border-memory disabled:cursor-default disabled:border-line disabled:text-fog focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
            >
              <span
                className="grid size-full place-items-center transition-transform duration-300 ease-out"
                style={{ transform: `rotate(${knob}deg)` }}
              >
                <Power size={26} weight="bold" aria-hidden />
              </span>
            </button>
            <button
              type="button"
              onClick={() => resist("volume")}
              disabled={done}
              aria-label={t("minigame.emergencyBroadcast.volume")}
              className="flex h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-memory/70 bg-surface px-4 text-memory shadow-panel transition-colors hover:border-memory disabled:cursor-default disabled:border-line disabled:text-fog focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
            >
              <Minus size={18} weight="bold" aria-hidden />
              {/* 볼륨 막대: 내려갔다가 저 혼자 다시 차오른다 */}
              <span aria-hidden className="block h-1.5 w-16 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-current transition-[width] ease-out"
                  style={{
                    width: volumeLow ? "8%" : "100%",
                    transitionDuration: `${volumeLow ? 150 : VOLUME_RECOVER_MS}ms`,
                  }}
                />
              </span>
            </button>
          </div>
          {/* 도해의 속말. 자리를 미리 잡아 두어 바뀔 때 판이 출렁이지 않는다 */}
          <p key={whisper} className="min-h-6 animate-fade-rise break-ko text-center text-bone/70">
            {done ? "" : whisper}
          </p>
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
