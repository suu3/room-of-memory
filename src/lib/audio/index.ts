"use client";

import { useEffect } from "react";
import { ASSETS } from "@/lib/assets";
import { selectRadioSignaling, useMemoryRoomStore } from "@/store/memory-room";
import { disposeAudio as disposeEngine, playSound, setAudioMuted, unlockAudio } from "./engine";
import { disposeMusic, setMusicDuck, setMusicLevel, startMusic, stopMusic } from "./music";

export {
  type NoiseBed,
  playSound,
  setAudioMuted,
  setAudioVolume,
  startNoiseBed,
  unlockAudio,
} from "./engine";
export { type MusicTrack, setMusicDuck, setMusicLevel, startMusic, stopMusic } from "./music";
export { musicCutoff, musicReverb, musicVolume } from "./music-curve";
export { preloadSamples } from "./samples";
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
        /*
         * 컷씬이 끝나고 방으로 돌아온 순간, 꺼져 있던 라디오가 저 혼자 깨어난다.
         * 도해가 무언가를 한 결과가 아니라 방에서 일어난 일이라, 소리도 클릭이
         * 아니라 상태 변화에 붙는다.
         */
        if (selectRadioSignaling(state) && !selectRadioSignaling(previous)) {
          playSound("radioWake");
        }
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

/** 바퀴마다 도는 곡(후보 목록). 2바퀴 곡이 아직 없으면 1바퀴 곡이 그대로 이어진다. */
const ROUND_TRACK = { 1: ASSETS.bgm.room, 2: ASSETS.bgm.roomSecondLight } as const;

/**
 * 방 BGM을 방 밝기와 바퀴에 물린다.
 *
 * 바퀴마다 곡이 다르고(1바퀴 발랄 → 2바퀴 따뜻), 그 안에서 밝기가 컷오프·음량·
 * 리버브를 움직인다 — V자 감정선이 곡선 하나로 두 곡에 걸린다
 * (docs/content-design.md 3장).
 *
 * 곡이 갈리는 지점은 전환 컷씬이다. 컷씬 동안은 `playing`이 false라 곡이 멎어
 * 있고, 방으로 돌아올 때 새 곡이 정적 위에 처음 든다.
 *
 * `playing`이 처음 true가 되는 시점은 타이틀의 "시작하기" 클릭 직후라, 그 제스처로
 * 이미 AudioContext가 깨어 있다 (useAudioRuntime).
 */
export function useRoomMusic({
  playing,
  phase,
  level,
  foreground,
}: {
  playing: boolean;
  /** 지금 몇 바퀴인가. 곡을 고르는 유일한 기준이다. */
  phase: 1 | 2;
  level: number;
  /** 지금 화면의 주인공. BGM은 그 뒤로 물러난다. */
  foreground: "room" | "dialogue" | "minigame";
}) {
  useEffect(() => {
    if (!playing) {
      stopMusic();
      return;
    }
    startMusic(ROUND_TRACK[phase]);
  }, [playing, phase]);

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
