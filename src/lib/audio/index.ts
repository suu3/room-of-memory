"use client";

import { useEffect } from "react";
import { ASSETS } from "@/lib/assets";
import { selectRadioSignaling, useMemoryRoomStore } from "@/store/memory-room";
import type { ResultMusic } from "@/types/interaction";
import { disposeAudio as disposeEngine, playSound, setAudioMuted, unlockAudio } from "./engine";
import {
  disposeMusic,
  setMusicDuck,
  setMusicLevel,
  setMusicTrim,
  startMusic,
  startOverlayMusic,
  stopMusic,
  stopOverlayMusic,
} from "./music";
import { preloadSamples } from "./samples";

export {
  type NoiseBed,
  type PlayOptions,
  playSound,
  playTone,
  setAudioMuted,
  setAudioVolume,
  startNoiseBed,
  unlockAudio,
} from "./engine";
export {
  type MusicTrack,
  setMusicDuck,
  setMusicLevel,
  setMusicTrim,
  startCueMusic,
  startMusic,
  startOverlayMusic,
  stopCueMusic,
  stopMusic,
  stopOverlayMusic,
} from "./music";
export { musicCutoff, musicReverb, musicVolume } from "./music-curve";
export { preloadSamples } from "./samples";
export type { VoiceId } from "./voices";

/** BGM까지 함께 정리한다. 컨텍스트를 닫기 전에 소스를 끊어야 한다. */
export function disposeAudio() {
  disposeMusic();
  disposeEngine();
}

/**
 * 스토어의 음소거 설정을 오디오 엔진에 이어 붙이고, 첫 사용자 제스처에서
 * AudioContext를 깨운다. 앱에 한 번만 마운트한다.
 *
 * 자동재생 정책 때문에 제스처 전에는 컨텍스트를 만들 수 없다. 만들어도 suspended로
 * 시작해 아무 소리도 안 난다. 그래서 첫 입력을 듣는다. pointerdown만으로는 부족하다:
 * 손가락의 pointerdown은 브라우저가 "사용자 활성화"로 치지 않아 resume이 거부된다.
 * pointerup·click까지 들어야 폰에서 첫 탭에 깨어난다.
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
    /*
     * 깨우는 김에 실물 효과음 파일을 받아 둔다. 미트 소리는 방송 첫 컷이 뜨자마자, 스위치는
     * 인트로 첫 조작에 울려서 그때 받기 시작하면 첫 재생은 합성 대역으로 나간다.
     * 클릭·뽁은 첫 화면부터 운다. 전부 합쳐 수십 KB라 미리 받아도 부담이 없다.
     */
    const wake = () => {
      unlockAudio();
      preloadSamples(["select", "open", "mittTap", "doorOpen", "lightSwitch", "computerBoot"]);
    };
    const events = ["pointerdown", "pointerup", "click", "keydown"] as const;
    for (const type of events) window.addEventListener(type, wake, { once: true });
    return () => {
      for (const type of events) window.removeEventListener(type, wake);
    };
  }, []);
}

/**
 * BGM을 눌러두는 정도. 0이면 무음, 1이면 평소.
 *
 * 대사와 미니게임은 눌러야 하는 깊이가 다르다. VN이라 대사창이 떠 있는 시간이
 * 길어서, 대사에서 깊게 누르면 게임 대부분의 시간 동안 BGM이 사라진 것처럼 들린다.
 * 비켜서기만 할 만큼만 누른다. 미니게임은 효과음이 주인공이라 더 깊이 누르되,
 * 0.18까지 내렸더니 눌린 게 아니라 꺼진 것처럼 들렸다. 미니게임은 몇 분씩 이어지는
 * 구간이라 그 사이 방이 통째로 조용해진다. 뒤에서 곡이 계속 돌고 있다는 건
 * 남겨 두고, 앞자리만 효과음에 내준다.
 */
const DIALOGUE_DUCK = 0.72;
const MINIGAME_DUCK = 0.42;

/** 바퀴마다 도는 곡(후보 목록). 2바퀴 곡이 아직 없으면 1바퀴 곡이 그대로 이어진다. */
const ROUND_TRACK = { 1: ASSETS.bgm.room, 2: ASSETS.bgm.roomSecondLight } as const;

/**
 * 곡마다 다른 녹음 레벨을 맞추는 보정 (1=파일 그대로).
 *
 * 음량 곡선은 밝기만 보고 곡이 몇 dB로 녹음됐는지는 모른다. 지금 두 곡은
 * 1바퀴 −17.7 LUFS / 2바퀴 −15.1 LUFS로 2.6 LU 벌어져 있어서, 곡선에 같은 값을
 * 넣어도 1바퀴가 그만큼 작게 들렸다. 조용한 쪽을 끌어올려 출발선을 맞춘다
 * (2.6 LU ≒ ×1.35).
 *
 * 곡을 바꾸면 `pnpm audio:bgm`이 찍어 주는 LUFS로 이 값을 다시 잡는다.
 */
const ROUND_TRIM = { 1: 1.35, 2: 1 } as const;

/** 결과 대사에 걸 수 있는 곡의 파일 (content/memories.yaml의 resultMusic). */
const RESULT_MUSIC_TRACK: Record<ResultMusic, string> = { title: ASSETS.bgm.title };

/**
 * 결과 대사 위의 곡 음량. 대사창 아래라 방 곡을 대사만큼 누른 자리(밝은 방 곡 ×
 * DIALOGUE_DUCK)에 맞춘다. 타이틀에서는 원음(1)으로 틀지만, 여기서 그대로 틀면 방 곡이
 * 비켜난 자리에 곡이 갑자기 앞으로 튀어나온다.
 */
const RESULT_MUSIC_VOLUME = 0.3;

/**
 * 방 BGM을 방 밝기와 바퀴에 물린다.
 *
 * 바퀴마다 곡이 다르고(1바퀴 발랄 → 2바퀴 따뜻), 그 안에서 밝기가 컷오프·음량·
 * 리버브를 움직인다. V자 감정선이 곡선 하나로 두 곡에 걸린다
 * (docs/content-design.md 8장).
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
  resultMusic,
}: {
  playing: boolean;
  /** 지금 몇 바퀴인가. 곡을 고르는 유일한 기준이다. */
  phase: 1 | 2;
  level: number;
  /** 지금 화면의 주인공. BGM은 그 뒤로 물러난다. */
  foreground: "room" | "dialogue" | "minigame";
  /** 결과 대사 동안 방 곡 대신 드는 곡. 방 곡은 멈추지 않고 비켜 있다가 흐르던 자리로 돌아온다. */
  resultMusic: ResultMusic | null;
}) {
  useEffect(() => {
    if (!playing) {
      stopMusic();
      return;
    }
    // 트림을 먼저 세운다. 곡이 올라오면서 바로 맞는 레벨로 페이드인해야 한다
    setMusicTrim(ROUND_TRIM[phase]);
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

  useEffect(() => {
    if (!resultMusic) return;
    // 타이틀 곡은 루프를 접어 구웠다 (TitleScreen의 startCueMusic과 같은 버퍼를 쓴다)
    startOverlayMusic(RESULT_MUSIC_TRACK[resultMusic], {
      fold: true,
      volume: RESULT_MUSIC_VOLUME,
    });
    return () => stopOverlayMusic();
  }, [resultMusic]);
}

/** 이벤트 핸들러에서 부르기 좋은 형태: `onClick={playing("select")}`. */
export function playing(id: Parameters<typeof playSound>[0]) {
  return () => playSound(id);
}
