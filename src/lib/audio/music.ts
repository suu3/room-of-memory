"use client";

import { audioGraph } from "./engine";
import { foldLoopTail, musicCutoff, musicVolume } from "./music-curve";

/**
 * 파일 기반 BGM 한 트랙. 효과음(engine.ts)과 같은 AudioContext·마스터 버스를 쓰므로
 * 음소거와 전체 음량이 그대로 걸린다.
 *
 * 그래프: source(loop) → lowpass → gain → master
 *
 * 밝기(0~1)가 lowpass와 gain을 동시에 움직인다. 곡을 갈아끼우는 대신 필터를
 * 여닫는 이유는 music-curve.ts 주석 참고.
 */

/** 루프 이음새에 접어 넣을 크로스페이드 길이(초). */
const LOOP_CROSSFADE_S = 2.4;
/** 밝기·덕킹 변화가 자리잡는 시간(초). 컷오프는 더 느리게 움직여야 자연스럽다. */
const VOLUME_GLIDE_S = 0.6;
const CUTOFF_GLIDE_S = 1.4;
/** 정지·전환용 페이드. 뚝 끊으면 딸깍 소리가 난다. */
const FADE_OUT_S = 1.2;

interface MusicNodes {
  source: AudioBufferSourceNode;
  lowpass: BiquadFilterNode;
  gain: GainNode;
}

let nodes: MusicNodes | null = null;
/** 재생 중인(또는 로딩 중인) 트랙 경로. 같은 트랙 요청은 무시한다. */
let currentSrc: string | null = null;
/** 디코드 결과 캐시 — 리셋 후 다시 시작할 때 네트워크를 또 타지 않는다. */
const buffers = new Map<string, AudioBuffer>();
/** 로딩이 끝나기 전에 들어온 밝기·덕킹 값. 재생이 시작되면 그대로 반영된다. */
let level = 0;
let duck = 1;

function targetVolume(): number {
  return musicVolume(level) * duck;
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

function teardown(fadeSeconds: number) {
  const playing = nodes;
  if (!playing) return;
  nodes = null;
  const graph = audioGraph();
  if (!graph) return;
  const stopAt = graph.context.currentTime + fadeSeconds;
  playing.gain.gain.cancelScheduledValues(graph.context.currentTime);
  playing.gain.gain.setTargetAtTime(0.0001, graph.context.currentTime, fadeSeconds / 3);
  playing.source.stop(stopAt);
  playing.source.onended = () => {
    playing.source.disconnect();
    playing.lowpass.disconnect();
    playing.gain.disconnect();
  };
}

/**
 * 트랙을 틀고 루프시킨다. 같은 트랙이 이미 돌고 있으면 아무 일도 하지 않는다.
 *
 * AudioContext가 아직 없으면(=첫 제스처 전) 조용히 넘어간다. 자동재생 정책상
 * 제스처 없이는 어차피 소리가 나지 않으므로, 호출부가 제스처 뒤에 다시 부르면 된다.
 */
export function startMusic(src: string) {
  if (currentSrc === src && nodes) return;
  const graph = audioGraph();
  if (!graph) return;

  currentSrc = src;
  teardown(FADE_OUT_S);

  void loadBuffer(graph.context, src)
    .then((buffer) => {
      // 로딩 중에 다른 트랙으로 갈아탔거나 정지했으면 버린다
      if (currentSrc !== src) return;
      const { context, master } = graph;
      const source = context.createBufferSource();
      const lowpass = context.createBiquadFilter();
      const gain = context.createGain();

      source.buffer = buffer;
      source.loop = true;
      lowpass.type = "lowpass";
      lowpass.frequency.value = musicCutoff(level);
      // 0에서 시작해 올려야 시작 순간에 딸깍하지 않는다
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(targetVolume(), context.currentTime, VOLUME_GLIDE_S);

      source.connect(lowpass).connect(gain).connect(master);
      source.start();
      nodes = { source, lowpass, gain };
    })
    .catch((error) => {
      // BGM이 없다고 게임이 멈추면 안 된다 — 조용한 방으로 계속 진행한다
      if (currentSrc === src) currentSrc = null;
      console.warn(error);
    });
}

/** 페이드아웃 후 정지. 다시 틀려면 startMusic을 부른다. */
export function stopMusic() {
  currentSrc = null;
  teardown(FADE_OUT_S);
}

/**
 * 방 밝기(0~1)를 그대로 넘긴다. 1바퀴에서 깎이고 2바퀴에서 차오르는 V자가
 * 그대로 음색의 V자가 된다.
 */
export function setMusicLevel(next: number) {
  level = next;
  const graph = audioGraph();
  if (!nodes || !graph) return;
  const now = graph.context.currentTime;
  nodes.lowpass.frequency.setTargetAtTime(musicCutoff(level), now, CUTOFF_GLIDE_S);
  nodes.gain.gain.setTargetAtTime(targetVolume(), now, VOLUME_GLIDE_S);
}

/**
 * BGM을 눌러 앞을 비운다 (1=평소, 0=무음). 미니게임처럼 효과음이 주인공인 구간과,
 * 라디오 재난방송처럼 정적이 연출인 지점에 쓴다.
 */
export function setMusicDuck(next: number) {
  duck = Math.min(1, Math.max(0, next));
  const graph = audioGraph();
  if (!nodes || !graph) return;
  nodes.gain.gain.setTargetAtTime(targetVolume(), graph.context.currentTime, VOLUME_GLIDE_S);
}

/** 테스트·핫리로드 탈출구. disposeAudio가 컨텍스트를 닫기 전에 불린다. */
export function disposeMusic() {
  currentSrc = null;
  teardown(0.01);
  buffers.clear();
  level = 0;
  duck = 1;
}
