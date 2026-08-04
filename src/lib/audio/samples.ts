"use client";

import { ASSETS } from "@/lib/assets";
import { audioGraph, registerSample } from "./engine";
import type { VoiceId } from "./voices";

/**
 * 파일 기반 효과음. 이 프로젝트의 기본은 합성이고(voices.ts), 여기 등록된 보이스만
 * 파일이 대신 울린다.
 *
 * 파일이 없으면 조용히 합성으로 남는다 — fighter-duel 스프라이트 시트와 같은 방식이다
 * (src/lib/assets.ts 주석 참고). 그래서 에셋을 나중에 넣어도 코드는 손댈 게 없다.
 *
 * 합성이 이미 충분한 소리까지 파일로 바꾸지 않는다: 톤과 필터드 노이즈로 만들 수 있는
 * 것(종이 넘김, 천 마찰, 라디오 잡음, 옛 폰 비프)은 코드가 더 싸고 음소거·음량 제어도
 * 그대로 걸린다. 파일이 이기는 건 실물의 정체가 드러나야 하는 소리뿐이다.
 */

/** 이미 시도한 경로 — 없는 파일에 매번 요청을 다시 던지지 않는다. */
const attempted = new Set<VoiceId>();

async function loadSample(id: VoiceId, src: string): Promise<void> {
  const graph = audioGraph();
  if (!graph) return;
  try {
    const response = await fetch(src);
    if (!response.ok) return;
    registerSample(id, await graph.context.decodeAudioData(await response.arrayBuffer()));
  } catch {
    // 파일이 없거나 디코드에 실패하면 합성 보이스가 그대로 쓰인다. 잡음 없는 폴백이
    // 목적이라 여기서 콘솔을 더럽히지 않는다.
  }
}

/**
 * 등록된 파일이 있는 보이스만 미리 받아 둔다. 미니게임이 게이트에 도달하기 직전
 * (컴포넌트 마운트 시점)에 부르면 첫 재생에서 늦지 않는다.
 *
 * AudioContext가 아직 없으면(첫 제스처 전) 아무것도 하지 않고 넘어간다 — 다음 호출에서
 * 다시 시도한다.
 */
export function preloadSamples(ids: readonly VoiceId[]): void {
  if (!audioGraph()) return;
  for (const id of ids) {
    if (attempted.has(id)) continue;
    const src = ASSETS.sfx[id];
    if (!src) continue;
    attempted.add(id);
    void loadSample(id, src);
  }
}
