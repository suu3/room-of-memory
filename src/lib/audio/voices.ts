/**
 * 사운드 한 종류의 "악보". 오디오 파일 없이 Web Audio로 합성하기 위한 순수 데이터라
 * 브라우저 없이도 테스트할 수 있다 (실제 소리는 engine.ts가 만든다).
 *
 * 파일을 안 쓰는 이유: 이 프로젝트는 에셋을 전부 리포에 커밋하는데(외부 스토리지 없음),
 * UI 효과음 몇 개 때문에 수백 KB를 넣을 이유가 없다. 짧은 톤·노이즈는 코드가 더 싸다.
 */

export type VoiceId =
  | "hover"
  | "select"
  | "collect"
  | "flip"
  | "deny"
  | "success"
  | "fail"
  | "open"
  | "close";

export type Waveform = "sine" | "triangle" | "square" | "sawtooth";

export interface Tone {
  /** 시작 주파수(Hz). */
  from: number;
  /** 끝 주파수(Hz). 같으면 글라이드 없음. */
  to?: number;
  waveform: Waveform;
  /** 이 톤이 울리기 시작하는 시각(초, 소리 시작 기준). */
  delay: number;
  /** 지속 시간(초). */
  duration: number;
  /** 0~1. 전체 음량에 곱해진다. */
  gain: number;
}

export interface Voice {
  tones: Tone[];
  /** 짧은 노이즈 버스트 — 종이 넘김·먼지 같은 마찰음에 쓴다. */
  noise?: { delay: number; duration: number; gain: number; highpass: number };
}

/** 음이름 대신 쓰는 값들. 오단조 5음계라 어떤 순서로 울려도 부딪히지 않는다. */
const A4 = 440;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;

function pluck(frequency: number, delay: number, gain = 0.5): Tone {
  return { from: frequency, waveform: "triangle", delay, duration: 0.16, gain };
}

export const VOICES: Record<VoiceId, Voice> = {
  /** 호버 — 있는 듯 없는 듯. 계속 울리는 소리라 제일 작다. */
  hover: {
    tones: [{ from: G5, waveform: "sine", delay: 0, duration: 0.07, gain: 0.16 }],
  },
  /** 클릭/조사 시작. */
  select: {
    tones: [{ from: D5, to: A5, waveform: "triangle", delay: 0, duration: 0.11, gain: 0.42 }],
  },
  /** 기억 수집 — 이 게임에서 제일 기분 좋아야 하는 소리라 3음 아르페지오. */
  collect: {
    tones: [pluck(C5, 0), pluck(E5, 0.07), pluck(G5, 0.14), pluck(C6, 0.21, 0.4)],
  },
  /** 종이 넘김 — 톤보다 노이즈가 본체다. */
  flip: {
    tones: [{ from: 320, to: 190, waveform: "sine", delay: 0, duration: 0.09, gain: 0.14 }],
    noise: { delay: 0, duration: 0.13, gain: 0.3, highpass: 1800 },
  },
  /** 안 되는 걸 눌렀을 때. 낮게 한 번. */
  deny: {
    tones: [{ from: 196, to: 165, waveform: "square", delay: 0, duration: 0.12, gain: 0.18 }],
  },
  /** 미니게임 성공. */
  success: {
    tones: [pluck(E5, 0), pluck(G5, 0.08), pluck(C6, 0.16, 0.45), pluck(A5, 0.3, 0.28)],
  },
  /** 미니게임 실패 — 벌 주는 소리가 아니라 가라앉는 소리로. */
  fail: {
    tones: [
      { from: A4, to: 220, waveform: "triangle", delay: 0, duration: 0.34, gain: 0.3 },
      { from: 330, to: 165, waveform: "sine", delay: 0.06, duration: 0.34, gain: 0.2 },
    ],
  },
  open: {
    tones: [{ from: 330, to: 494, waveform: "sine", delay: 0, duration: 0.13, gain: 0.26 }],
  },
  close: {
    tones: [{ from: 494, to: 294, waveform: "sine", delay: 0, duration: 0.12, gain: 0.24 }],
  },
};

/** 소리 하나가 완전히 끝나는 데 걸리는 시간(초). 스케줄 정리에 쓴다. */
export function voiceDuration(voice: Voice): number {
  const toneEnd = voice.tones.reduce((end, tone) => Math.max(end, tone.delay + tone.duration), 0);
  const noiseEnd = voice.noise ? voice.noise.delay + voice.noise.duration : 0;
  return Math.max(toneEnd, noiseEnd);
}
