"use client";

import { SpeakerSimpleHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound, setAudioMuted } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "../shared/hover-sfx";
import { KEYCAP_CLASS } from "../shared/Keycap";
import { FOCUS_RING, HUD_ICON_BUTTON } from "../shared/ui-classes";

/**
 * hud: 방 위에 떠 있는 아이콘 버튼.
 * title: 타이틀 메뉴의 새 게임 바로 아래 작은 글자 버튼. "켜짐 · 켜고 플레이하기를
 *        권해요"처럼 상태와 권장을 한 줄로 읽히게 하고, 눌러서 바로 바꾼다.
 */
export type SoundToggleTone = "hud" | "title";

/** 이어하기 아래 진행 줄과 같은 옷(작은 본문 글자 · ash). 메뉴 항목과 무게가 겹치지 않는다 */
const TITLE_BUTTON = `group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-xs leading-normal text-ash transition-colors duration-150 hover:text-ivory ${FOCUS_RING}`;

/**
 * 소리 on/off. HUD 메뉴 안에 있던 걸 밖으로 꺼냈다.
 *
 * 메뉴의 다른 항목(언어·캐릭터 시트·연락처·리셋)은 한 번 정하거나 드물게 쓰는 것들인데
 * 소리만 성격이 다르다. 옆에 사람이 오면 급하게, 그리고 반복해서 누른다. 게다가 이
 * 게임은 "시작하기"를 누르는 순간 BGM과 효과음이 같이 켜져서, 끄고 싶은 첫 순간이 곧
 * 플레이 첫 순간이다. 그때 화면에 오디오 단서가 하나도 없으면 안 된다.
 *
 * 메뉴 안에는 남기지 않는다. 같은 스위치가 두 군데 있으면 어느 쪽이 진짜인지 헷갈린다.
 * 타이틀 화면의 것(tone="title")은 방 HUD와 동시에 보이지 않으므로 예외다. 소리가 서사를
 * 끄는 게임인데 첫 화면에 소리 이야기가 없으면 무음으로 시작한 사람은 절반을 놓친다.
 */
export function SoundToggle({ tone = "hud" }: { tone?: SoundToggleTone }) {
  const { t } = useTranslation();
  const soundMuted = useMemoryRoomStore((state) => state.soundMuted);
  const setSoundMuted = useMemoryRoomStore((state) => state.setSoundMuted);
  const label = t(soundMuted ? "hud.soundOff" : "hud.soundOn");
  /** 켠 횟수. 켤 때마다 링이 다시 마운트되어 한 번 번진다. 끌 때는 아무것도 번지지 않는다 */
  const [pulseKey, setPulseKey] = useState(0);

  const toggle = () => {
    // 켤 때만 소리를 낸다. 끄는 순간 소리가 나면 안 꺼진 것처럼 들린다.
    // 엔진의 음소거는 스토어 값을 effect가 뒤늦게 옮기므로 여기서 먼저 풀어야 이 소리가 난다
    if (soundMuted) {
      setAudioMuted(false);
      playSound("select");
      setPulseKey((key) => key + 1);
    }
    setSoundMuted(!soundMuted);
  };

  if (tone === "title") {
    return (
      <button
        type="button"
        aria-pressed={!soundMuted}
        aria-label={t("titleScreen.soundLabel")}
        onPointerEnter={playHoverSound}
        onClick={toggle}
        className={TITLE_BUTTON}
      >
        {/* 상태는 키캡으로: 조작 줄의 다른 캡(클릭·WASD·E)과 같은 "누르는 것"으로 읽힌다 */}
        <span
          className={`${KEYCAP_CLASS} gap-1 transition-colors duration-150 group-hover:border-memory ${
            soundMuted ? "text-ash" : ""
          }`}
        >
          {soundMuted ? (
            <SpeakerSimpleSlash size="1.1em" weight="bold" aria-hidden />
          ) : (
            <SpeakerSimpleHigh size="1.1em" weight="bold" aria-hidden />
          )}
          {t(soundMuted ? "titleScreen.soundStateOff" : "titleScreen.soundStateOn")}
        </span>
        <span className="break-ko">{t("titleScreen.soundHint")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={!soundMuted}
      aria-label={label}
      onPointerEnter={playHoverSound}
      title={label}
      onClick={toggle}
      // 꺼져 있을 때 글자색을 죽인다. 빗금 아이콘만으로도 읽히지만, 작은 아이콘 하나가
      // 유일한 표시라 상태를 색으로도 한 번 더 말해 준다.
      className={`relative ${HUD_ICON_BUTTON} ${soundMuted ? "text-ash" : ""}`}
    >
      {pulseKey > 0 && (
        <span
          key={pulseKey}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-sound-pulse rounded-full border border-memory"
        />
      )}
      {soundMuted ? (
        <SpeakerSimpleSlash size="1.25em" weight="bold" />
      ) : (
        <SpeakerSimpleHigh size="1.25em" weight="bold" />
      )}
    </button>
  );
}
