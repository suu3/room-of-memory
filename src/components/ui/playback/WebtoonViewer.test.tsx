/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUTSCENES } from "@/data/memory-room";
import { i18n } from "@/i18n/config";
import { type ActivePlayback, useMemoryRoomStore } from "@/store/memory-room";
import { WebtoonViewer } from "./WebtoonViewer";

const CUTS = CUTSCENES["survivor-broadcast"].cuts;
/** 말풍선이 있는 첫 칸. */
const SPOKEN = CUTS.findIndex((cut) => cut.page !== undefined && cut.lines.length > 0);

const playbackAt = (cutIndex: number): ActivePlayback => ({
  kind: "cutscene",
  cutsceneId: "survivor-broadcast",
  cuts: CUTS,
  cutIndex,
  lineIndex: 0,
  intro: false,
  holding: false,
});

/** 아직 안 찍혀 자리만 지키는 글자 수. 0이면 말풍선이 다 찼다. */
const unprinted = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("p span.invisible")).reduce(
    (sum, span) => sum + (span.textContent?.length ?? 0),
    0,
  );

describe("웹툰 컷씬의 누르기", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useMemoryRoomStore.getState().reset();
  });

  it("찍히는 중에 누르면 말풍선이 한 번에 다 찬다", () => {
    const { container } = render(<WebtoonViewer active={playbackAt(SPOKEN)} />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(unprinted(container)).toBeGreaterThan(0);

    fireEvent.click(container.querySelector("[data-webtoon-advance]") as HTMLElement);
    expect(container.querySelector("p span.invisible")).not.toBeNull();
    expect(unprinted(container)).toBe(0);
  });

  it("칸이 아직 뜨는 중에 눌러도 한 글자씩 찍지 않고 다 찬다", () => {
    const { container } = render(<WebtoonViewer active={playbackAt(SPOKEN)} />);
    // 칸이 떠오르기 전: 말풍선이 아직 없다
    expect(container.querySelector("p span.invisible")).toBeNull();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(container.querySelector("p span.invisible")).not.toBeNull();
    expect(unprinted(container)).toBe(0);
  });

  it("오토가 아니면 다 찍힌 말풍선이 누를 때까지 기다린다", () => {
    const advancePlayback = vi.fn();
    useMemoryRoomStore.setState({ autoPlay: false, advancePlayback });
    const { container } = render(<WebtoonViewer active={playbackAt(SPOKEN)} />);
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(advancePlayback).not.toHaveBeenCalled();
    // 다 찍혔다는 신호: 넘김 화살표
    expect(container.querySelector(".animate-bob-arrow")).not.toBeNull();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(advancePlayback).toHaveBeenCalledTimes(1);
  });

  it("오토면 다 찍힌 말풍선이 저절로 넘어간다", () => {
    const advancePlayback = vi.fn();
    useMemoryRoomStore.setState({ autoPlay: true, advancePlayback });
    const { container } = render(<WebtoonViewer active={playbackAt(SPOKEN)} />);
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(container.querySelector(".animate-bob-arrow")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(advancePlayback).toHaveBeenCalledTimes(1);
  });
});
