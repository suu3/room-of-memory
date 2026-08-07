/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { BootCurtain } from "./BootCurtain";

/**
 * 로딩 진행률도 부팅 여부도 리셋으로 되돌아가지 않는다 (한 번 받은 모델은 그대로
 * 있다) — 테스트끼리 새는 것을 막으려면 스토어를 직접 되돌려 놓아야 한다.
 */
function resetBootState() {
  useMemoryRoomStore.setState({ roomLoadProgress: 0, booted: false });
}

/** 커튼이 아직 화면에 있는가. 다 걷히면 언마운트된다. */
function curtain() {
  return screen.queryByRole("status");
}

describe("BootCurtain", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    resetBootState();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetBootState();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  /** 지금 바가 그리고 있는 값(%). */
  function percent(): number {
    return Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
  }

  it("받는 동안 진행률을 보여준다", () => {
    render(<BootCurtain />);

    act(() => useMemoryRoomStore.getState().setRoomLoadProgress(0.4));
    // 보고값으로 순간이동하지 않고 흘러간다 — 반 초면 거의 다 따라붙는다
    act(() => vi.advanceTimersByTime(500));

    expect(percent()).toBeGreaterThan(35);
    expect(percent()).toBeLessThanOrEqual(40);
    expect(screen.getByText(`Loading the room… ${percent()}%`)).toBeTruthy();
  });

  it("계단으로 튀지 않는다 — 한 프레임 만에 보고값에 닿지 않는다", () => {
    render(<BootCurtain />);

    act(() => vi.advanceTimersByTime(100));
    act(() => useMemoryRoomStore.getState().setRoomLoadProgress(0.8));
    act(() => vi.advanceTimersByTime(32));

    // 보고는 80%로 뛰었지만 바는 그 사이 어딘가를 지나는 중이다
    expect(percent()).toBeGreaterThan(0);
    expect(percent()).toBeLessThan(80);
  });

  it("셀 것이 없어도 바는 움직인다 — 멈춘 바는 고장 난 것처럼 보인다", () => {
    render(<BootCurtain />);

    act(() => vi.advanceTimersByTime(1000));

    // 아무도 보고하지 않았는데도 기어오른다. 다만 남은 구간의 몫을 넘지는 않는다
    expect(percent()).toBeGreaterThan(0);
    expect(percent()).toBeLessThanOrEqual(38);
  });

  it("다 받으면 커튼이 올라가고, 다 오른 뒤에 내려놓는다", () => {
    render(<BootCurtain />);

    act(() => useMemoryRoomStore.getState().setRoomLoadProgress(1));

    // 최소 노출 시간이 아직 안 찼다 — 다 받았어도 커튼은 그대로다
    expect(curtain()?.className).not.toContain("animate-boot-curtain-rise");

    /*
     * 걷히는 조건은 보고값이 아니라 **바가 그리고 있는 값**이 100%에 닿는 것이다
     * (useSmoothLoadProgress). 다 채우는 데 0.6초 남짓 걸리는데 최소 노출 시간이
     * 0.9초라, 바는 그 안에서 조용히 다 차고 커튼은 예전과 같은 시각에 올라간다 —
     * 값을 흐르게 만든 것이 걷히는 시각을 늦추지는 않는다.
     */
    act(() => vi.advanceTimersByTime(900));
    expect(percent()).toBe(100);
    expect(curtain()?.className).toContain("animate-boot-curtain-rise");
    // 올라가는 중에는 아직 booted가 아니다 — 커튼이 화면에 남아 있어야 한다
    expect(useMemoryRoomStore.getState().booted).toBe(false);

    act(() => vi.advanceTimersByTime(1100));
    expect(useMemoryRoomStore.getState().booted).toBe(true);
    expect(curtain()).toBeNull();
  });

  it("캐시된 판에서도 최소 노출 시간은 지킨다 — 번쩍이고 마는 걸 막는다", () => {
    useMemoryRoomStore.setState({ roomLoadProgress: 1 });
    render(<BootCurtain />);

    // 첫 프레임에 이미 100%를 받았어도 최소 노출 시간 안에는 걷히지 않는다
    act(() => vi.advanceTimersByTime(800));
    expect(curtain()?.className).not.toContain("animate-boot-curtain-rise");

    act(() => vi.advanceTimersByTime(100));
    expect(curtain()?.className).toContain("animate-boot-curtain-rise");
  });

  it("보고가 끊겨도 결국 걷어 준다 — 못 들어가는 것보다는 낫다", () => {
    render(<BootCurtain />);

    // 캔버스 청크 자체를 못 받으면 아무도 진행률을 보고하지 않는다
    act(() => vi.advanceTimersByTime(12_000));
    expect(curtain()?.className).toContain("animate-boot-curtain-rise");

    act(() => vi.advanceTimersByTime(1100));
    expect(useMemoryRoomStore.getState().booted).toBe(true);
  });

  it("한 번 걷힌 커튼은 리셋해도 다시 내려오지 않는다", () => {
    useMemoryRoomStore.setState({ booted: true });
    render(<BootCurtain />);

    expect(curtain()).toBeNull();

    act(() => useMemoryRoomStore.getState().reset());
    expect(curtain()).toBeNull();
  });
});
