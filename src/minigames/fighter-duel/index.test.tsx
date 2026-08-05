/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import {
  BASE_DAMAGE,
  COMBO_STEP,
  CRITICAL_MS,
  CRITICAL_SCALE,
  FEINT_AT,
  MAX_HP,
  tellDurationMs,
} from "./duel";
import { FighterDuelMinigame } from "./index";

let now = 0;
let nextFrameId = 1;
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

/** 프레임 간격(ms). 게임은 프레임이 끊기면 시계를 멈추므로 촘촘히 돌려야 한다. */
const FRAME_STEP = 100;

/** 간파 판정이 확실히 지난 시점. 창 길이가 바뀌어도 "빨리 못 낸 판"으로 남아야 한다. */
const PAST_CRITICAL_MS = CRITICAL_MS + FRAME_STEP;

/** 실제 브라우저처럼 프레임을 이어서 돌린다 — 마지막 프레임이 `timestamp`에 선다. */
function runFramesUntil(timestamp: number) {
  for (let frame = now + FRAME_STEP; frame < timestamp; frame += FRAME_STEP) {
    runNextFrame(frame);
  }
  runNextFrame(timestamp);
}

/** 예고 문구 → 그걸 받아치는 수의 키. 플레이어가 화면에서 읽는 것과 같은 경로. */
const COUNTER_KEY: Record<string, string> = {
  "They pull a shoulder back": "2", // strike → guard
  "They raise both arms overhead": "3", // guard → throw
  "They reach both arms forward": "1", // throw → strike
};

function currentTell(): string {
  const status = screen.getByRole("status");
  const tell = Object.keys(COUNTER_KEY).find((text) => status.textContent?.includes(text));
  if (!tell) throw new Error(`No tell on screen: ${status.textContent}`);
  return tell;
}

function answerTell() {
  fireEvent.keyDown(window, { key: COUNTER_KEY[currentTell()] });
}

function rivalHp(): number {
  return Number(screen.getByLabelText("CPU").getAttribute("value"));
}

function heroHp(): number {
  return Number(screen.getByLabelText("P1").getAttribute("value"));
}

const INTRO_MS = 900;
const RESULT_MS = 850;
const KO_MS = 1500;

describe("FighterDuelMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    now = 0;
    nextFrameId = 1;
    scheduledFrames = new Map();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    // 0이면 salt도 0이라 예고 순서가 고정되고, 페인트 판정(roll < chance)은 항상 걸린다.
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
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the ready banner with both fighters at full health", () => {
    const html = renderToStaticMarkup(<FighterDuelMinigame onComplete={() => {}} />);

    expect(html).toContain("FIGHT!");
    expect(html).toContain("ROUND 1");
    expect(html).toContain("P1");
    expect(html).toContain("CPU");
    expect(html.match(/value="100"/g)).toHaveLength(2);
  });

  it("holds the round until the opening banner clears", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);

    // 배너가 떠 있는 동안 낸 수는 먹지 않는다 — 예고를 보기도 전이다
    fireEvent.keyDown(window, { key: "1" });
    expect(rivalHp()).toBe(MAX_HP);

    advanceTime(INTRO_MS);
    expect(screen.getByRole("status").textContent).toContain("They reach both arms forward");
  });

  it("locks the move buttons while there is nothing to answer", () => {
    // UT: "버튼을 눌러도 아무 반응이 없다" — 낼 차례가 아닌 구간이 눌리는 것처럼 보였다.
    render(<FighterDuelMinigame onComplete={() => {}} />);
    const strike = () => screen.getByRole("button", { name: /Strike/ }) as HTMLButtonElement;
    expect(strike().disabled).toBe(true); // 시작 배너 동안

    advanceTime(INTRO_MS);
    expect(strike().disabled).toBe(false); // 예고가 걸린 동안

    answerTell();
    expect(strike().disabled).toBe(true); // 결과 연출 동안

    advanceTime(RESULT_MS);
    expect(strike().disabled).toBe(false);
  });

  it("pays a critical for the read that lands inside the window", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);

    answerTell();

    expect(screen.getByText("READ!")).toBeTruthy();
    expect(rivalHp()).toBe(MAX_HP - Math.round(BASE_DAMAGE * CRITICAL_SCALE));
  });

  it("pays the plain damage once the read window has passed", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    runNextFrame(now);
    runFramesUntil(now + PAST_CRITICAL_MS);

    answerTell();

    expect(screen.queryByText("READ!")).toBeNull();
    expect(screen.getByText("Clean hit!")).toBeTruthy();
    expect(rivalHp()).toBe(MAX_HP - BASE_DAMAGE);
  });

  it("stacks damage for reads in a row", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    runNextFrame(now);
    runFramesUntil(now + PAST_CRITICAL_MS);
    answerTell();
    const afterFirst = rivalHp();

    advanceTime(RESULT_MS);
    runNextFrame(now);
    runFramesUntil(now + PAST_CRITICAL_MS);
    answerTell();

    expect(afterFirst - rivalHp()).toBe(BASE_DAMAGE + COMBO_STEP);
  });

  it("switches the stance mid-round and says so", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    answerTell();
    advanceTime(RESULT_MS);

    // 2라운드부터 페인트가 걸린다 (roll 0 < feintChance). 전환은 프레임에서 일어난다.
    const before = currentTell();
    // 시계는 예고가 그려지는 첫 프레임에 시작한다 — 그 프레임부터 재야 한다
    runNextFrame(now);
    const roundStart = now;
    const duration = tellDurationMs(1, rivalHp());
    runFramesUntil(roundStart + duration * FEINT_AT + 1);

    expect(currentTell()).not.toBe(before);
    expect(screen.getByText("They switched stance!")).toBeTruthy();

    // 바뀐 자세를 받아치면 이긴다 — 처음 예고를 그대로 믿었으면 졌을 자리다
    answerTell();
    expect(screen.getByText("Clean hit!")).toBeTruthy();
  });

  it("takes the hit when the round runs out with no answer", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    runNextFrame(now);
    const roundStart = now;

    runFramesUntil(roundStart + tellDurationMs(0, MAX_HP));

    expect(screen.getByText("Too slow…")).toBeTruthy();
    expect(heroHp()).toBeLessThan(MAX_HP);
    expect(rivalHp()).toBe(MAX_HP);
  });

  it("does not start the clock until the tell has actually been drawn", () => {
    // 게임이 뜨는 순간 3D 씬·청크 로드로 메인 스레드가 붙잡히는 자리다. 그 시간이
    // 라운드 시간으로 세어지면 플레이어는 예고를 보기도 전에 한 대 맞는다.
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    advanceTime(5_000);

    runNextFrame(now);

    expect(screen.queryByText("Too slow…")).toBeNull();
    expect(heroHp()).toBe(MAX_HP);
  });

  it("does not count a frozen screen against the round", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    advanceTime(INTRO_MS);
    runNextFrame(now);

    // 탭이 가려졌다 돌아온 자리 — 프레임이 통째로 비었다
    runNextFrame(now + 5_000);

    expect(screen.queryByText("Too slow…")).toBeNull();
    expect(heroHp()).toBe(MAX_HP);

    // 돌아온 뒤로는 정상적으로 시간이 간다
    runFramesUntil(now + tellDurationMs(0, MAX_HP));
    expect(screen.getByText("Too slow…")).toBeTruthy();
  });

  it("reports the knockout once, after the K.O. beat", () => {
    const onComplete = vi.fn();
    render(<FighterDuelMinigame onComplete={onComplete} />);
    advanceTime(INTRO_MS);

    // 매번 간파로 받아친다 — 24 + 30 + 36 + 42 로 네 라운드 만에 끝난다
    for (let round = 0; round < 4; round += 1) {
      answerTell();
      if (round < 3) advanceTime(RESULT_MS);
    }

    expect(rivalHp()).toBe(0);
    expect(screen.getByText("K.O.")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    advanceTime(KO_MS);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: MAX_HP });

    // 승부가 난 뒤의 입력은 아무것도 바꾸지 않는다
    fireEvent.keyDown(window, { key: "1" });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("locks the panel before reporting, so a stray click cannot cancel the win", () => {
    const onSettled = vi.fn();
    render(<FighterDuelMinigame onComplete={() => {}} onSettled={onSettled} />);
    advanceTime(INTRO_MS);

    for (let round = 0; round < 4; round += 1) {
      answerTell();
      if (round < 3) advanceTime(RESULT_MS);
    }

    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("cancels the pending report when unmounted mid-knockout", () => {
    const onComplete = vi.fn();
    const view = render(<FighterDuelMinigame onComplete={onComplete} />);
    advanceTime(INTRO_MS);

    for (let round = 0; round < 4; round += 1) {
      answerTell();
      if (round < 3) advanceTime(RESULT_MS);
    }

    view.unmount();
    advanceTime(KO_MS);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("offers the skip as soon as the player has taken real damage", () => {
    const onComplete = vi.fn();
    render(<FighterDuelMinigame onComplete={onComplete} />);
    advanceTime(INTRO_MS);
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

    // 두 번 맞으면(시간 초과 포함) 스킵이 열린다 — 접근성 규칙상 실패가 막다른 길이면 안 된다
    runNextFrame(now);
    runFramesUntil(now + tellDurationMs(0, MAX_HP));
    advanceTime(RESULT_MS);
    runNextFrame(now);
    runFramesUntil(now + tellDurationMs(1, MAX_HP));

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: heroHp() });
  });
});
