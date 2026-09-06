/** @vitest-environment jsdom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "./config";
import { useControlHint } from "./control-hint";

/** matchMedia를 원하는 판정으로 갈아 끼운다 — jsdom에는 실제 기기가 없다. */
function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: coarse,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  );
}

describe("useControlHint", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });

  beforeEach(() => {
    stubPointer(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("names the keys on a mouse-and-keyboard device", () => {
    const { result } = renderHook(() => useControlHint());

    expect(result.current("titleScreen.howToMove")).toBe("이동 클릭 · WASD");
    expect(result.current("minigame.ballCatch.prompt")).toBe("SPACE");
  });

  it("swaps in the touch wording on a coarse-pointer device", () => {
    stubPointer(true);
    const { result } = renderHook(() => useControlHint());

    expect(result.current("titleScreen.howToMove")).toBe("이동 바닥 탭 · 조이스틱");
    expect(result.current("minigame.ballCatch.prompt")).toBe("터치");
  });

  it("keeps the original copy when a key has no touch variant", () => {
    stubPointer(true);
    const { result } = renderHook(() => useControlHint());

    // 조작과 무관한 문구까지 기기별로 갈라 쓰지는 않는다.
    expect(result.current("minigame.frequencyTune.title")).toBe("주파수 맞추기");
  });

  it("falls back to the keyboard wording without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useControlHint());

    expect(result.current("titleScreen.howToMove")).toBe("이동 클릭 · WASD");
  });
});
