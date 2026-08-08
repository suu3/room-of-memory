"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LoadingIndicator } from "./LoadingIndicator";
import { useSmoothLoadProgress } from "./loading-progress";
import { RisingDust } from "./RisingDust";

/**
 * 커튼을 최소한 이만큼은 세워 둔다.
 *
 * 두 번째 방문이면 모델이 전부 캐시에 있어 진행률이 첫 프레임에 1로 뛴다 — 그대로
 * 두면 커튼이 보이기도 전에 걷혀 화면이 한 번 번쩍이고 만다. 로딩 화면은 기다림을
 * 설명하는 물건이라, 설명할 틈도 없이 사라지면 깜빡임으로만 남는다.
 */
const MIN_SHOW_MS = 900;

/**
 * 로딩을 포기하고 커튼을 걷는 시각(ms).
 *
 * 진행률은 캔버스 청크가 보고한다 — 그 청크 자체를 못 받으면 아무도 보고하지 않아
 * 0에 멈춘다. 그 경우에도 게임은 시작할 수 있어야 한다. 방이 덜 예쁘게 뜨는 것과
 * 아예 못 들어가는 것은 다른 문제다.
 */
const GIVE_UP_MS = 12_000;

/** 커튼이 다 올라가는 데 걸리는 시간. globals.css의 --animate-boot-curtain-rise와 같아야 한다. */
const RISE_MS = 1100;

/**
 * 부팅 커튼 — 3D 에셋을 받는 동안 화면을 덮고, 다 받으면 **위로 걷혀** 그 아래의
 * 타이틀 화면을 드러낸다.
 *
 * 방의 창 커튼과 같은 몸짓을 쓴다. 이 게임에서 무언가가 드러나는 방식은 커튼을
 * 걷는 것이고(창문 조사), 시작 화면이 열리는 것도 같은 사건으로 읽히는 편이 낫다.
 *
 * 로딩 표시를 여기 하나로 모은 결과, 타이틀 화면은 "다 받은 뒤"의 화면만 그리면
 * 된다 — 잠긴 시작 버튼도, 그 아래 진행 바도 이제 없다.
 */
export function BootCurtain() {
  const { t } = useTranslation();
  const booted = useMemoryRoomStore((state) => state.booted);
  const finishBoot = useMemoryRoomStore((state) => state.finishBoot);
  const loadProgress = useMemoryRoomStore((state) => state.roomLoadProgress);
  const [gaveUp, setGaveUp] = useState(false);
  /** 최소 노출 시간이 아직 안 찼는가. 다 받았어도 이게 걸려 있으면 커튼은 그대로다. */
  const [held, setHeld] = useState(true);

  /*
   * 보고값을 그대로 그리지 않고 흐르게 만든다 (useSmoothLoadProgress).
   *
   * 로딩 매니저는 파일이 끝날 때만 세는데 방이 쓰는 모델은 열세 개, 전부 33KB 이하다 —
   * 보고값을 그대로 그리면 0에 멈춰 있다가 계단으로 몇 번 튀고 끝난다. 실제로는 그게
   * 맞는 숫자지만, 사람 눈에는 바가 고장 난 것으로 보인다.
   *
   * 포기한 경우에는 목표를 1로 준다. 어차피 커튼은 걷히는데 바만 60%에 남겨 두면,
   * 마지막으로 본 화면이 "덜 채워진 채 사라진 바"가 된다.
   */
  const shown = useSmoothLoadProgress(gaveUp ? 1 : loadProgress);
  const loadPercent = Math.round(shown * 100);
  /*
   * 커튼을 올릴 때가 됐는가. 세 항이 전부 한 방향으로만 움직여서(진행률은 올라가기만
   * 하고, 포기와 최소 노출은 한 번 넘어가면 끝) 이 값도 한 번 참이 되면 그대로다 —
   * "올라가는 중"을 따로 state로 들 필요가 없다.
   *
   * 보고값이 아니라 **그리고 있는 값**이 다 차기를 기다린다. 100%에 닿는 걸 보여주고
   * 걷어야지, 바가 70%에서 사라지면 그때까지 채운 것이 헛일이 된다. 포기한 경우만
   * 예외다 — 그쪽은 바를 기다릴 것이 아니라 빠져나가는 길이다.
   */
  const rising = (shown >= 1 || gaveUp) && !held;

  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(false), MIN_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (gaveUp) return;
    const timer = window.setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [gaveUp]);

  // 커튼이 다 오른 뒤에야 내려놓는다 — 애니메이션 도중에 언마운트하면 커튼이
  // 걷히는 게 아니라 없어진 것처럼 보인다.
  useEffect(() => {
    if (!rising) return;
    const timer = window.setTimeout(finishBoot, RISE_MS);
    return () => window.clearTimeout(timer);
  }, [rising, finishBoot]);

  if (booted) return null;

  return (
    <div
      /*
       * z-50 — 타이틀(z-40)까지 덮는다. 커튼 아래에서 타이틀이 이미 그려져 있어야
       * 걷히는 동안 드러날 것이 있다 (MemoryRoom에서 둘을 나란히 세우는 이유).
       *
       * 올라가기 시작하면 입력을 놓는다. 모션을 끈 판에서는 커튼이 1.1s를 다 쓰지
       * 않고 0.24s 만에 투명해지는데, 그때 보이지도 않는 판이 클릭을 먹고 있으면
       * 시작 버튼이 죽은 것처럼 느껴진다.
       */
      className={`absolute inset-0 z-50 overflow-hidden bg-night ${
        rising ? "animate-boot-curtain-rise pointer-events-none" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={t("scene.loading")}
    >
      {/* 천의 주름과 가장자리 그늘. 드리운 천으로 읽히게 하는 층 (globals.css) */}
      <div aria-hidden className="boot-curtain-cloth pointer-events-none absolute inset-0" />

      {/* 커튼 뒤에서 새는 빛. 로딩 그림 자리를 받쳐 주고, 방이 저 너머에 이미 있다고 말한다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 38% at 50% 45%, color-mix(in srgb, var(--color-memory) 20%, transparent) 0%, color-mix(in srgb, var(--color-memory) 7%, transparent) 46%, transparent 100%)",
        }}
      />

      {/* 밑단으로 새어 나오는 방의 빛 — 걷힐 방향의 반대편이라 "아래에 뭔가 있다"가 된다 */}
      <div
        aria-hidden
        className="boot-curtain-hem pointer-events-none absolute inset-x-0 bottom-0 h-56"
      />

      {/* 커튼 앞을 떠도는 먼지 — 타이틀 화면과 같은 층 (RisingDust) */}
      <RisingDust />

      {/* 방과 같은 필름 그레인. 로딩 화면이 게임 밖 화면처럼 보이지 않게 붙드는 층이다 */}
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0" />

      <div className="absolute inset-0 grid place-items-center">
        {/*
          퍼센트는 언제나 내건다. 예전에는 첫 모델이 도착하기 전까지 훑고 지나가는
          바를 돌렸는데, 이제 그리는 값이 스스로 기어오르므로(useSmoothLoadProgress)
          0에 멈춰 서는 순간이 없다 — 모르는 척할 이유가 사라졌다.
        */}
        <LoadingIndicator
          percent={loadPercent}
          label={t("titleScreen.loading", { percent: loadPercent })}
        />
      </div>

      {/* 커튼의 밑단. 여기가 아래 끝이라는 선이 있어야 "올라간다"가 읽힌다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-memory/25 shadow-panel"
      />
    </div>
  );
}
