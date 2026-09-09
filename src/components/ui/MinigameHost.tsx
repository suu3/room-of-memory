"use client";

import { X } from "@phosphor-icons/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { phaseConfigOf } from "@/data/memory-room";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { getMinigame } from "@/minigames";
import { MinigameHelp } from "@/minigames/shell";
import { selectActiveInteraction, useMemoryRoomStore } from "@/store/memory-room";
import { SuccessBurst } from "./SuccessBurst";
import { BUTTON_PRIMARY, HUD_ICON_BUTTON_SOLID, PANEL_FRAME } from "./ui-classes";

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
  }, [activeKey]);

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
          /*
           * 결과 대사 중에는 판이 대사창(z-50) 아래 그림으로만 남는다. DOM에는 그대로
           * 살아 있어서 탭이 닿으면 안 보이는 버튼에 포커스가 잡히는데, 그 상태의
           * Enter는 대사가 아니라 그 버튼에게 간다 — 보이지 않는 것이 눌린다.
           * inert로 이 층을 통째로 입력에서 빼면, 그 구간의 주인이 대사창 하나가 된다.
           */
          inert={resultStage}
          className={`absolute inset-0 z-40 grid place-items-center ${
            // 탐색형은 방을 덜 가린다 — 물건을 든 채로도 방이 보여야 "그 방 안"이다.
            // 뒤쪽 방이 완전히 사라질 만큼 뭉개지 않는다 (3px)
            bare ? "bg-scene-void/55 backdrop-blur-[2px]" : "backdrop-blur-[3px]"
          } ${resultStage ? "bg-scene-void/75 pb-56" : bare ? "" : "bg-scene-void/40"}`}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || sealed || started) return;
            cancelMinigame();
          }}
        >
          {/*
            닫기. 백드롭이 잠긴 동안 유일하게 남는 출구라 늘 보인다 — 스킵(건너뛰기)은
            일정 시간이 지나야 뜨고 의미도 다르다(스킵은 수집으로 친다, 닫기는 아니다).
            프레임이 있는 게임은 그 우측 상단 모서리에 모으고, 틀 없이 물건만 떠오르는
            탐색형은 화면 구석에 둔다.
          */}
          {started ? (
            <div className="relative">
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
                  gamePhase={active.gamePhase}
                  stage={resultStage ? "result" : "play"}
                  onSettled={() => setSettledKey(activeKey)}
                  onComplete={(result) => {
                    playSound(result.cleared ? "success" : "fail");
                    if (result.cleared && !result.celebrated) setBurstId((id) => id + 1);
                    finishMinigame(result);
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
                플레이 방법. 카드가 가운데 정렬이라 목록만 왼쪽으로 세운다 —
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
        </div>
      )}
    </>
  );
}
