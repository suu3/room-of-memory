"use client";

import { audioGraph } from "./engine";
import { foldLoopTail, musicCutoff, musicReverb, musicVolume } from "./music-curve";

/**
 * 파일 기반 BGM. 효과음(engine.ts)과 같은 AudioContext·마스터 버스를 쓰므로
 * 음소거와 전체 음량이 그대로 걸린다.
 *
 * 한 트랙의 그래프:
 *
 *   source(loop) → lowpass ┬→ dry ──────────┐
 *                          └→ convolver → wet ┴→ gain → master
 *
 * 밝기(0~1)가 컷오프·음량·리버브 세 개를 동시에 움직인다. 곡 파일은 절대 손대지
 * 않고 전부 재생 시점 이펙트다 — 커브는 music-curve.ts.
 *
 * 트랙은 두 개다(1바퀴·2바퀴). 갈아탈 때는 **새 트랙을 다 받은 뒤에** 겹쳐서
 * 건너간다. 먼저 끊고 받으면 그 사이가 빈 정적이 되고, 받기에 실패하면 아무것도
 * 없는 방이 된다 — 곡이 아직 리포에 없어도 게임이 조용해지면 안 된다.
 *
 * 그래서 한 바퀴의 곡은 경로 하나가 아니라 **후보 목록**이다. 앞에서부터 받아
 * 보고 처음 성공한 것을 튼다 — 새 곡을 넣기 전에 경로를 먼저 박아 둬도 뒤에 선
 * 자리 지킴이가 방을 채운다.
 */

/** 루프 이음새에 접어 넣을 크로스페이드 길이(초). */
const LOOP_CROSSFADE_S = 2.4;
/** 밝기·덕킹 변화가 자리잡는 시간(초). 컷오프는 더 느리게 움직여야 자연스럽다. */
const VOLUME_GLIDE_S = 0.6;
const CUTOFF_GLIDE_S = 1.4;
/** 리버브는 공간이 바뀌는 감각이라 가장 느리게 — 빨리 젖으면 이펙트로 들킨다. */
const REVERB_GLIDE_S = 2;
/** 정지·전환용 페이드. 뚝 끊으면 딸깍 소리가 난다. */
const FADE_OUT_S = 1.2;
/** 트랙을 갈아탈 때 두 곡이 겹치는 시간(초). */
const SWAP_S = 2.2;

/** 리버브 임펄스 길이(초)와 감쇠 지수. 방 하나 크기의 잔향. */
const IMPULSE_S = 2.4;
const IMPULSE_DECAY = 3.4;

/** 한 바퀴의 곡 — 경로 하나, 또는 앞에서부터 시도할 후보 목록. */
export type MusicTrack = string | readonly string[];

interface MusicVoice {
  /** 이 트랙을 요청했던 후보 목록의 키. 같은 요청인지 가리는 데만 쓴다. */
  request: string;
  source: AudioBufferSourceNode;
  lowpass: BiquadFilterNode;
  dry: GainNode;
  wet: GainNode;
  gain: GainNode;
}

/** 지금 밝기·덕킹을 받는 트랙. 갈아타는 동안 물러나는 쪽은 여기 없다. */
let voice: MusicVoice | null = null;
/** 재생 중인(또는 로딩 중인) 트랙의 요청 키. 같은 트랙 요청은 무시한다. */
let currentRequest: string | null = null;
/** 디코드 결과 캐시 — 리셋 후 다시 시작할 때 네트워크를 또 타지 않는다. */
const buffers = new Map<string, AudioBuffer>();
/** 한 번 실패한 트랙은 다시 안 받는다 (아직 리포에 없는 2바퀴 곡). */
const missing = new Set<string>();
/** 컨텍스트당 하나만 굽는 리버브 임펄스. */
let impulse: AudioBuffer | null = null;
/** 로딩이 끝나기 전에 들어온 밝기·덕킹 값. 재생이 시작되면 그대로 반영된다. */
let level = 0;
let duck = 1;

function targetVolume(): number {
  return musicVolume(level) * duck;
}

/**
 * 잔향 임펄스를 코드로 굽는다.
 *
 * 임펄스 파일을 에셋으로 넣는 방법도 있지만, 여기 필요한 건 특정 공간의 정확한
 * 울림이 아니라 "멀어진다"는 인상뿐이라 잡음을 지수로 재우는 것으로 충분하다 —
 * 수백 KB를 리포에 넣을 이유가 없다 (효과음을 합성으로 만드는 것과 같은 판단).
 */
function reverbImpulse(context: AudioContext): AudioBuffer {
  if (impulse) return impulse;
  const length = Math.floor(context.sampleRate * IMPULSE_S);
  const baked = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < baked.numberOfChannels; channel += 1) {
    const data = baked.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const remaining = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * remaining ** IMPULSE_DECAY;
    }
  }
  impulse = baked;
  return baked;
}

/** 디코드한 버퍼의 채널마다 꼬리를 머리에 접어 루프 지점을 매끄럽게 만든다. */
function bakeLoop(context: AudioContext, source: AudioBuffer): AudioBuffer {
  const fade = Math.floor(LOOP_CROSSFADE_S * source.sampleRate);
  const folded = Array.from({ length: source.numberOfChannels }, (_, channel) =>
    foldLoopTail(source.getChannelData(channel), fade),
  );
  const baked = context.createBuffer(source.numberOfChannels, folded[0].length, source.sampleRate);
  folded.forEach((data, channel) => {
    baked.copyToChannel(data, channel);
  });
  return baked;
}

async function loadBuffer(context: AudioContext, src: string): Promise<AudioBuffer> {
  const cached = buffers.get(src);
  if (cached) return cached;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`BGM을 받지 못했다: ${src} (${response.status})`);
  const decoded = await context.decodeAudioData(await response.arrayBuffer());
  const baked = bakeLoop(context, decoded);
  buffers.set(src, baked);
  return baked;
}

/**
 * 후보를 앞에서부터 받아 처음 성공한 것을 돌려준다.
 *
 * 실패한 경로는 `missing`에 박혀 다시 시도하지 않는다 — 밝기가 바뀔 때마다
 * 없는 파일에 요청을 날리면 콘솔이 404로 뒤덮인다.
 */
async function loadFirst(context: AudioContext, candidates: readonly string[]) {
  let lastError: unknown = new Error("BGM 후보가 비어 있다");
  for (const src of candidates) {
    if (missing.has(src)) continue;
    try {
      return await loadBuffer(context, src);
    } catch (error) {
      missing.add(src);
      lastError = error;
    }
  }
  throw lastError;
}

/** 한 트랙을 페이드아웃시키고 끊는다. 이 트랙은 더는 밝기를 받지 않는다. */
function retire(playing: MusicVoice, fadeSeconds: number) {
  const graph = audioGraph();
  if (!graph) return;
  const now = graph.context.currentTime;
  playing.gain.gain.cancelScheduledValues(now);
  playing.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.01, fadeSeconds / 3));
  playing.source.stop(now + fadeSeconds);
  playing.source.onended = () => {
    playing.source.disconnect();
    playing.lowpass.disconnect();
    playing.dry.disconnect();
    playing.wet.disconnect();
    playing.gain.disconnect();
  };
}

/** 현재 밝기·덕킹을 트랙에 반영한다. */
function applyLevel(target: MusicVoice, context: AudioContext, glide = true) {
  const now = context.currentTime;
  const wet = musicReverb(level);
  if (!glide) {
    target.lowpass.frequency.value = musicCutoff(level);
    target.dry.gain.value = 1 - wet;
    target.wet.gain.value = wet;
    return;
  }
  target.lowpass.frequency.setTargetAtTime(musicCutoff(level), now, CUTOFF_GLIDE_S);
  target.dry.gain.setTargetAtTime(1 - wet, now, REVERB_GLIDE_S);
  target.wet.gain.setTargetAtTime(wet, now, REVERB_GLIDE_S);
  target.gain.gain.setTargetAtTime(targetVolume(), now, VOLUME_GLIDE_S);
}

function buildVoice(
  context: AudioContext,
  master: GainNode,
  request: string,
  buffer: AudioBuffer,
): MusicVoice {
  const source = context.createBufferSource();
  const lowpass = context.createBiquadFilter();
  const convolver = context.createConvolver();
  const dry = context.createGain();
  const wet = context.createGain();
  const gain = context.createGain();

  source.buffer = buffer;
  source.loop = true;
  lowpass.type = "lowpass";
  convolver.buffer = reverbImpulse(context);

  source.connect(lowpass);
  lowpass.connect(dry).connect(gain);
  lowpass.connect(convolver).connect(wet).connect(gain);
  gain.connect(master);

  const built = { request, source, lowpass, dry, wet, gain };
  // 컷오프·리버브는 시작 값부터 맞춰 둔다. 음량만 0에서 올려야 딸깍하지 않는다
  applyLevel(built, context, false);
  gain.gain.value = 0.0001;
  source.start();
  return built;
}

/**
 * 트랙을 틀고 루프시킨다. 같은 트랙이 이미 돌고 있으면 아무 일도 하지 않는다.
 *
 * 후보를 여럿 주면 앞에서부터 받아 처음 성공한 것을 튼다 — 아직 리포에 없는 새 곡을
 * 앞에, 자리 지킴이를 뒤에 세우는 용도다.
 *
 * AudioContext가 아직 없으면(=첫 제스처 전) 조용히 넘어간다. 자동재생 정책상
 * 제스처 없이는 어차피 소리가 나지 않으므로, 호출부가 제스처 뒤에 다시 부르면 된다.
 *
 * 후보를 전부 못 받으면 **돌던 곡을 그대로 둔다.** 조용한 방보다 이전 바퀴의 곡이
 * 계속 흐르는 편이 낫다.
 */
export function startMusic(track: MusicTrack) {
  const candidates = typeof track === "string" ? [track] : track;
  const request = candidates.join("|");
  if (currentRequest === request && voice) return;
  if (candidates.every((src) => missing.has(src))) return;
  const graph = audioGraph();
  if (!graph) return;

  currentRequest = request;

  void loadFirst(graph.context, candidates)
    .then((buffer) => {
      // 로딩 중에 다른 트랙으로 갈아탔거나 정지했으면 버린다
      if (currentRequest !== request) return;
      const { context, master } = graph;
      const outgoing = voice;
      const next = buildVoice(context, master, request, buffer);
      // 새 곡을 올리면서 옛 곡을 내린다 — 사이에 빈 구간을 만들지 않는다
      next.gain.gain.setTargetAtTime(targetVolume(), context.currentTime, SWAP_S / 3);
      voice = next;
      if (outgoing) retire(outgoing, SWAP_S);
    })
    .catch((error) => {
      if (currentRequest === request) currentRequest = voice?.request ?? null;
      // BGM이 없다고 게임이 멈추면 안 된다 — 돌던 곡이 있으면 그대로 흐른다
      console.warn(error);
    });
}

/** 페이드아웃 후 정지. 다시 틀려면 startMusic을 부른다. */
export function stopMusic() {
  currentRequest = null;
  const playing = voice;
  voice = null;
  if (playing) retire(playing, FADE_OUT_S);
}

/**
 * 방 밝기(0~1)를 그대로 넘긴다. 1바퀴에서 깎이고 2바퀴에서 차오르는 V자가
 * 그대로 음색의 V자가 된다 — 곡은 바뀌어도 곡선은 하나다.
 */
export function setMusicLevel(next: number) {
  level = next;
  const graph = audioGraph();
  if (!voice || !graph) return;
  applyLevel(voice, graph.context);
}

/**
 * BGM을 눌러 앞을 비운다 (1=평소, 0=무음). 미니게임처럼 효과음이 주인공인 구간과,
 * 라디오 재난방송처럼 정적이 연출인 지점에 쓴다.
 */
export function setMusicDuck(next: number) {
  duck = Math.min(1, Math.max(0, next));
  const graph = audioGraph();
  if (!voice || !graph) return;
  voice.gain.gain.setTargetAtTime(targetVolume(), graph.context.currentTime, VOLUME_GLIDE_S);
}

/** 테스트·핫리로드 탈출구. disposeAudio가 컨텍스트를 닫기 전에 불린다. */
export function disposeMusic() {
  currentRequest = null;
  const playing = voice;
  voice = null;
  if (playing) retire(playing, 0.01);
  buffers.clear();
  missing.clear();
  impulse = null;
  level = 0;
  duck = 1;
}
