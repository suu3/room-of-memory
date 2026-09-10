"use client";

import { SpeakerSimpleHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { HUD_ICON_BUTTON } from "./ui-classes";

/**
 * 소리 on/off. HUD 메뉴 안에 있던 걸 밖으로 꺼냈다.
 *
 * 메뉴의 다른 항목(언어·캐릭터 시트·연락처·리셋)은 한 번 정하거나 드물게 쓰는 것들인데
 * 소리만 성격이 다르다. 옆에 사람이 오면 급하게, 그리고 반복해서 누른다. 게다가 이
 * 게임은 "시작하기"를 누르는 순간 BGM과 효과음이 같이 켜져서, 끄고 싶은 첫 순간이 곧
 * 플레이 첫 순간이다. 그때 화면에 오디오 단서가 하나도 없으면 안 된다.
 *
 * 메뉴 안에는 남기지 않는다. 같은 스위치가 두 군데 있으면 어느 쪽이 진짜인지 헷갈린다.
 */
export function SoundToggle() {
  const { t } = useTranslation();
  const soundMuted = useMemoryRoomStore((state) => state.soundMuted);
  const setSoundMuted = useMemoryRoomStore((state) => state.setSoundMuted);
  const label = t(soundMuted ? "hud.soundOff" : "hud.soundOn");

  return (
    <button
      type="button"
      aria-pressed={!soundMuted}
      aria-label={label}
      title={label}
      onClick={() => {
        // 켤 때만 소리를 낸다. 끄는 순간 소리가 나면 안 꺼진 것처럼 들린다
        if (soundMuted) playSound("select");
        setSoundMuted(!soundMuted);
      }}
      // 꺼져 있을 때 글자색을 죽인다. 빗금 아이콘만으로도 읽히지만, 작은 아이콘 하나가
      // 유일한 표시라 상태를 색으로도 한 번 더 말해 준다.
      className={`${HUD_ICON_BUTTON} ${soundMuted ? "text-ash" : ""}`}
    >
      {soundMuted ? (
        <SpeakerSimpleSlash size={20} weight="bold" />
      ) : (
        <SpeakerSimpleHigh size={20} weight="bold" />
      )}
    </button>
  );
}
