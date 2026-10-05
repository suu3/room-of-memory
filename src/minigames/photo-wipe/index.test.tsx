/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { ASSETS } from "@/lib/assets";
import { PhotoWipeMinigame } from ".";

function photoOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img");
  if (!image) throw new Error("photo not rendered");
  return image;
}

describe("PhotoWipeMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("shows the shadowed photo on the first pass", () => {
    const { container } = render(<PhotoWipeMinigame onComplete={() => {}} />);

    expect(photoOf(container).getAttribute("src")).toBe(ASSETS.images.mgPhotoWipePhase1);
  });

  it("shows the revealed photo when the frame is investigated again in phase 2", () => {
    const { container } = render(<PhotoWipeMinigame gamePhase={2} onComplete={() => {}} />);

    expect(photoOf(container).getAttribute("src")).toBe(ASSETS.images.mgPhotoWipePhase2);
  });

  it("sizes the wipe canvas to the photo it covers", () => {
    const { container } = render(<PhotoWipeMinigame gamePhase={2} onComplete={() => {}} />);

    const photo = photoOf(container);
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("width")).toBe(photo.getAttribute("width"));
    expect(canvas?.getAttribute("height")).toBe(photo.getAttribute("height"));
  });

  it("tells keyboard players how to wipe, next to the mouse hint", () => {
    render(<PhotoWipeMinigame onComplete={() => {}} />);

    expect(screen.getByText(/Drag, or move the cloth with/)).toBeTruthy();
    expect(screen.getByText("↑↓←→").tagName).toBe("KBD");
    expect(screen.getByText("Space").tagName).toBe("KBD");
  });
});

describe("PhotoWipeMinigame with the keyboard", () => {
  /**
   * jsdom에는 캔버스 2D가 없다. 무엇을 부르고 무엇을 읽어도 받아 주는 빈 컨텍스트를
   * 세운다 (금빛 입자가 그라디언트까지 만든다).
   */
  const context: unknown = new Proxy(() => {}, {
    get: () => context,
    apply: () => context,
    set: () => true,
  });

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** 사진이 실린 것으로 치고(jsdom은 그림을 받지 않는다) 판을 세운다. */
  function start(onComplete = vi.fn()) {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        naturalWidth = 0;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const view = render(<PhotoWipeMinigame onComplete={onComplete} />);
    return { ...view, onComplete };
  }

  const press = (code: string, times = 1) => {
    for (let i = 0; i < times; i++) fireEvent.keyDown(window, { code });
  };

  const clarity = () => screen.getByText(/^\d+%$/).textContent;

  it("wipes where the cloth lands when an arrow key moves it", async () => {
    const { container } = start();
    await act(async () => {});
    expect(clarity()).toBe("0%");
    expect(container.querySelectorAll("img")).toHaveLength(1);

    act(() => press("ArrowRight"));

    expect(clarity()).not.toBe("0%");
    // 사진 위에 키보드 헝겊이 선다
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("wipes in place with Space or Enter", async () => {
    start();
    await act(async () => {});

    act(() => press("Space"));
    const afterSpace = clarity();
    expect(afterSpace).not.toBe("0%");

    // 같은 자리를 다시 눌러도 더 닦이지 않는다
    act(() => press("Enter"));
    expect(clarity()).toBe(afterSpace);
  });

  it("leaves Space to a focused button", async () => {
    start();
    await act(async () => {});
    const button = document.createElement("button");
    document.body.append(button);

    fireEvent.keyDown(button, { code: "Space" });

    expect(clarity()).toBe("0%");
    button.remove();
  });

  it("finishes with arrow keys alone and reports once", async () => {
    const { onComplete } = start();
    await act(async () => {});

    // 왼쪽 위 구석으로 간 뒤 줄을 바꿔 가며 쓸어내린다
    act(() => {
      press("ArrowLeft", 20);
      press("ArrowUp", 20);
    });
    for (let sweep = 0; sweep < 10; sweep++) {
      act(() => {
        press(sweep % 2 === 0 ? "ArrowRight" : "ArrowLeft", 20);
        press("ArrowDown", 2);
      });
    }
    expect(onComplete).not.toHaveBeenCalled();

    // 금빛 입자가 끝나기를 기다린다 (rAF가 멈춘 탭에서는 폴백 타이머)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cleared: true }));

    // 다 닦인 뒤의 키는 판의 것이 아니다
    act(() => press("ArrowRight", 3));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
