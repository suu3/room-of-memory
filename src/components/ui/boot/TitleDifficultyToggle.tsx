"use client";

import { FootprintsIcon, SignpostIcon } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "../shared/hover-sfx";
import { KEYCAP_CLASS } from "../shared/Keycap";
import { TITLE_TOGGLE } from "../shared/ui-classes";

/**
 * 타이틀의 난이도 토글. 소리 토글(SoundToggle tone="title") 바로 아래에 같은 옷으로 선다:
 * 지금 값은 키캡, 그 값이 무엇을 하는지는 옆 한 줄. 누르면 이지와 보통을 오간다.
 *
 * 켬/끔이 아니라 두 값을 오가는 버튼이라 aria-pressed를 달지 않는다. 이름(난이도)과
 * 지금 값이 글자로 읽힌다.
 */
export function TitleDifficultyToggle() {
  const { t } = useTranslation();
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  const setDifficulty = useMemoryRoomStore((state) => state.setDifficulty);
  const guided = difficulty === "guided";

  return (
    <button
      type="button"
      onPointerEnter={playHoverSound}
      onClick={() => {
        playSound("select");
        setDifficulty(guided ? "normal" : "guided");
      }}
      className={TITLE_TOGGLE}
    >
      <span className="sr-only">{t("difficulty.label")}</span>
      <span
        className={`${KEYCAP_CLASS} shrink-0 gap-1 whitespace-nowrap transition-colors duration-150 group-hover:border-memory`}
      >
        {/* 이지는 길을 짚어 주는 표지판, 보통은 제 발로 찾는 발자국 */}
        {guided ? (
          <SignpostIcon size="1.1em" weight="bold" aria-hidden />
        ) : (
          <FootprintsIcon size="1.1em" weight="bold" aria-hidden />
        )}
        {t(`difficulty.${difficulty}`)}
      </span>
      <span className="break-ko">
        {t(guided ? "titleScreen.difficultyHintGuided" : "titleScreen.difficultyHintNormal")}
      </span>
    </button>
  );
}
