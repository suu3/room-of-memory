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
/**
 * 효과음만 모이는 버스. 음악(music.ts)은 master로 바로 가고 효과음은 여기를 한 번 더 거친다.
 * 보이스마다 악보에 적힌 게인은 서로 간의 크기 비율이고, 음악에 대한 전체 크기는 이 한 값이 정한다.
 * 폰 스피커에서 효과음이 곡을 뚫고 튀어나와 전체를 약 -3dB 내렸다 (2026-09-27).
 */
let sfxBus: GainNode | null = null;
const SFX_LEVEL = 0.7;
/**
 * 파일 효과음의 개별 크기. 합성 보이스는 악보에 게인이 있지만 파일은 원본 크기 그대로라
 * 여기서 맞춘다. 뽁(open)은 창이 뜰 때마다 울리는데 원본이 유독 커서 한 번 더 깎는다.
 */
const SAMPLE_GAIN: Partial<Record<VoiceId, number>> = { open: 0.65 };
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
  sfxBus = context.createGain();
  sfxBus.gain.value = SFX_LEVEL;
  sfxBus.connect(master);
  // 한 번만 건다. 리스너는 모듈의 context를 보므로 disposeAudio 뒤 새 컨텍스트에도 그대로 듣는다
  if (!visibilityBound && typeof document !== "undefined") {
    visibilityBound = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return context;
}

/**
 * 다른 앱으로 넘어가 있는 동안은 오디오 컨텍스트를 세운다.
 *
 * 폰 브라우저는 뒤로 간 탭의 타이머와 렌더 스레드를 조이면서도 오디오 스레드는 반쯤
 * 살려 둔다. 곡이 조인 타이머에 맞춰 예약되니 소리가 뚝뚝 끊기며 버벅였다. 안 보이는
 * 동안 들려줄 것도 없으니 통째로 멈췄다가, 돌아오면 그 자리에서 잇는다.
 */
let visibilityBound = false;
function isBackgrounded(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}
function onVisibilityChange() {
  if (!context || context.state === "closed") return;
  if (isBackgrounded()) void context.suspend();
  else void context.resume();
}
/** 멈춘 컨텍스트를 깨운다. 뒤로 가 있는 동안에는 깨우지 않는다 (onVisibilityChange). */
function wake(ctx: AudioContext) {
  if (ctx.state !== "running" && !isBackgrounded()) void ctx.resume();
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

function playSample(
  ctx: AudioContext,
  output: GainNode,
  buffer: AudioBuffer,
  rate: number,
  level = 1,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  if (level === 1) {
    source.connect(output);
    source.start();
    source.onended = () => source.disconnect();
    return;
  }
  const gain = ctx.createGain();
  gain.gain.value = level;
  source.connect(gain).connect(output);
  source.start();
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}

/** 소리 하나 재생. 컨텍스트가 아직 없으면(제스처 전) 조용히 넘어간다. */
export function playSound(id: VoiceId, options: PlayOptions = {}) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !sfxBus) return;
  // 탭을 다녀오면 suspended로 돌아와 있을 수 있다.
  wake(ctx);

  const now = ctx.currentTime;
  const previous = lastPlayedAt.get(id) ?? -Infinity;
  if (now - previous < MIN_REPEAT_S) return;
  lastPlayedAt.set(id, now);

  const { variation = 0, pitch = 1 } = options;
  // 1을 중심으로 ±variation. 샘플에는 재생속도로, 합성에는 주파수 배율로 같은 값이 걸린다.
  const ratio = pitch * (variation > 0 ? 1 + (Math.random() * 2 - 1) * variation : 1);

  const sample = samples.get(id);
  if (sample) {
    playSample(ctx, sfxBus, sample, ratio, SAMPLE_GAIN[id]);
    return;
  }
  scheduleVoice(ctx, sfxBus, transposeVoice(VOICES[id], ratio), now + 0.001);
}

/**
 * 음 하나를 그 높이로 울린다 (피아노 건반).
 *
 * VOICES를 못 쓰는 자리다. 저쪽은 id마다 음이 고정이고, 같은 id가 연달아 나면
 * MIN_REPEAT_S가 막는다. 건반은 **음높이가 곧 뜻**이고 같은 음을 연달아 누르는
 * 일도 흔해서(솔미미), 소리 이름이 아니라 주파수를 받는 통로가 따로 필요하다.
 *
 * 사인파 배음을 겹쳐 맑은 건반 소리를 낸다. 삼각파 하나는 폰 스피커에서 먹먹한
 * "삑"으로 들렸다 (2026-09-28). 높은 배음일수록 작고 빨리 죽어서, 치는 순간은
 * 또렷하고 꼬리는 기음만 남아 둥글게 사라진다. 한 옥타브 위 배음이 "맑음"을 맡는다.
 * 꼬리는 길게 두되 감쇠가 지수라 빨리 눌러도 앞 음이 금방 물러나 뭉개지지 않는다.
 */
const PIANO_PARTIALS: readonly { ratio: number; gain: number; decay: number }[] = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.45, decay: 0.6 },
  { ratio: 3, gain: 0.18, decay: 0.4 },
  { ratio: 4, gain: 0.08, decay: 0.28 },
];

export function playTone(frequency: number, { duration = 1.1, gain = 0.26 } = {}) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !sfxBus) return;
  wake(ctx);

  scheduleVoice(
    ctx,
    sfxBus,
    {
      tones: PIANO_PARTIALS.map((partial) => ({
        from: frequency * partial.ratio,
        waveform: "sine" as const,
        delay: 0,
        duration: duration * partial.decay,
        gain: gain * partial.gain,
      })),
    },
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
  stop(): void;
}

export interface NoiseBedOptions {
  /** level 1에서의 음량. 효과음보다 낮게: 계속 들리는 소리라 금방 피곤해진다. */
  gain: number;
  highpass: number;
  lowpass: number;
}

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

export function startNoiseBed({ gain: peak, highpass, lowpass }: NoiseBedOptions): NoiseBed | null {
  const ctx = ensureContext();
  if (!ctx || !sfxBus) return null;
  wake(ctx);

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

  source.connect(highpassFilter).connect(lowpassFilter).connect(gain).connect(sfxBus);
  source.start();

  let stopped = false;
  const bed: NoiseBed = {
    setLevel(level) {
      if (stopped) return;
      const clamped = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
      gain.gain.setTargetAtTime(clamped * peak, ctx.currentTime, 0.08);
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
  wake(ctx);
  return { context: ctx, master };
}

/** 첫 사용자 제스처에서 부른다. 이후 재생이 정책에 막히지 않는다. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx) wake(ctx);
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
  sfxBus = null;
  noiseBuffer = null;
  bedBuffer = null;
  samples.clear();
  lastPlayedAt.clear();
}

export type { VoiceId };
export { voiceDuration };
