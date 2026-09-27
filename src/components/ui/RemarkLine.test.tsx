/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { RemarkLine } from "./RemarkLine";

/** matchMedia를 원하는 판정으로 갈아 끼운다 (control-hint.test와 같다). jsdom에는 기기가 없다. */
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

function showRemark() {
  useMemoryRoomStore.setState({ remark: { id: "toothbrush", at: Date.now() } });
}

describe("RemarkLine", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useMemoryRoomStore.getState().reset();
  });

  it("마우스 기기에서는 바닥 위 80px에 선다", async () => {
    stubPointer(false);
    showRemark();
    const { container } = render(<RemarkLine />);
    await waitFor(() => expect(container.querySelector("p")).not.toBeNull());
    expect(container.querySelector("p")?.className).toContain("bottom-20");
  });

  it("터치 기기에서는 조이스틱 위로 올라간다. 긴 문장이 원판과 '이동' 라벨을 물지 않게", async () => {
    stubPointer(true);
    showRemark();
    const { container } = render(<RemarkLine />);
    await waitFor(() => expect(container.querySelector("p")?.className).toContain("bottom-56"));
    expect(container.querySelector("p")?.className).not.toContain("bottom-20");
  });
});
