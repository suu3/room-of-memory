/** @vitest-environment jsdom */

import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MinigameResult } from "@/types/minigame";
import { PianoMelodyMinigame } from "./index";
import { PIANO_KEYS } from "./keys";
import { MELODY, type Solfege } from "./melody";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 이벤트 객체 흉내: 핸들러가 부르는 stopPropagation만 있으면 된다. */
const click = { stopPropagation: () => undefined };

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

async function renderPiano(carrying: readonly string[] = ["piano-sheet"]) {
  const results: MinigameResult[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <PianoMelodyMinigame onComplete={(result) => results.push(result)} carrying={carrying} />,
  );
  return { renderer, results };
}

/** 건반 하나를 누른다. 화면에 선 순서가 PIANO_KEYS의 순서다. */
async function press(renderer: Renderer, index: number) {
  const key = renderer.scene.findAll(
    (node) => (node.instance as { name?: string }).name === `piano-key-${index}`,
  )[0];
  await renderer.fireEvent(key, "click", click);
}

/** 흰 건반 중 그 계이름의 자리. */
function whiteKeyIndex(note: Solfege) {
  return PIANO_KEYS.findIndex((key) => !key.black && key.note === note);
}

describe("PianoMelodyMinigame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("흰 건반 일곱과 검은 건반 다섯이 선다", async () => {
    const { renderer } = await renderPiano();
    const keys = renderer.scene.findAll((node) =>
      ((node.instance as { name?: string }).name ?? "").startsWith("piano-key-"),
    );
    expect(keys).toHaveLength(PIANO_KEYS.length);
  });

  it("악보대로 다 치면 풀린 것으로 보고한다", async () => {
    const { renderer, results } = await renderPiano();

    for (const note of MELODY) await press(renderer, whiteKeyIndex(note));

    // 마지막 음이 울리는 동안은 건반이 그대로 남는다. 결과는 그 뒤에 나간다
    expect(results).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(results).toEqual([expect.objectContaining({ cleared: true })]);
  });

  it("한 음이라도 어긋나면 처음부터다", async () => {
    const { renderer, results } = await renderPiano();

    await press(renderer, whiteKeyIndex(MELODY[0]));
    // 곡의 둘째 음이 아닌 흰 건반
    const wrong = PIANO_KEYS.findIndex((key) => !key.black && key.note !== MELODY[1]);
    await press(renderer, wrong);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // 되감겼으므로 곡을 처음부터 다시 쳐야 열린다
    for (const note of MELODY.slice(1)) await press(renderer, whiteKeyIndex(note));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(results).toHaveLength(0);
  });

  it("검은 건반은 언제나 틀린 음이다", async () => {
    const { renderer, results } = await renderPiano();

    await press(renderer, whiteKeyIndex(MELODY[0]));
    await press(
      renderer,
      PIANO_KEYS.findIndex((key) => key.black),
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    for (const note of MELODY.slice(1)) await press(renderer, whiteKeyIndex(note));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(results).toHaveLength(0);
  });
});
