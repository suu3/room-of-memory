"use client";

import { X } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { phaseConfigOf } from "@/data/memory-room";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { getMinigame } from "@/minigames";
import { liveMinigameOf, selectCanvasPuzzle } from "@/minigames/active";
import { MinigameHelp } from "@/minigames/shell";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";
import type { MinigameResult } from "@/types/minigame";
import { ExitFade } from "./ExitFade";
import { SuccessBurst } from "./SuccessBurst";
import { BUTTON_PRIMARY, BUTTON_QUIET, HUD_ICON_BUTTON_SOLID, PANEL_FRAME } from "./ui-classes";

/**
 * 결과 카드의 버튼이 서기까지 기다리는 시간(ms).
 *
 * 판을 두드리던 손가락이 카드가 뜨는 순간 버튼을 눌러 버리는 걸 막는 창이다. 그
 * 이상은 아니다. 1.8초를 붙잡아 뒀더니 성공 카드는 2.6초에 저절로 넘어가는 탓에
 * 버튼이 서 있는 시간이 0.5초뿐이었다: 누르려고 보면 이미 사라져 있었다.
 */
const RESULT_HOLD_MS = 600;
/** 성공 카드가 저절로 넘어가는 시각(ms). 읽을 시간은 주되 붙잡아 두지는 않는다. */
const RESULT_AUTO_MS = 2600;

/**
 * 판이 끝난 자리에 서는 결과. 성공이면 되찾은 기억의 이름과 "수첩에 기록됨",
 * 실패면 캐릭터 톤의 한 줄과 다시 해보기 · 나중에 하기.
 *
 * 성공은 RESULT_AUTO_MS 뒤 저절로 다음(결과 대사 또는 수집)으로 넘어간다. 버튼으로
 * 먼저 넘길 수도 있다. 실패는 사람이 고를 때까지 기다린다. 다시 해보기는 판을 새로
 * 마운트하고, 나중에 하기는 완료 처리 없이 방으로 돌아간다 (핫스팟은 남는다).
 */
function MinigameResultCard({
  cleared,
  memoryName,
  failLine,
  onContinue,
  onRetry,
  onLater,
}: {
  cleared: boolean;
  memoryName: string;
  failLine: string;
  onContinue: () => void;
  onRetry: () => void;
  onLater: () => void;
}) {
  const { t } = useTranslation();
  const [settled, setSettled] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    const hold = window.setTimeout(() => setSettled(true), RESULT_HOLD_MS);
    return () => window.clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (!cleared) return;
    const auto = window.setTimeout(() => onContinueRef.current(), RESULT_AUTO_MS);
    return () => window.clearTimeout(auto);
  }, [cleared]);

  // 버튼이 서면 포커스도 따라간다. 키보드로 놀던 사람이 Enter 한 번으로 이어가게
  useEffect(() => {
    if (settled) primaryRef.current?.focus();
  }, [settled]);

  return (
    <ExitFade
      role="status"
      aria-live="polite"
      // z-50: 판이 얹힌 층(z-40) 위에 서야 한다. 이 카드가 떠 있는 동안 대사창은 없다
      // 닫힐 때는 유령이 200ms 남았다 사라진다 (ExitFade)
      className="absolute inset-0 z-50 grid animate-backdrop-in place-items-center bg-scene-void/55 p-4"
    >
      <div
        className={`w-[22rem] max-w-[92vw] animate-fade-rise p-6 text-center ${PANEL_FRAME} ${
          cleared ? "border-memory/50" : "border-ember/50"
        }`}
      >
        <p
          className={`font-pixel text-xs tracking-[0.3em] ${cleared ? "text-memory" : "text-ember"}`}
        >
          {t(cleared ? "minigame.result.clearedTitle" : "minigame.result.failedTitle")}
        </p>
        {cleared ? (
          <>
            <p className="mt-3 break-ko text-lg font-medium leading-snug text-ivory">
              {memoryName}
            </p>
            <p className="mt-1.5 text-sm text-fog">{t("minigame.result.recorded")}</p>
          </>
        ) : (
          <p className="mt-3 break-ko text-pretty text-base leading-normal text-ivory">
            {failLine}
          </p>
        )}
        {/* 최소 노출 시간이 지나기 전에는 버튼을 세우지 않는다. 결과를 읽기 전에 눌리는 걸 막는다 */}
        <div
          className={`mt-5 flex justify-center gap-2 transition-opacity duration-300 ${
            settled ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {cleared ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={onContinue}
              className={`${BUTTON_PRIMARY} px-6`}
            >
              {t("minigame.result.continue")}
            </button>
          ) : (
            <>
              <button type="button" onClick={onLater} className={BUTTON_QUIET}>
                {t("minigame.result.later")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={onRetry}
                className={`${BUTTON_PRIMARY} px-6`}
              >
                {t("minigame.result.retry")}
              </button>
            </>
          )}
        </div>
      </div>
    </ExitFade>
  );
}

/**
 * overlay 모드 미니게임 호스트. canvas 모드는 씬 쪽 호스트가 판을 세우고
 * (src/scenes/memory-room/CanvasMinigameHost.tsx), 여기는 DOM이어야 하는 두 가지
 * (조작 안내 한 줄·닫기)만 그 위에 얹는다.
 * 미등록 id는 스킵(cleared: true) 처리해 진행이 막히지 않게 한다.
 * 게임은 시작 카드에서 시작 버튼을 눌러야 마운트된다. 타이머·라운드가
 * 조작법을 읽기 전에 돌지 않도록.
 */
export function MinigameHost() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const hint = useControlHint();
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const cancelMinigame = useMemoryRoomStore((state) => state.cancelMinigame);
  // 난이도는 판 안의 수치(대역·속도·피해량)로만 들어간다. 스킵 게이트는 shell이 따로 본다
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  /** 시작 버튼을 누른 인터랙션 키: 인터랙션이 바뀌면 자연히 시작 카드로 돌아간다. */
  const [startedKey, setStartedKey] = useState<string | null>(null);
  /**
   * 결과가 확정돼 더는 취소할 수 없는 인터랙션 키.
   * 미니게임이 onSettled로 알린다 (src/types/minigame.ts).
   */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  /** 성공 파티클 리트리거 키: 모달이 닫힌 뒤에도 버스트는 끝까지 재생된다. */
  const [burstId, setBurstId] = useState(0);
  /**
   * 판이 끝나고 스토어에 넘기기 전, 결과 카드가 떠 있는 동안 붙들어 둔 결과.
   * 카드가 "계속"·"나중에 하기"로 닫힐 때 비로소 finishMinigame이 불린다.
   */
  const [outcome, setOutcome] = useState<{ key: string; result: MinigameResult } | null>(null);
  /** 다시 해보기마다 올라간다. 미니게임의 key라 새 판이 처음부터 마운트된다. */
  const [retry, setRetry] = useState(0);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  /** 결과 대사 단계: 미니게임 화면은 남기고 대사창이 그 위에 뜬다. */
  const resultStage = active?.phase === "dialogue" && active.keepMinigame === true;
  const minigameId =
    active?.phase === "minigame" || resultStage
      ? phaseConfigOf(active.memoryId, active.gamePhase)?.interaction?.minigameId
      : undefined;
  const definition = minigameId ? getMinigame(minigameId) : undefined;
  const hosted = definition?.mode === "overlay" ? definition : undefined;
  /** 씬 안에서 도는 판: 여기서는 안내와 닫기만 맡는다. */
  const canvasHosted = definition?.mode === "canvas" ? definition : undefined;
  /** 탐색형 오브젝트: 시작 카드도 패널도 없이 물건만 떠오른다. */
  const bare = hosted?.presentation === "bare";

  useEffect(() => {
    if (active?.phase === "minigame" && !hosted && !canvasHosted) {
      finishMinigame({ cleared: true });
    }
  }, [active, hosted, canvasHosted, finishMinigame]);

  const activeKey = active ? `${active.memoryId}:${active.gamePhase}` : null;
  // bare는 "시작"을 거치지 않는다. 물건을 집었으면 이미 들여다보는 중이다.
  const started = bare || (startedKey !== null && startedKey === activeKey);
  /**
   * 승부가 난 뒤부터 결과 대사가 끝날 때까지는 닫을 수 없다.
   * 이 구간에서 닫히면 다 이긴 판이 수집도 안 된 채 사라진다.
   */
  const shownOutcome = outcome !== null && outcome.key === activeKey ? outcome.result : null;
  const sealed =
    resultStage || shownOutcome !== null || (settledKey !== null && settledKey === activeKey);

  /*
   * 판이 닫히면 시작·확정 표시를 놓아준다.
   *
   * 이 두 키는 인터랙션 키(`memoryId:gamePhase`)와 같은지로만 판정하는데, 그 키는
   * 같은 물건을 다시 조사하면 똑같이 만들어진다. 닫을 때 비우지 않으면 다음에 그
   * 물건을 열었을 때 시작 카드를 건너뛰고 타이머가 곧장 돌아버리고(조작법을 읽기
   * 전에 라운드가 지나간다), 한 번 승부가 났던 물건은 닫기 버튼조차 없이 열린다.
   */
  useEffect(() => {
    if (activeKey !== null) return;
    setStartedKey(null);
    setSettledKey(null);
    setOutcome(null);
    setRetry(0);
  }, [activeKey]);

  // 시작 카드가 뜨면 버튼에 포커스 (키보드 플레이)
  useEffect(() => {
    if (hosted && !bare && !started) startButtonRef.current?.focus();
  }, [hosted, bare, started]);

  // Esc = 바깥 클릭과 같은 닫기 (키보드 접근성). 승부가 난 뒤에는 닫기를 막는다
  useEffect(() => {
    if ((!hosted && !canvasHosted) || sealed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") cancelMinigame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hosted, canvasHosted, sealed, cancelMinigame]);

  const Minigame = hosted?.component;
  return (
    <>
      {burstId > 0 && <SuccessBurst key={burstId} onDone={() => setBurstId(0)} />}
      {/*
        canvas 판(냉장고 아래칸의 앰플): 판은 씬이 그리고 있다. 백드롭도 카드도 없이
        조작 안내 한 줄과 닫기만 띄운다. 결과 대사가 뜨면 둘 다 물러난다: 그 구간의
        주인은 대사창이다. 안내 자리는 근접 안내(RoomInteractionPrompt)와 같은 자리다.
      */}
      {active?.phase === "minigame" && canvasHosted && (
        <>
          <div
            role="status"
            className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-sm border border-line bg-surface px-3 py-1.5 text-center text-xs font-medium text-ivory shadow-chip"
          >
            <MinigameHelp help={hint(canvasHosted.helpKey)} className="break-ko text-pretty" />
          </div>
          <button
            type="button"
            aria-label={t("minigame.close")}
            onClick={() => {
              playSound("close");
              cancelMinigame();
            }}
            className={`fixed right-4 top-4 z-20 ${HUD_ICON_BUTTON_SOLID}`}
          >
            <X size={20} weight="bold" />
          </button>
        </>
      )}
      {active?.phase === "minigame" && hosted && shownOutcome && (
        <MinigameResultCard
          cleared={shownOutcome.cleared}
          memoryName={tRoom(`memories.${active.memoryId}.name` as ParseKeys<"memoryRoom">)}
          failLine={t(hosted.failKey ?? "minigame.result.failDefault")}
          onContinue={() => {
            setOutcome(null);
            finishMinigame(shownOutcome);
          }}
          onRetry={() => {
            playSound("select");
            setOutcome(null);
            setSettledKey(null);
            setRetry((count) => count + 1);
          }}
          onLater={() => {
            playSound("close");
            setOutcome(null);
            finishMinigame(shownOutcome);
          }}
        />
      )}
      {(active?.phase === "minigame" || resultStage) && hosted && Minigame && (
        /*
         * 바깥(백드롭) 클릭 시 완료 처리 없이 닫는다. 핫스팟은 다시 클릭 가능.
         * 결과 대사 중에는 화면을 더 어둡게 깔고, 아래쪽을 대사창 자리로 비워둔다.
         *
         * 단, 게임이 **시작된 뒤에는** 백드롭으로 닫히지 않는다. 손가락으로 하는
         * 게임(닦기·다이얼)은 획이 판 밖에서 시작되는 일이 잦은데, 그때마다 판이
         * 통째로 닫혀 버렸다. 대신 오른쪽 위 닫기 버튼이 늘 떠 있어 나갈 길은 남는다.
         */
        <ExitFade
          /*
           * 결과 대사 중에는 판이 대사창(z-50) 아래 그림으로만 남는다. DOM에는 그대로
           * 살아 있어서 탭이 닿으면 안 보이는 버튼에 포커스가 잡히는데, 그 상태의
           * Enter는 대사가 아니라 그 버튼에게 간다. 보이지 않는 것이 눌린다.
           * inert로 이 층을 통째로 입력에서 빼면, 그 구간의 주인이 대사창 하나가 된다.
           *
           * 들어올 때는 백드롭이 먼저 깔리고(animate-backdrop-in) 카드가 그 위로 올라온다.
           * 닫힐 때는 ExitFade가 유령을 200ms 남긴다. 판이 뚝 끊기지 않는다.
           */
          inert={resultStage || shownOutcome !== null}
          className={`absolute inset-0 z-40 grid animate-backdrop-in place-items-center ${
            // 탐색형은 방을 덜 가린다. 물건을 든 채로도 방이 보여야 "그 방 안"이다.
            // 뒤쪽 방이 완전히 사라질 만큼 뭉개지 않는다 (3px)
            bare ? "bg-scene-void/55 backdrop-blur-[2px]" : "backdrop-blur-[3px]"
          } ${resultStage ? "bg-scene-void/75 pb-56" : bare ? "" : "bg-scene-void/40"}`}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || sealed || started) return;
            cancelMinigame();
          }}
        >
          {/*
            닫기. 백드롭이 잠긴 동안 유일하게 남는 출구라 늘 보인다. 스킵(건너뛰기)은
            일정 시간이 지나야 뜨고 의미도 다르다(스킵은 수집으로 친다, 닫기는 아니다).
            프레임이 있는 게임은 그 우측 상단 모서리에 모으고, 틀 없이 물건만 떠오르는
            탐색형은 화면 구석에 둔다.
          */}
          {started ? (
            <div className="relative animate-fade-rise">
              {!sealed && (
                <button
                  type="button"
                  aria-label={t("minigame.close")}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    playSound("close");
                    cancelMinigame();
                  }}
                  className={`${bare ? "fixed right-4 top-4" : "absolute right-3 top-3"} z-10 ${HUD_ICON_BUTTON_SOLID}`}
                >
                  <X size={20} weight="bold" />
                </button>
              )}
              <Suspense fallback={null}>
                <Minigame
                  key={retry}
                  gamePhase={active.gamePhase}
                  difficulty={difficulty}
                  stage={resultStage ? "result" : "play"}
                  onSettled={() => setSettledKey(activeKey)}
                  onComplete={(result) => {
                    playSound(result.cleared ? "success" : "fail");
                    if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
                    /*
                     * 곧장 스토어로 넘기지 않는다. 결과 카드가 먼저 서고, 카드가 닫힐 때
                     * finishMinigame이 불린다. 그래야 실패가 "아무 안내 없이 닫힘"이
                     * 아니라 결과로 읽힌다.
                     */
                    setOutcome({ key: activeKey ?? "", result });
                  }}
                />
              </Suspense>
            </div>
          ) : (
            <div
              className={`w-[38rem] max-w-[94vw] animate-fade-rise p-6 text-center sm:p-8 ${PANEL_FRAME}`}
            >
              <h2 className="break-ko text-xl font-medium leading-snug text-ivory">
                {t(hosted.titleKey)}
              </h2>
              <MinigameHelp
                help={hint(hosted.helpKey)}
                className="mt-3 break-ko text-pretty text-[0.9375rem] leading-normal text-fog"
              />
              {/*
                플레이 방법. 카드가 가운데 정렬이라 목록만 왼쪽으로 세운다.
                가운데 정렬된 여러 줄은 줄머리가 들쭉날쭉해서 읽는 순서가 안 잡힌다.
                시작 버튼과는 한 칸 더 벌려, 읽는 것과 누르는 것을 나눠 둔다.
              */}
              {hosted.rulesKeys && hosted.rulesKeys.length > 0 && (
                <ul className="mx-auto mt-5 flex max-w-[30rem] flex-col gap-2 text-left">
                  {hosted.rulesKeys.map((key) => (
                    <li
                      key={key}
                      className="flex gap-2 break-ko text-pretty text-sm leading-normal text-fog"
                    >
                      <span className="shrink-0 font-medium text-memory" aria-hidden>
                        ·
                      </span>
                      <span>{hint(key)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                ref={startButtonRef}
                type="button"
                onClick={() => {
                  playSound("select");
                  setStartedKey(activeKey);
                }}
                className={`${BUTTON_PRIMARY} mt-7 px-8 py-3 text-base`}
              >
                {t("minigame.start")}
              </button>
            </div>
          )}
        </ExitFade>
      )}
    </>
  );
}

/**
 * 3D가 못 뜬 자리의 안전망. canvas 모드 미니게임은 그릴 씬이 없으니 건너뛴다
 * (cleared: true). 미등록 id를 건너뛰는 것과 같은 이유다: 진행이 먼저다.
 * RoomCanvas가 WebGL 폴백을 세울 때 같이 세운다.
 *
 * 미궁 문제(거실 피아노)도 같다. 건반이 없으면 누를 수도 없으니 풀린 것으로 친다.
 */
export function CanvasMinigameSkip() {
  const active = useMemoryRoomStore(selectActiveInteraction);
  const finishMinigame = useMemoryRoomStore((state) => state.finishMinigame);
  const finishPuzzle = useMemoryRoomStore((state) => state.finishPuzzle);
  const canvasPuzzle = useMemoryRoomStore(selectCanvasPuzzle);
  const live = liveMinigameOf(active);
  const skip = active?.phase === "minigame" && live?.definition.mode === "canvas";

  useEffect(() => {
    if (skip) finishMinigame({ cleared: true });
  }, [skip, finishMinigame]);

  useEffect(() => {
    if (canvasPuzzle) finishPuzzle({ cleared: true });
  }, [canvasPuzzle, finishPuzzle]);

  return null;
}
