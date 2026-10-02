"use client";

import { audioGraph } from "./engine";

/**
 * 녹음된 말소리 한 편. 효과음(engine.ts)은 0.6초 안쪽의 반응이고 곡(music.ts)은 루프라,
 * "한 번 흐르고 도중에 물러나거나 끊기는 십몇 초짜리 목소리"는 둘 다에 안 맞는다.
 * 노이즈 층(NoiseBed)과 같은 모양의 손잡이를 돌려준다: 크기를 밀고, 끊는다.
 *
 * 파일을 못 받으면 조용히 아무 소리도 안 난다 (samples.ts와 같은 태도). 글은 대사창에
 * 그대로 서 있으므로 소리가 빠져도 장면은 선다.
 */
export interface Speech {
  /** 0이면 무음, 1이면 설정한 음량. 뚝 끊기지 않게 완만히 따라간다. */
  setLevel(level: number): void;
  stop(): void;
}

export interface SpeechOptions {
  /** level 1에서의 음량. 마스터 음량이 한 번 더 곱해진다. */
  gain: number;
  /** 스피커의 대역. 둘 다 주면 그 사이만 남는다 (라디오 너머의 목소리). */
  highpass?: number;
  lowpass?: number;
}

/** 끊길 때 물러나는 시간(초). 말 중간에서 끊겨도 딸깍 소리가 나지 않을 만큼. */
const FADE_OUT_S = 0.5;

/** 받은(받는 중인) 파일. 실패한 경로도 남겨 두어 다시 요청하지 않는다. */
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function loadSpeech(context: AudioContext, src: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(src);
  if (cached) return cached;
  const loading = fetch(src)
    .then(async (response) =>
      response.ok ? await context.decodeAudioData(await response.arrayBuffer()) : null,
    )
    .catch(() => null);
  buffers.set(src, loading);
  return loading;
}

/**
 * 곧 틀 목소리를 미리 받아 둔다. AudioContext가 아직 없으면(첫 제스처 전) 넘어간다.
 */
export function preloadSpeech(src: string): void {
  const graph = audioGraph();
  if (graph) void loadSpeech(graph.context, src);
}

/** 목소리를 머리부터 한 번 튼다. 받는 중에 끊으면 소리 없이 끝난다. */
export function startSpeech(src: string, options: SpeechOptions): Speech | null {
  const graph = audioGraph();
  if (!graph) return null;
  const { context, master } = graph;

  const gain = context.createGain();
  gain.gain.value = options.gain;
  gain.connect(master);
  const nodes: AudioNode[] = [gain];
  let input: AudioNode = gain;
  for (const [type, frequency] of [
    ["lowpass", options.lowpass],
    ["highpass", options.highpass],
  ] as const) {
    if (frequency === undefined) continue;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.connect(input);
    nodes.push(filter);
    input = filter;
  }

  let source: AudioBufferSourceNode | null = null;
  let stopped = false;
  const release = () => {
    source?.disconnect();
    for (const node of nodes) node.disconnect();
  };

  void loadSpeech(context, src).then((buffer) => {
    if (stopped || !buffer) {
      release();
      return;
    }
    source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(input);
    source.onended = release;
    source.start();
  });

  return {
    setLevel(level) {
      if (stopped) return;
      const clamped = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
      gain.gain.setTargetAtTime(clamped * options.gain, context.currentTime, 0.12);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, FADE_OUT_S / 3);
      // 아직 받는 중이면 source가 없다. 그쪽은 받은 뒤에 stopped를 보고 스스로 정리한다
      source?.stop(now + FADE_OUT_S);
    },
  };
}
