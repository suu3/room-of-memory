"use client";

import { transposeVoice, VOICES, type Voice, type VoiceId, voiceDuration } from "./voices";

/**
 * Web Audio로 효과음을 합성해 재생한다. 기본적으로 오디오 파일이 없다. voices.ts의
 * 악보를 그때그때 오실레이터로 만든다. 파일이 등록된 보이스만 파일이 이긴다
 * (samples.ts 참고).
 *
 * AudioContext는 첫 사용자 제스처 전에는 만들지 않는다. 브라우저 자동재생 정책상
 * 제스처 없이 만들면 suspended 상태로 시작하고, 콘솔 경고만 남기고 아무 소리도 안 난다.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.7;
/** 같은 소리가 한 프레임에 여러 번 겹쳐 터지는 걸 막는다. */
const lastPlayedAt = new Map<VoiceId, number>();
const MIN_REPEAT_S = 0.04;

function ensureContext(): AudioContext | null {
  if (context) return context;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(context.destination);
  return context;
}

/** 짧은 화이트 노이즈 버퍼. 매번 만들지 않고 한 번만 만들어 돌려쓴다. */
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function scheduleVoice(ctx: AudioContext, output: GainNode, voice: Voice, startAt: number) {
  for (const tone of voice.tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const begin = startAt + tone.delay;
    const end = begin + tone.duration;

    oscillator.type = tone.waveform;
    oscillator.frequency.setValueAtTime(tone.from, begin);
    if (tone.to !== undefined && tone.to !== tone.from) {
      // 지수 램프는 0을 못 지나므로 주파수에만 쓴다 (양수 보장).
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    }

    // 딸깍 소리를 막으려면 0에서 올렸다가 0으로 내려야 한다.
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(tone.gain, begin + Math.min(0.012, tone.duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain).connect(output);
    oscillator.start(begin);
    oscillator.stop(end + 0.02);
  }

  if (!voice.noise) return;
  const { delay, duration, gain: noiseGain, highpass, lowpass, attack = 0.01 } = voice.noise;
  const source = ctx.createBufferSource();
  const highpassFilter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const begin = startAt + delay;
  const end = begin + duration;

  source.buffer = getNoiseBuffer(ctx);
  highpassFilter.type = "highpass";
  highpassFilter.frequency.value = highpass;

  // 위아래를 다 자르면 대역이 좁아져 마찰의 재질이 바뀐다 (종이 → 헝겊).
  let tail: AudioNode = highpassFilter;
  if (lowpass !== undefined) {
    const lowpassFilter = ctx.createBiquadFilter();
    lowpassFilter.type = "lowpass";
    lowpassFilter.frequency.value = lowpass;
    tail = tail.connect(lowpassFilter);
  }

  // 어택이 길면 "툭" 튀지 않고 부풀어 오른다. 감쇠 구간을 먹지 않게 절반으로 제한.
  gain.gain.setValueAtTime(0.0001, begin);
  gain.gain.exponentialRampToValueAtTime(noiseGain, begin + Math.min(attack, duration / 2));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  source.connect(highpassFilter);
  tail.connect(gain).connect(output);
  source.start(begin);
  source.stop(end + 0.02);
}

export interface PlayOptions {
  /**
   * 음높이를 매번 이 비율만큼 무작위로 흔든다 (0.08이면 ±8%). 같은 소리가 연달아
   * 나는 자리에서만 쓴다. 버튼처럼 한 번씩 울리는 소리는 흔들면 고장난 것처럼 들린다.
   */
  variation?: number;
  /**
   * 보이스 전체를 이 비율로 옮긴다 (1=그대로). variation과 곱해진다. 같은 소리를 높이만
   * 달리해 여러 뜻으로 쓰는 자리용이다: 대사 틱이 화자마다 다른 높이로 울린다.
   */
  pitch?: number;
}

/** 등록된 파일 샘플. 비어 있으면(기본) 전부 합성으로 간다. samples.ts 참고. */
const samples = new Map<VoiceId, AudioBuffer>();

/** samples.ts가 디코드를 끝낸 버퍼를 꽂아 넣는 통로. */
export function registerSample(id: VoiceId, buffer: AudioBuffer) {
  samples.set(id, buffer);
}

function playSample(ctx: AudioContext, output: GainNode, buffer: AudioBuffer, rate: number) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(output);
  source.start();
  source.onended = () => source.disconnect();
}

/** 소리 하나 재생. 컨텍스트가 아직 없으면(제스처 전) 조용히 넘어간다. */
export function playSound(id: VoiceId, options: PlayOptions = {}) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  // 탭을 다녀오면 suspended로 돌아와 있을 수 있다.
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const previous = lastPlayedAt.get(id) ?? -Infinity;
  if (now - previous < MIN_REPEAT_S) return;
  lastPlayedAt.set(id, now);

  const { variation = 0, pitch = 1 } = options;
  // 1을 중심으로 ±variation. 샘플에는 재생속도로, 합성에는 주파수 배율로 같은 값이 걸린다.
  const ratio = pitch * (variation > 0 ? 1 + (Math.random() * 2 - 1) * variation : 1);

  const sample = samples.get(id);
  if (sample) {
    playSample(ctx, master, sample, ratio);
    return;
  }
  scheduleVoice(ctx, master, transposeVoice(VOICES[id], ratio), now + 0.001);
}

/**
 * 음 하나를 그 높이로 울린다 (피아노 건반).
 *
 * VOICES를 못 쓰는 자리다. 저쪽은 id마다 음이 고정이고, 같은 id가 연달아 나면
 * MIN_REPEAT_S가 막는다. 건반은 **음높이가 곧 뜻**이고 같은 음을 연달아 누르는
 * 일도 흔해서(솔미미), 소리 이름이 아니라 주파수를 받는 통로가 따로 필요하다.
 *
 * 파형은 삼각파에 짧은 감쇠: 합성으로 피아노를 흉내 내는 대신 "음이 하나 울렸다"만
 * 정직하게 낸다. 감쇠가 길면 건반을 빨리 누를 때 음이 겹쳐 뭉갠다.
 */
export function playTone(frequency: number, { duration = 0.42, gain = 0.3 } = {}) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  if (ctx.state === "suspended") void ctx.resume();

  scheduleVoice(
    ctx,
    master,
    { tones: [{ from: frequency, waveform: "triangle", delay: 0, duration, gain }] },
    ctx.currentTime + 0.001,
  );
}

/**
 * 계속 깔리는 노이즈 층. 라디오 잡음처럼 "한 번 울리고 끝"이 아닌 소리는 Voice로
 * 못 만든다. Voice는 0.6초를 넘지 않는다는 계약이 걸려 있다(voices.test.ts).
 *
 * 필터드 화이트노이즈가 곧 정적이라, 이건 파일보다 합성이 유리한 몇 안 되는 소리다.
 * 파일이면 루프 이음새를 감춰야 하지만 노이즈는 애초에 이음새가 없다.
 */
export interface NoiseBed {
  /** 0이면 무음, 1이면 설정한 최대 음량. 뚝 끊기지 않게 완만히 따라간다. */
  setLevel(level: number): void;
  /**
   * 지금 울리고 있는 파형(시간 영역, -1~1)을 target에 복사한다. `analyser` 옵션 없이
   * 만든 베드나 멎은 베드는 false를 돌려주고 target을 건드리지 않는다.
   *
   * 게인 뒤에서 뽑으므로 setLevel을 따라 진폭이 커지고 작아진다. 마스터 앞이라
   * 음소거 중에도 파형은 살아 있다: 소리를 끈 사람에게도 잡음이 걷히는 게 보여야 한다.
   * target은 NOISE_BED_ANALYSER_SIZE개까지만 채워진다.
   */
  readWaveform(target: Float32Array<ArrayBuffer>): boolean;
  stop(): void;
}

export interface NoiseBedOptions {
  /** level 1에서의 음량. 효과음보다 낮게: 계속 들리는 소리라 금방 피곤해진다. */
  gain: number;
  highpass: number;
  lowpass: number;
  /**
   * 파형을 읽을 AnalyserNode를 게인 뒤에 끼운다 (readWaveform). 라디오 표시창처럼
   * 잡음을 눈으로도 보여 줄 자리에서만 켠다. 기본은 끔: 노드 하나라도 필요 없는 곳에
   * 두지 않는다.
   */
  analyser?: boolean;
}

/**
 * 분석기 창 크기(샘플 수). 48kHz에서 5ms쯤: 잡음의 결을 보이기엔 충분하고, 표시창에
 * 64점으로 솎아 그리기에도 넉넉하다. 더 크면 읽기만 비싸진다.
 */
export const NOISE_BED_ANALYSER_SIZE = 256;

/** 루프용 노이즈. 짧은 버퍼를 돌리면 반복 주기가 웅웅거려 들리므로 넉넉히 잡는다. */
const BED_BUFFER_S = 2;
let bedBuffer: AudioBuffer | null = null;
/** disposeAudio에서 한 번에 걷어내기 위한 목록. */
const activeBeds = new Set<NoiseBed>();

function getBedBuffer(ctx: AudioContext): AudioBuffer {
  if (bedBuffer && bedBuffer.sampleRate === ctx.sampleRate) return bedBuffer;
  const length = Math.floor(ctx.sampleRate * BED_BUFFER_S);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  bedBuffer = buffer;
  return buffer;
}

export function startNoiseBed({
  gain: peak,
  highpass,
  lowpass,
  analyser: withAnalyser = false,
}: NoiseBedOptions): NoiseBed | null {
  const ctx = ensureContext();
  if (!ctx || !master) return null;
  if (ctx.state === "suspended") void ctx.resume();

  const source = ctx.createBufferSource();
  source.buffer = getBedBuffer(ctx);
  source.loop = true;
  const highpassFilter = ctx.createBiquadFilter();
  highpassFilter.type = "highpass";
  highpassFilter.frequency.value = highpass;
  const lowpassFilter = ctx.createBiquadFilter();
  lowpassFilter.type = "lowpass";
  lowpassFilter.frequency.value = lowpass;
  const gain = ctx.createGain();
  // 0에서 시작해야 켜지는 순간 "퍽" 하고 튀지 않는다.
  gain.gain.value = 0;

  // 분석기는 게인 뒤·마스터 앞. 소리와 같은 진폭을 읽되 음소거·전체 음량에는 안 물린다.
  let analyser: AnalyserNode | null = null;
  if (withAnalyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = NOISE_BED_ANALYSER_SIZE;
  }
  const chain = source.connect(highpassFilter).connect(lowpassFilter).connect(gain);
  (analyser ? chain.connect(analyser) : chain).connect(master);
  source.start();

  let stopped = false;
  const bed: NoiseBed = {
    setLevel(level) {
      if (stopped) return;
      const clamped = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
      gain.gain.setTargetAtTime(clamped * peak, ctx.currentTime, 0.08);
    },
    readWaveform(target) {
      if (stopped || !analyser) return false;
      analyser.getFloatTimeDomainData(target);
      return true;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      activeBeds.delete(bed);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      source.stop(ctx.currentTime + 0.3);
      source.onended = () => {
        source.disconnect();
        highpassFilter.disconnect();
        lowpassFilter.disconnect();
        gain.disconnect();
        analyser?.disconnect();
      };
    },
  };
  activeBeds.add(bed);
  return bed;
}

/**
 * BGM 레이어(music.ts)가 효과음과 같은 컨텍스트·마스터 버스에 붙기 위한 통로.
 * 버스를 공유해야 음소거·전체 음량이 한 번에 걸린다.
 */
export function audioGraph(): { context: AudioContext; master: GainNode } | null {
  const ctx = ensureContext();
  if (!ctx || !master) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return { context: ctx, master };
}

/** 첫 사용자 제스처에서 부른다. 이후 재생이 정책에 막히지 않는다. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

export function setAudioMuted(next: boolean) {
  muted = next;
  if (master && context) {
    master.gain.setTargetAtTime(next ? 0 : volume, context.currentTime, 0.02);
  }
}

export function setAudioVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  if (master && context && !muted) {
    master.gain.setTargetAtTime(volume, context.currentTime, 0.02);
  }
}

/** 테스트·핫리로드에서 상태를 되돌리기 위한 탈출구. */
export function disposeAudio() {
  // 컨텍스트를 닫기 전에 돌고 있는 소스를 끊는다. 닫힌 컨텍스트에서는 stop이 던진다.
  for (const bed of [...activeBeds]) bed.stop();
  activeBeds.clear();
  void context?.close();
  context = null;
  master = null;
  noiseBuffer = null;
  bedBuffer = null;
  samples.clear();
  lastPlayedAt.clear();
}

export type { VoiceId };
export { voiceDuration };
