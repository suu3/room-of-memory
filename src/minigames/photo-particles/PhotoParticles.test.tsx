/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoParticles } from "./PhotoParticles";

const PROPS = {
  src: "/photo.webp",
  width: 560,
  height: 511,
  gamePhase: 1 as const,
  gathered: false,
  className: "block max-h-[58vh]",
};

describe("PhotoParticles", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("falls back to the plain photo when disabled", () => {
    const { container } = render(<PhotoParticles {...PROPS} enabled={false} />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(PROPS.src);
    expect(image?.className).toBe(PROPS.className);
    expect(image?.style.visibility).toBe("");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("keeps the photo for layout and covers it with a canvas when enabled", () => {
    // jsdom에는 Canvas 2D가 없다. 컨텍스트가 없으면 루프를 걸지 않고 조용히 서 있어야 한다
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { container } = render(<PhotoParticles {...PROPS} enabled />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(PROPS.src);
    expect(image?.className).toBe(PROPS.className);
    expect(image?.style.visibility).toBe("hidden");
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
