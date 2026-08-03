"use client";

import { useEffect } from "react";
import { ASSETS } from "@/lib/assets";
import { useMemoryRoomStore } from "@/store/memory-room";
import { disposeAudio as disposeEngine, playSound, setAudioMuted, unlockAudio } from "./engine";
import { disposeMusic, setMusicDuck, setMusicLevel, startMusic, stopMusic } from "./music";

export { playSound, setAudioMuted, setAudioVolume, unlockAudio } from "./engine";
export { setMusicDuck, setMusicLevel, startMusic, stopMusic } from "./music";
export { musicCutoff, musicVolume } from "./music-curve";
export type { VoiceId } from "./voices";

/** BGM까지 함께 정리한다 — 컨텍스트를 닫기 전에 소스를 끊어야 한다. */
export function disposeAudio() {
  disposeMusic();
  disposeEngine();
}

/**
 * 스토어의 음소거 설정을 오디오 엔진에 이어 붙이고, 첫 사용자 제스처에서
 * AudioContext를 깨운다. 앱에 한 번만 마운트한다.
 *
 * 자동재생 정책 때문에 제스처 전에는 컨텍스트를 만들 수 없다 — 만들어도 suspended로
 * 시작해 아무 소리도 안 난다. 그래서 pointerdown/keydown을 한 번만 듣는다.
 */
export function useAudioRuntime() {
  const muted = useMemoryRoomStore((state) => state.soundMuted);

  useEffect(() => {
    setAudioMuted(muted);
  }, [muted]);

  // 수집은 대사 끝·미니게임 성공 등 여러 경로로 일어난다. 호출부마다 소리를 박는
  // 대신 스토어 변화를 한곳에서 듣는다.
  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        if (state.collected.length > previous.collected.length) playSound("collect");
      }),
    [],
  );

  useEffect(() => {
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);
}

/**
 * BGM을 눌러두는 정도. 0이면 무음, 1이면 평소.
 *
 * 대사와 미니게임은 눌러야 하는 깊이가 다르다. VN이라 대사창이 떠 있는 시간이
 * 길어서, 대사에서 깊게 누르면 게임 대부분의 시간 동안 BGM이 사라진 것처럼 들린다
 * — 비켜서기만 할 만큼만 누른다. 반대로 미니게임은 효과음이 주인공인 구간이라
 * 거의 비운다. 끝나고 방으로 돌아올 때 음악이 다시 드는 것이 곧 연출이 된다.
 */
const DIALOGUE_DUCK = 0.72;
const MINIGAME_DUCK = 0.18;

/**
 * 방 BGM을 방 밝기에 물린다. 곡은 하나뿐이고, V자 감정선은 로우패스가 닫혔다
 * 열리며 표현된다 (docs/content-design.md 3장).
 *
 * `playing`이 처음 true가 되는 시점은 타이틀의 "시작하기" 클릭 직후라, 그 제스처로
 * 이미 AudioContext가 깨어 있다 (useAudioRuntime).
 */
export function useRoomMusic({
  playing,
  level,
  foreground,
}: {
  playing: boolean;
  level: number;
  /** 지금 화면의 주인공. BGM은 그 뒤로 물러난다. */
  foreground: "room" | "dialogue" | "minigame";
}) {
  useEffect(() => {
    if (!playing) {
      stopMusic();
      return;
    }
    startMusic(ASSETS.bgm.room);
  }, [playing]);

  useEffect(() => {
    setMusicLevel(level);
  }, [level]);

  useEffect(() => {
    if (foreground === "minigame") setMusicDuck(MINIGAME_DUCK);
    else if (foreground === "dialogue") setMusicDuck(DIALOGUE_DUCK);
    else setMusicDuck(1);
  }, [foreground]);
}

/** 이벤트 핸들러에서 부르기 좋은 형태 — `onClick={playing("select")}`. */
export function playing(id: Parameters<typeof playSound>[0]) {
  return () => playSound(id);
}
