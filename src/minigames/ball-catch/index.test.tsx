/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import { ASSETS } from "../../lib/assets";
import { BallCatchMinigame } from "./index";

let now = 0;
let nextFrameId = 1;
let reducedMotion = false;
let scheduledFrames = new Map<number, FrameRequestCallback>();

function advanceTime(ms: number) {
  now += ms;
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function runNextFrame(timestamp: number) {
  now = timestamp;
  const next = scheduledFrames.entries().next().value;
  if (!next) throw new Error("Expected a scheduled animation frame");
  const [id, callback] = next;
  scheduledFrames.delete(id);
  act(() => callback(timestamp));
}

function getFieldButton() {
  return screen.getByRole("button", { name: /square frame/ });
}

/**
 * 클리어까지 필요한 3안타(이지)를 친다.
 *
 * 첫 공은 튜토리얼 피치라 느리다(1700 × 1.18 = 2006). 그 뒤 라운드 길이는 안타를
 * 칠 때마다 짧아진다(1700에서 150씩, 하한 1200). 다만 다음 라운드 길이는 "그 안타를
 * 칠 때의 catches" 기준이라 한 박자 늦게 반영된다. 판정 구간이 진행률 0.78~1.12라
 * 기준 길이(1700)에 누르면 느린 공에도 맞는다.
 */
const ROUND_DURATIONS = [1700, 1700, 1550];

function hitAllRounds() {
  ROUND_DURATIONS.forEach((duration, index) => {
    if (index > 0) advanceTime(550);
    advanceTime(duration);
    fireEvent.click(getFieldButton());
  });
}

describe("BallCatchMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    now = 0;
    nextFrameId = 1;
    reducedMotion = false;
    scheduledFrames = new Map();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId;
        nextFrameId += 1;
        scheduledFrames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        scheduledFrames.delete(id);
      }),
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: reducedMotion,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("connects the batting field to the initial round HUD", () => {
    const html = renderToStaticMarkup(<BallCatchMinigame onComplete={() => {}} />);

    expect(html).toContain(`src="${ASSETS.images.mgBallCatchSunsetField}"`);
    expect(html).toContain(`src="${ASSETS.images.mgBallCatchPitcher}"`);
    expect(html).toContain("HITS 0 / 3");
    expect(html).toContain("Chances left");
    expect(html).toContain("5 / 5");
    // 키보드 기기 기준 문구: 터치 기기에서는 "TAP"으로 바뀐다 (src/i18n/control-hint.ts)
    expect(html).toContain("SPACE");
  });

  it("renders the localized hit progress only once", () => {
    const html = renderToStaticMarkup(<BallCatchMinigame onComplete={() => {}} />);

    expect(html.match(/0 \/ 3/g)).toHaveLength(1);
  });

  it("uses a restrained ball path when reduced motion is preferred", () => {
    const defaultView = render(<BallCatchMinigame onComplete={() => {}} />);
    // 첫 공은 튜토리얼 피치(2006ms): 그 절반이 정확히 진행률 0.5다
    runNextFrame(1003);
    const defaultBall = defaultView.container.querySelector<HTMLDivElement>(
      `div[style*="${ASSETS.images.mgBallCatchBall}"]`,
    );
    expect(defaultBall).not.toBeNull();
    const defaultStyle = {
      opacity: defaultBall?.style.opacity,
      left: defaultBall?.style.left,
      top: defaultBall?.style.top,
      transform: defaultBall?.style.transform,
    };
    defaultView.unmount();

    now = 0;
    scheduledFrames.clear();
    reducedMotion = true;
    const reducedView = render(<BallCatchMinigame onComplete={() => {}} />);
    runNextFrame(1003);
    const reducedBall = reducedView.container.querySelector<HTMLDivElement>(
      `div[style*="${ASSETS.images.mgBallCatchBall}"]`,
    );

    expect(defaultStyle).toEqual({
      opacity: "1",
      // 첫 투구는 Math.random=0 → 오른쪽으로 최소 폭(8)만큼 치우친 58%에서 출발한다
      left: "54%",
      top: "51.5%",
      transform: "translate(-50%, -50%) scale(0.5963708265778848) rotate(135deg)",
    });
    expect({
      opacity: reducedBall?.style.opacity,
      left: reducedBall?.style.left,
      top: reducedBall?.style.top,
      transform: reducedBall?.style.transform,
    }).toEqual({
      opacity: "0.775",
      left: "54%",
      top: "62%",
      transform: "translate(-50%, -50%) scale(1.075) rotate(0deg)",
    });
  });

  it("replaces the reduced-motion hit launch with an in-place fade", () => {
    const defaultView = render(<BallCatchMinigame onComplete={() => {}} />);
    advanceTime(1700);
    fireEvent.click(getFieldButton());
    runNextFrame(1890);
    const defaultBall = defaultView.container.querySelector<HTMLDivElement>(
      `div[style*="${ASSETS.images.mgBallCatchBall}"]`,
    );
    expect({
      opacity: defaultBall?.style.opacity,
      left: defaultBall?.style.left,
      top: defaultBall?.style.top,
      transform: defaultBall?.style.transform,
    }).toEqual({
      opacity: "0.825",
      left: "71%",
      top: "28%",
      transform: "translate(-50%, -50%) scale(0.925) rotate(480deg)",
    });
    defaultView.unmount();

    now = 0;
    scheduledFrames.clear();
    reducedMotion = true;
    const reducedView = render(<BallCatchMinigame onComplete={() => {}} />);
    advanceTime(1700);
    fireEvent.click(getFieldButton());
    runNextFrame(1890);
    const reducedBall = reducedView.container.querySelector<HTMLDivElement>(
      `div[style*="${ASSETS.images.mgBallCatchBall}"]`,
    );

    expect({
      opacity: reducedBall?.style.opacity,
      left: reducedBall?.style.left,
      top: reducedBall?.style.top,
      transform: reducedBall?.style.transform,
    }).toEqual({
      opacity: "0.5",
      left: "50%",
      top: "68%",
      transform: "translate(-50%, -50%) scale(1.3) rotate(270deg)",
    });
  });

  it("cancels delayed final-hit completion when unmounted", () => {
    const onComplete = vi.fn();
    const view = render(<BallCatchMinigame onComplete={onComplete} />);

    hitAllRounds();
    expect(onComplete).not.toHaveBeenCalled();

    view.unmount();
    advanceTime(550);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("preserves normal delayed completion after the final hit", () => {
    const onComplete = vi.fn();
    render(<BallCatchMinigame onComplete={onComplete} />);

    hitAllRounds();
    advanceTime(549);
    expect(onComplete).not.toHaveBeenCalled();

    advanceTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 3 });
  });

  it("does not replay resolved-round feedback or change progress on repeat input", () => {
    const onComplete = vi.fn();
    render(<BallCatchMinigame onComplete={onComplete} />);

    advanceTime(1700);
    fireEvent.click(getFieldButton());
    const feedback = screen.getByText("HIT!");
    const impact = document.querySelector<HTMLImageElement>(
      `img[src="${ASSETS.images.mgBallCatchImpact}"]`,
    );

    fireEvent.click(getFieldButton());

    expect(screen.getByText("HIT!")).toBe(feedback);
    expect(
      document.querySelector<HTMLImageElement>(`img[src="${ASSETS.images.mgBallCatchImpact}"]`),
    ).toBe(impact);
    expect(screen.getByText("HITS 1 / 3")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not intercept Space from native interactive controls or editable content", () => {
    render(<BallCatchMinigame onComplete={() => {}} />);
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const targets = [
      document.createElement("button"),
      document.createElement("a"),
      document.createElement("input"),
      document.createElement("select"),
      document.createElement("textarea"),
      editable,
    ];

    for (const target of targets) {
      document.body.append(target);
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Space",
      });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      target.remove();
    }
  });

  it("lets focused Skip handle Space while global Space elsewhere still swings", () => {
    const onComplete = vi.fn();
    render(<BallCatchMinigame onComplete={onComplete} />);

    fireEvent.keyDown(document.body, { code: "Space" });
    expect(screen.getByText("EARLY")).toBeTruthy();

    advanceTime(30_000);
    const skip = screen.getByRole("button", { name: "Skip" });
    skip.focus();
    const keydown = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Space",
    });
    const shouldRunNativeAction = skip.dispatchEvent(keydown);
    if (shouldRunNativeAction) skip.click();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 0 });
  });
});
