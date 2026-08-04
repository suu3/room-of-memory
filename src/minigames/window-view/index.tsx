"use client";

import { Check } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";

/**
 * 커튼을 걷고 창밖을 내다본다.
 *
 * 이기고 지는 게임이 아니다 — 방 안의 물건들은 그날의 흔적을 하나씩 말하지만
 * 창문만은 지금 바깥이 어떤지를 보여준다. 그래서 설명 대신 그림 한 장이고,
 * 닫는 동작(커튼을 닫는다)까지가 이 오브젝트의 전부다.
 * 도중에 닫으면 아무 일도 없었던 것처럼 다시 열 수 있다 (방탈출 탐색).
 */
export function WindowViewMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const doneRef = useRef(false);

  // 커튼이 젖혀지는 소리 — 판이 열리는 순간 한 번.
  useEffect(() => {
    playSound("wipe");
  }, []);

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      {/* 창틀 — 어두운 방에서 이 그림만 빛나 보이도록 바깥으로 빛을 흘린다 */}
      <div className="relative w-[34rem] max-w-[86vw] rounded-md bg-scene-coal p-2 shadow-panel ring-1 ring-bone/20">
        {/* biome-ignore lint/performance/noImgElement: 그림 한 장이 곧 이 화면이라 원본 비율 그대로 쓴다. */}
        <img
          src={ASSETS.images.mgWindowViewOutside}
          alt={t("minigame.windowView.title")}
          width={524}
          height={380}
          draggable={false}
          className="block h-auto w-full select-none rounded-sm"
        />
        {/* 유리에 비친 방의 어둠 — 그림 위에 아주 옅게만 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-sm ring-1 ring-inset ring-night/30"
        />
      </div>

      <p className="max-w-[86vw] break-ko text-pretty text-center text-xs tracking-widest text-bone/55">
        {t("minigame.windowView.help")}
      </p>

      <button
        type="button"
        onClick={() => {
          if (doneRef.current) return;
          doneRef.current = true;
          playSound("close");
          onComplete({ cleared: true });
        }}
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
      >
        <Check size={14} weight="bold" />
        {t("minigame.windowView.close")}
      </button>
    </div>
  );
}
