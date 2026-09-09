"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LoadingIndicator } from "./LoadingIndicator";
import { useSmoothLoadProgress } from "./loading-progress";
import { RisingDust } from "./RisingDust";

/**
 * 커튼이 최소한 이만큼은 걸려 있는다(ms). 모델이 캐시에 있어 순식간에 오면 커튼이
 * 뜨자마자 걷혀서 화면이 껌뻑인 것처럼 보인다.
 */
const MIN_SHOW_MS = 900;

/**
 * 이만큼 지나도 로딩이 안 끝나면 그냥 걷는다(ms). 모델 하나가 영영 안 오는 판에서
 * 커튼 뒤에 갇히는 것보다, 대체 프리미티브가 서 있는 방이라도 보여주는 편이 낫다.
 */
const GIVE_UP_MS = 12_000;

/**
 * 커튼이 걷히는 시간(ms). globals.css의 --animate-boot-curtain-rise와 같아야 한다 —
 * 애니메이션이 끝나기 전에 언마운트되면 화면이 뚝 끊긴다.
 */
const RISE_MS = 1100;

/**
 * 부팅 커튼 — 첫 화면. 방의 모델이 다 올 때까지 타이틀째로 덮고 있다가 위로 걷힌다.
 *
 * 그림은 타이틀 화면과 같은 문법이다: 어두운 바탕에 떠오르는 먼지, 픽셀 서체 제목,
 * 그 아래 달리는 도해와 분절 진행 막대 한 줄. 예전의 천 주름은 걷어냈다 — 커튼이라는
 * 몸짓(위로 걷힘)만 남기고 판은 조용히 둔다.
 */
export function BootCurtain() {
  const { t } = useTranslation();
  const booted = useMemoryRoomStore((state) => state.booted);
  const finishBoot = useMemoryRoomStore((state) => state.finishBoot);
  const loadProgress = useMemoryRoomStore((state) => state.roomLoadProgress);
  const [gaveUp, setGaveUp] = useState(false);
  const [held, setHeld] = useState(true);

  const shown = useSmoothLoadProgress(gaveUp ? 1 : loadProgress);
  const loadPercent = Math.round(shown * 100);
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

  useEffect(() => {
    if (!rising) return;
    const timer = window.setTimeout(finishBoot, RISE_MS);
    return () => window.clearTimeout(timer);
  }, [rising, finishBoot]);

  if (booted) return null;

  return (
    <div
      className={`absolute inset-0 z-50 overflow-hidden bg-night ${
        rising ? "animate-boot-curtain-rise pointer-events-none" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={t("scene.loading")}
    >
      {/* 커튼 앞을 떠도는 먼지 — 타이틀 화면과 같은 층 (RisingDust) */}
      <RisingDust />

      {/* 방과 같은 필름 그레인. 로딩 화면이 게임 밖 화면처럼 보이지 않게 붙드는 층이다 */}
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6">
        <p
          aria-hidden
          className="title-logo break-ko font-pixel text-4xl leading-tight text-ivory md:text-5xl"
        >
          {t("title")}
        </p>
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
    </div>
  );
}
