/**
 * 사운드 한 종류의 "악보". 오디오 파일 없이 Web Audio로 합성하기 위한 순수 데이터라
 * 브라우저 없이도 테스트할 수 있다 (실제 소리는 engine.ts가 만든다).
 *
 * 파일을 안 쓰는 이유: 이 프로젝트는 에셋을 전부 리포에 커밋하는데(외부 스토리지 없음),
 * UI 효과음 몇 개 때문에 수백 KB를 넣을 이유가 없다. 짧은 톤·노이즈는 코드가 더 싸다.
 */

export type VoiceId =
  // 공용 UI
  | "hover"
  | "select"
  | "collect"
  | "flip"
  | "wipe"
  | "deny"
  | "success"
  | "fail"
  | "open"
  | "close"
  // 대사창: 글자가 찍히고, 줄이 넘어가는 소리
  | "type"
  | "typeRadio"
  | "typeSkip"
  | "advance"
  // 재생 화면(컷씬·다시보기): 그림이 서고, 컷이 바뀌는 소리
  | "reelStart"
  | "cutChange"
  // 미니게임 전용: 공용 보이스를 돌려쓰면 손맛이 안 나는 자리들만 따로 판다.
  | "batHit"
  | "swingMiss"
  | "punch"
  | "punchHeavy"
  | "feint"
  | "hurt"
  | "guard"
  | "radioLock"
  | "radioCut"
  | "radioWake"
  | "phoneBeep"
  // 방 안의 곁가지 인터랙션 (서랍·의자)
  | "drawer"
  | "chairDrag"
  | "sit";

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
  /** 짧은 노이즈 버스트: 종이 넘김·먼지 같은 마찰음에 쓴다. */
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
 * 아무리 짧게 잘라도 "코인 먹는 소리"로 들렸다. 재난 뒤 빈방을 도는 게임의
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
  /** 호버: 있는 듯 없는 듯. 계속 울리는 소리라 제일 작다. */
  hover: {
    tones: [{ from: E4, waveform: "sine", delay: 0, duration: 0.07, gain: 0.1 }],
  },
  /** 클릭/조사 시작. 올라가면 들뜨므로 내려가는 글라이드로 둔다. */
  select: {
    tones: [{ from: A4, to: E4, waveform: "sine", delay: 0, duration: 0.13, gain: 0.3 }],
  },
  /**
   * 기억 수집. 이 게임에서 되찾는 건 좋기만 한 기억이 아니라서 밝게 해소하지
   * 않는다. 5도로 올라갔다 4도에 걸쳐 두면 "찾았다"까지만 말하고 멈춘다.
   */
  collect: {
    tones: [pluck(D4, 0), pluck(A4, 0.09), pluck(C5, 0.18, 0.3)],
  },
  /**
   * 종이 넘김: 노이즈뿐이다. 원래는 낮은 사인 글라이드(320→190)를 종이의 "몸통"으로
   * 같이 깔았는데, 마찰음보다 그 톤이 먼저 들려 종이가 아니라 "퉁" 하는 타격음으로
   * 읽혔다. 종이 소리의 정체는 음정이 아니라 마찰이다. 살짝 부풀었다(들리는 순간)
   * 바로 잦아드는(넘어가는 순간) 밝은 노이즈 한 번이 정확하다.
   */
  flip: {
    tones: [],
    noise: { delay: 0, duration: 0.16, gain: 0.34, highpass: 1100, lowpass: 8500, attack: 0.045 },
  },
  /**
   * 헝겊으로 유리를 문지르는 소리. flip과 같은 노이즈 기반이지만 성격이 반대다.
   * 종이 넘김은 짧고 밝게 튀고(highpass 1800, 즉발), 닦기는 대역을 좁혀 둔하게 만든 뒤
   * 천천히 부풀렸다 사그라든다. 톤은 손이 유리에 닿는 몸통만 아주 작게 깐다.
   */
  wipe: {
    tones: [{ from: 220, to: 180, waveform: "sine", delay: 0, duration: 0.2, gain: 0.05 }],
    // 한 판에 스무 번 울리는 소리다. 한 번 듣기 좋은 크기로 맞추면 스무 번째에는
    // 시끄럽다. 반복 횟수만큼 깎아 둔다.
    noise: { delay: 0, duration: 0.3, gain: 0.15, highpass: 600, lowpass: 3200, attack: 0.09 },
  },
  /** 안 되는 걸 눌렀을 때. 낮게 한 번. */
  deny: {
    tones: [{ from: 196, to: 165, waveform: "square", delay: 0, duration: 0.12, gain: 0.18 }],
  },
  /** 미니게임 성공. 수집(collect)보다 한 음 더 가되 팡파르가 되지는 않는다. */
  success: {
    tones: [pluck(A3, 0), pluck(E4, 0.09), pluck(A4, 0.18), pluck(D5, 0.3, 0.26)],
  },
  /** 미니게임 실패: 벌 주는 소리가 아니라 가라앉는 소리로. */
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

  /*
   * 대사창. VN이라 이 소리들이 게임에서 가장 자주 울린다. 한 번 듣기 좋은 크기가
   * 아니라 천 번 들어도 안 거슬리는 크기로 맞춘다 (wipe와 같은 이유).
   */

  /**
   * 글자가 찍히는 틱. 타자기의 "탁"이 아니라 목소리의 자리표시다: 음정이 있어야
   * 화자마다 높이를 달리해 "누가 말하는지"가 귀로도 갈린다 (DialogueBox의 SPEAKER_PITCH).
   * 어택만 남기고 바로 끊는다. 꼬리가 있으면 초당 일곱 번 울릴 때 웅웅거리는 띠가 된다.
   */
  type: {
    tones: [{ from: A3, to: 196, waveform: "sine", delay: 0, duration: 0.045, gain: 0.12 }],
  },
  /**
   * 라디오 너머의 목소리(broadcast·signal)가 찍히는 틱. 사람이 아니라 전파라 음정이
   * 없다. 라디오 잡음과 같은 대역의 노이즈를 짧게 끊어 "지직거리며 들어오는 글"로.
   */
  typeRadio: {
    tones: [],
    noise: { delay: 0, duration: 0.035, gain: 0.13, highpass: 1600, lowpass: 4800 },
  },
  /**
   * 타자 연출을 건너뛰어 남은 글이 한꺼번에 채워지는 순간. 틱 여러 개가 뭉쳐 떨어진
   * 것처럼, 같은 음에서 짧은 마찰 한 번과 함께 내려앉는다.
   */
  typeSkip: {
    tones: [{ from: A3, to: 165, waveform: "sine", delay: 0, duration: 0.08, gain: 0.14 }],
    noise: { delay: 0, duration: 0.06, gain: 0.12, highpass: 1200, lowpass: 5200 },
  },
  /**
   * 다음 줄로. select(조사 시작)보다 작고 낮다: 뭔가를 고른 게 아니라 페이지를 넘긴
   * 것이다. 내려가는 글라이드는 UI 보이스 전체의 약속을 따른다.
   */
  advance: {
    tones: [{ from: E4, to: D4, waveform: "sine", delay: 0, duration: 0.09, gain: 0.16 }],
  },

  /**
   * 재생 화면에 첫 그림이 서는 순간. 3D 방에서 2D 그림으로 넘어왔다는 걸 귀로 알린다.
   * 영사기가 돌기 시작하듯 낮은 몸통이 한 번 걸리고, 그 위로 테이프 히스가 부풀며
   * 열린다. 이 히스의 꼬리를 PlaybackScene의 바닥 잡음이 그대로 이어받는다.
   */
  reelStart: {
    tones: [{ from: 70, to: 110, waveform: "sine", delay: 0, duration: 0.22, gain: 0.16 }],
    noise: { delay: 0.04, duration: 0.5, gain: 0.12, highpass: 2200, lowpass: 9000, attack: 0.2 },
  },
  /**
   * 컷이 바뀐다. 슬라이드 영사기의 셔터처럼 짧고 마른 "찰칵" 한 번. flip(종이)보다
   * 대역이 높고 훨씬 짧다: 넘기는 게 아니라 갈아 끼우는 소리다.
   */
  cutChange: {
    tones: [{ from: 140, to: 90, waveform: "triangle", delay: 0.015, duration: 0.05, gain: 0.12 }],
    noise: { delay: 0, duration: 0.05, gain: 0.2, highpass: 2800, lowpass: 9500 },
  },

  /*
   * 여기부터 미니게임 전용. 위쪽 UI 보이스는 라단조 5음계로 "말을 거는" 소리지만,
   * 아래는 대부분 무조(無調)다. 배트도 주먹도 음정을 갖지 않는다. 대신 노이즈의
   * 대역과 톤 몸통의 깊이로 재질을 나눈다.
   */

  /**
   * 배트가 공을 맞히는 순간. 나무 몸통(빠르게 떨어지는 낮은 톤)과 크랙(짧고 밝은
   * 노이즈)을 겹친다. 진짜 나무 소리는 합성으로 끝까지 못 가지만, 이 게임의 배트는
   * 실사가 아니라 도트 스프라이트라 여기서 멈추는 편이 오히려 맞는다.
   */
  batHit: {
    tones: [{ from: 180, to: 90, waveform: "triangle", delay: 0, duration: 0.11, gain: 0.26 }],
    noise: { delay: 0, duration: 0.09, gain: 0.34, highpass: 2400 },
  },
  /** 헛스윙: 맞은 소리가 아니라 지나간 소리. 부풀었다 사그라드는 바람만 남긴다. */
  swingMiss: {
    tones: [{ from: 140, to: 110, waveform: "sine", delay: 0, duration: 0.18, gain: 0.07 }],
    noise: { delay: 0, duration: 0.22, gain: 0.2, highpass: 900, lowpass: 5200, attack: 0.08 },
  },
  /** 주먹이 꽂힌다. batHit과 같은 구조지만 대역을 낮게 좁혀 나무가 아니라 몸으로. */
  punch: {
    tones: [{ from: 150, to: 70, waveform: "sine", delay: 0, duration: 0.13, gain: 0.3 }],
    noise: { delay: 0, duration: 0.07, gain: 0.26, highpass: 700, lowpass: 3800 },
  },
  /**
   * 간파해서 꽂은 한 방. punch를 더 낮게, 더 두껍게: 같은 주먹이 아니라 더 깊이
   * 들어갔다는 걸 대미지 숫자가 아니라 몸통 울림으로 먼저 알린다.
   */
  punchHeavy: {
    tones: [
      { from: 170, to: 55, waveform: "sine", delay: 0, duration: 0.2, gain: 0.34 },
      { from: 110, to: 44, waveform: "triangle", delay: 0.02, duration: 0.26, gain: 0.2 },
    ],
    noise: { delay: 0, duration: 0.1, gain: 0.3, highpass: 600, lowpass: 4200 },
  },
  /**
   * 상대가 예고 도중에 자세를 바꾸는 순간. 타격이 아니라 신호라 위로 튄다.
   * 아래로 떨어지는 소리는 전부 "맞았다"로 예약돼 있어서 헷갈리면 안 된다.
   */
  feint: {
    tones: [{ from: 420, to: 620, waveform: "square", delay: 0, duration: 0.07, gain: 0.14 }],
    noise: { delay: 0, duration: 0.06, gain: 0.16, highpass: 2600 },
  },
  /** 맞았을 때. 임팩트 뒤에 숨이 빠지는 꼬리가 붙는 게 punch와의 차이다. */
  hurt: {
    tones: [
      { from: 130, to: 62, waveform: "triangle", delay: 0, duration: 0.16, gain: 0.28 },
      { from: A3, to: 165, waveform: "sine", delay: 0.08, duration: 0.22, gain: 0.14 },
    ],
    noise: { delay: 0, duration: 0.09, gain: 0.2, highpass: 500, lowpass: 2600 },
  },
  /** 서로 막았을 때. 들어가지 않고 부딪히기만 하므로 짧고 딱딱하게 끊는다. */
  guard: {
    tones: [{ from: 330, to: 247, waveform: "square", delay: 0, duration: 0.06, gain: 0.16 }],
    noise: { delay: 0, duration: 0.05, gain: 0.22, highpass: 3200 },
  },
  /** 주파수가 잡히는 순간. 잡음 속에서 신호가 떠오르듯 올라갔다 그 음에 머문다. */
  radioLock: {
    tones: [
      { from: D4, to: A4, waveform: "sine", delay: 0, duration: 0.14, gain: 0.24 },
      { from: A4, waveform: "sine", delay: 0.12, duration: 0.22, gain: 0.18 },
    ],
  },
  /**
   * 방송이 끊기는 순간. 지직 한 번(노이즈)에 전원이 빠지는 하강음을 붙이고
   * 0.3초 안에 전부 끝낸다. 여운을 남기면 "뚝"이 아니라 "서서히"가 된다.
   * 뒤에 올 정적이 이 소리의 진짜 내용이다.
   */
  radioCut: {
    tones: [{ from: 240, to: 60, waveform: "sawtooth", delay: 0.04, duration: 0.16, gain: 0.2 }],
    noise: { delay: 0, duration: 0.14, gain: 0.3, highpass: 900, lowpass: 6000 },
  },
  /**
   * 꺼져 있던 라디오가 저 혼자 깨어나는 소리. 끊길 때의 하강음을 뒤집어 올리되
   * 훨씬 작게: 도해를 놀래키는 소리가 아니라 방 건너에서 겨우 들리는 기척이다.
   */
  radioWake: {
    tones: [{ from: 90, to: 210, waveform: "sawtooth", delay: 0.02, duration: 0.12, gain: 0.08 }],
    noise: { delay: 0, duration: 0.22, gain: 0.16, highpass: 1400, lowpass: 5200, attack: 0.04 },
  },
  /**
   * 옛날 폰 문자 알림. 그 시절 알림음은 대개 사각파 두 방이었고, 지금 귀에 거슬리는
   * 그 얇음이 곧 시대감이다. 부드럽게 다듬으면 오히려 폰이 아니게 된다.
   */
  phoneBeep: {
    tones: [
      { from: C5, waveform: "square", delay: 0, duration: 0.07, gain: 0.16 },
      { from: C5, waveform: "square", delay: 0.11, duration: 0.07, gain: 0.16 },
    ],
  },
  /**
   * 서랍이 밀려 나오는 소리. 나무가 나무 위를 미끄러지는 마찰(노이즈)에, 끝까지
   * 나왔을 때의 둔한 멎음(0.22초 뒤 낮은 톤)을 붙였다. 멎는 소리가 없으면 서랍이
   * 계속 나가는 것처럼 들린다.
   */
  drawer: {
    tones: [
      { from: 150, to: 120, waveform: "sine", delay: 0, duration: 0.2, gain: 0.1 },
      { from: 110, to: 88, waveform: "triangle", delay: 0.22, duration: 0.09, gain: 0.14 },
    ],
    noise: { delay: 0, duration: 0.26, gain: 0.16, highpass: 400, lowpass: 2600, attack: 0.05 },
  },
  /**
   * 의자를 바닥에 끄는 소리. 서랍보다 대역이 낮고 길다. 나무 서랍은 미끄러지고
   * 의자 다리는 바닥을 긁는다. 방 안에서 나는 곁가지 소리라 조사·수집음보다 작다.
   */
  chairDrag: {
    tones: [{ from: 90, to: 70, waveform: "sine", delay: 0, duration: 0.3, gain: 0.09 }],
    noise: { delay: 0, duration: 0.34, gain: 0.14, highpass: 250, lowpass: 1800, attack: 0.07 },
  },
  /**
   * 자리에 앉고 일어서는 소리. 의자 끄는 소리(chairDrag)와 달리 바닥이 아니라 몸이
   * 내는 소리라, 마찰은 짧게 스치고 낮은 톤이 한 번 눌린다. 쿠션이 꺼지는 몫이다.
   */
  sit: {
    tones: [{ from: 120, to: 82, waveform: "sine", delay: 0, duration: 0.16, gain: 0.11 }],
    noise: { delay: 0, duration: 0.2, gain: 0.13, highpass: 300, lowpass: 1400, attack: 0.06 },
  },
};

/**
 * 보이스 전체를 위아래로 옮긴다. 같은 소리가 연달아 나는 자리(사진 닦기처럼
 * 진행률마다 울리는 것)에서 매번 똑같이 울리면 재생이 아니라 반복으로 들린다.
 *
 * 게인은 건드리지 않는다. 음높이만 흔들어야 "같은 동작"으로 남는다. 노이즈의
 * 필터 주파수까지 같이 옮겨야 재질이 따라온다(대역만 고정되면 음정만 뜬 것처럼 들린다).
 */
export function transposeVoice(voice: Voice, ratio: number): Voice {
  if (ratio === 1) return voice;
  const scale = (value: number) => value * ratio;
  return {
    tones: voice.tones.map((tone) => ({
      ...tone,
      from: scale(tone.from),
      to: tone.to === undefined ? undefined : scale(tone.to),
    })),
    noise: voice.noise && {
      ...voice.noise,
      highpass: scale(voice.noise.highpass),
      lowpass: voice.noise.lowpass === undefined ? undefined : scale(voice.noise.lowpass),
    },
  };
}

/** 소리 하나가 완전히 끝나는 데 걸리는 시간(초). 스케줄 정리에 쓴다. */
export function voiceDuration(voice: Voice): number {
  const toneEnd = voice.tones.reduce((end, tone) => Math.max(end, tone.delay + tone.duration), 0);
  const noiseEnd = voice.noise ? voice.noise.delay + voice.noise.duration : 0;
  return Math.max(toneEnd, noiseEnd);
}
