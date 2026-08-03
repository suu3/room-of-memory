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
  | "wipe"
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
  noise?: {
    delay: number;
    duration: number;
    gain: number;
    highpass: number;
    /** 위쪽을 잘라내면 밝은 "쉭" 대신 둔한 "쓱"이 된다. 없으면 안 자른다. */
    lowpass?: number;
    /** 최대 음량까지 올라가는 시간(초). 기본값은 즉발에 가깝다. */
    attack?: number;
  };
}

/**
 * 음이름 대신 쓰는 값들. 라단조 5음계라 어떤 순서로 울려도 부딪히지 않는다.
 *
 * 원래는 한 옥타브 위(C5~C6)의 다장조였는데, 그 음역의 삼각파 아르페지오는
 * 아무리 짧게 잘라도 "코인 먹는 소리"로 들렸다 — 재난 뒤 빈방을 도는 게임의
 * 톤과 정면으로 어긋난다. 옥타브를 내리고 장3도를 뺐다.
 */
const A3 = 220;
const D4 = 293.66;
const E4 = 329.63;
const A4 = 440;
const C5 = 523.25;
const D5 = 587.33;

/**
 * 삼각파는 배음이 많아 밝고 장난감처럼 들린다. 사인파로 바꾸고 꼬리를 늘려
 * 튕기는 소리가 아니라 울리다 잦아드는 소리로 만든다.
 */
function pluck(frequency: number, delay: number, gain = 0.34): Tone {
  return { from: frequency, waveform: "sine", delay, duration: 0.26, gain };
}

export const VOICES: Record<VoiceId, Voice> = {
  /** 호버 — 있는 듯 없는 듯. 계속 울리는 소리라 제일 작다. */
  hover: {
    tones: [{ from: E4, waveform: "sine", delay: 0, duration: 0.07, gain: 0.1 }],
  },
  /** 클릭/조사 시작. 올라가면 들뜨므로 내려가는 글라이드로 둔다. */
  select: {
    tones: [{ from: A4, to: E4, waveform: "sine", delay: 0, duration: 0.13, gain: 0.3 }],
  },
  /**
   * 기억 수집. 이 게임에서 되찾는 건 좋기만 한 기억이 아니라서 밝게 해소하지
   * 않는다 — 5도로 올라갔다 4도에 걸쳐 두면 "찾았다"까지만 말하고 멈춘다.
   */
  collect: {
    tones: [pluck(D4, 0), pluck(A4, 0.09), pluck(C5, 0.18, 0.3)],
  },
  /** 종이 넘김 — 톤보다 노이즈가 본체다. */
  flip: {
    tones: [{ from: 320, to: 190, waveform: "sine", delay: 0, duration: 0.09, gain: 0.14 }],
    noise: { delay: 0, duration: 0.13, gain: 0.3, highpass: 1800 },
  },
  /**
   * 헝겊으로 유리를 문지르는 소리. flip과 같은 노이즈 기반이지만 성격이 반대다 —
   * 종이 넘김은 짧고 밝게 튀고(highpass 1800, 즉발), 닦기는 대역을 좁혀 둔하게 만든 뒤
   * 천천히 부풀렸다 사그라든다. 톤은 손이 유리에 닿는 몸통만 아주 작게 깐다.
   */
  wipe: {
    tones: [{ from: 220, to: 180, waveform: "sine", delay: 0, duration: 0.2, gain: 0.08 }],
    noise: { delay: 0, duration: 0.3, gain: 0.26, highpass: 600, lowpass: 3200, attack: 0.09 },
  },
  /** 안 되는 걸 눌렀을 때. 낮게 한 번. */
  deny: {
    tones: [{ from: 196, to: 165, waveform: "square", delay: 0, duration: 0.12, gain: 0.18 }],
  },
  /** 미니게임 성공. 수집(collect)보다 한 음 더 가되 팡파르가 되지는 않는다. */
  success: {
    tones: [pluck(A3, 0), pluck(E4, 0.09), pluck(A4, 0.18), pluck(D5, 0.3, 0.26)],
  },
  /** 미니게임 실패 — 벌 주는 소리가 아니라 가라앉는 소리로. */
  fail: {
    tones: [
      { from: A4, to: A3, waveform: "triangle", delay: 0, duration: 0.34, gain: 0.3 },
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
