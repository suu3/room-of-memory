"use client";

import { VOICES, type Voice, type VoiceId, voiceDuration } from "./voices";

/**
 * Web Audio로 효과음을 합성해 재생한다. 오디오 파일이 없다 — voices.ts의 악보를
 * 그때그때 오실레이터로 만든다.
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

/** 소리 하나 재생. 컨텍스트가 아직 없으면(제스처 전) 조용히 넘어간다. */
export function playSound(id: VoiceId) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  // 탭을 다녀오면 suspended로 돌아와 있을 수 있다.
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const previous = lastPlayedAt.get(id) ?? -Infinity;
  if (now - previous < MIN_REPEAT_S) return;
  lastPlayedAt.set(id, now);

  const voice = VOICES[id];
  scheduleVoice(ctx, master, voice, now + 0.001);
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

/** 첫 사용자 제스처에서 부른다 — 이후 재생이 정책에 막히지 않는다. */
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
  void context?.close();
  context = null;
  master = null;
  noiseBuffer = null;
  lastPlayedAt.clear();
}

export type { VoiceId };
export { voiceDuration };
