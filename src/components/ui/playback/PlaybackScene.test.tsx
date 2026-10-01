/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUTSCENE_RADIO_BLACKOUT } from "@/data/memory-room";
import { progressAt } from "@/data/story-phase";
import { i18n } from "@/i18n/config";
import { openCutscene, useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "../dialogue/DialogueBox";
import { WHISPER_SHOW_MS } from "./CutWhispers";
import { PlaybackScene } from "./PlaybackScene";

describe("배트를 쥐는 두 줄의 화면", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    // 모션을 끈 판: 타자 연출을 기다리지 않고 본문이 한 번에 선다
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    );
    useMemoryRoomStore.getState().reset();
    useMemoryRoomStore.setState(progressAt("resolve") as never);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useMemoryRoomStore.getState().reset();
  });

  it("방을 덮지 않는다. 회색 판 없이 눌러만 두고, 첫 줄이 바로 뜬다", () => {
    /*
     * 그림 있는 컷씬(라디오)은 화면을 통째로 덮고 그림이 없어도 회색 판이 자리를
     * 지키지만, 배트를 쥐는 두 줄은 지금 이 현관에서 하는 말이다. 공간이 비쳐야
     * 하고, 라디오가 지직거리다 꺼지는 도입도 없이 곧장 첫 줄이어야 한다.
     */
    const { container } = render(
      <>
        <PlaybackScene />
        <DialogueBox />
      </>,
    );
    act(() => {
      useMemoryRoomStore.getState().takeBat();
    });

    // 회색 일러스트 판이 서지 않는다
    expect(container.querySelector(".bg-scene-storm")).toBeNull();
    // 통짜 암막(bg-scene-void)이 아니라 반투명으로 방을 눌러만 둔다
    expect(container.querySelector(".bg-scene-void\\/80")).not.toBeNull();
    // 도입 없이 첫 줄이 곧장: 대사창이 이미 떠 있다
    expect(
      screen.getByText("Three years with this bat. All I ever hit with it was a ball."),
    ).toBeTruthy();
  });

  it("전환 컷씬은 그림이 아직 없어도 빈 판으로 서지 않는다", () => {
    /*
     * 라디오 너머 첫 목소리는 게임 전체의 전환점이다. 일러스트가 리포에 없는 동안
     * 회색 판 하나로 지나가면 안 된다. 파형·램프·주사선이 판을 채우고, 건너뛰기는
     * 어두운 그림 위에서도 보이는 대비로 선다.
     */
    const opened = openCutscene(CUTSCENE_RADIO_BLACKOUT);
    if (!opened) throw new Error("radio-blackout 컷씬이 없다");
    // 그림 앞의 검정 컷(꺼진 라디오 · 정적 · 방송)을 지나 첫 그림 컷
    const firstPicture = opened.cuts.findIndex((cut) => cut.image !== undefined);
    useMemoryRoomStore.setState({ activePlayback: { ...opened, cutIndex: firstPicture } });
    const { container } = render(<PlaybackScene />);

    expect(container.querySelectorAll(".animate-signal-wave").length).toBeGreaterThan(20);
    expect(container.querySelector(".animate-signal-lamp")).not.toBeNull();
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip.className).toContain("bg-night/80");
    expect(skip.className).toContain("text-ivory");
  });

  it("검정 화면 컷은 그림도 신호의 판도 세우지 않는다", () => {
    /*
     * 과거편의 마지막 컷: 그날에서 지금으로 건너오는 두 줄은 어둠 위에만 선다.
     * 그림 없는 컷의 자리를 신호의 판(파형)이 채우면 방송 화면으로 읽힌다.
     */
    const opened = openCutscene(CUTSCENE_RADIO_BLACKOUT);
    if (!opened) throw new Error("radio-blackout 컷씬이 없다");
    const last = opened.cuts.length - 1;
    expect(opened.cuts[last]?.black).toBe(true);
    useMemoryRoomStore.setState({ activePlayback: { ...opened, cutIndex: last } });
    const { container } = render(<PlaybackScene />);

    expect(container.querySelector(".animate-signal-wave")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("라디오 방송 컷에서는 도해의 속말이 한 줄씩 떴다 지기를 되풀이한다", () => {
    vi.useFakeTimers();
    try {
      const opened = openCutscene(CUTSCENE_RADIO_BLACKOUT);
      if (!opened) throw new Error("radio-blackout 컷씬이 없다");
      const broadcast = opened.cuts.findIndex((cut) => cut.whisperKeys !== undefined);
      expect(opened.cuts[broadcast]?.lines[0]?.speaker).toBe("broadcast");
      useMemoryRoomStore.setState({ activePlayback: { ...opened, cutIndex: broadcast } });
      render(<PlaybackScene />);
      const shown = (text: string) => screen.getByText(text).className.includes("opacity-100");
      const first = "…I don't want to hear this.";
      const second = "Stop…";

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(shown(first)).toBe(true);
      expect(shown(second)).toBe(false);
      // 가라앉았다가
      act(() => {
        vi.advanceTimersByTime(WHISPER_SHOW_MS);
      });
      expect(shown(first)).toBe(false);
      // 다음 줄이 뜨고, 다시 첫 줄로 돈다. 줄이 바뀐 뒤의 시계는 렌더가 끝나야 걸리므로 두 번에 나눠 흘린다
      const step = (ms: number) => {
        act(() => {
          vi.advanceTimersByTime(ms);
        });
      };
      step(1500);
      step(100);
      expect(shown(second)).toBe(true);
      step(WHISPER_SHOW_MS + 1500);
      step(100);
      expect(shown(first)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("대사 없는 컷이 같은 정적으로 이어져도 컷마다 저절로 넘어간다", () => {
    /*
     * 이미지 나열(학교 → 엘리베이터 → …)은 컷마다 holdMs가 같고 대사가 없다. 컷이
     * 바뀌어도 holding·holdMs가 그대로라 타이머가 다시 걸리지 않으면 둘째 컷에서 선다.
     */
    vi.useFakeTimers();
    try {
      const opened = openCutscene(CUTSCENE_RADIO_BLACKOUT);
      if (!opened) throw new Error("radio-blackout 컷씬이 없다");
      const hold = { image: "/assets/images/cutscene-day-3.webp", holdMs: 1800, lines: [] };
      useMemoryRoomStore.setState({
        activePlayback: { ...opened, cuts: [hold, hold, hold, hold], holding: true },
      });
      render(<PlaybackScene />);
      const cutIndex = () => useMemoryRoomStore.getState().activePlayback?.cutIndex;

      for (const expected of [1, 2, 3]) {
        act(() => {
          vi.advanceTimersByTime(hold.holdMs);
        });
        expect(cutIndex()).toBe(expected);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("내레이션 컷은 누르지 않아도 줄마다 새로 찍히며 흐르고, 다 찍히면 다음 컷으로 간다", () => {
    /*
     * 분기점 과거편: 회상은 사람이 넘기는 대화가 아니다. 오토를 켜지 않아도 한 줄씩
     * 새로 찍히고(앞 줄은 창에서 비워진다), 마지막 줄까지 읽을 틈을 준 뒤 다음 컷으로 넘어간다.
     */
    vi.useFakeTimers();
    try {
      const opened = openCutscene(CUTSCENE_RADIO_BLACKOUT);
      if (!opened) throw new Error("radio-blackout 컷씬이 없다");
      const firstPicture = opened.cuts.findIndex((cut) => cut.image !== undefined);
      useMemoryRoomStore.setState({
        activePlayback: { ...opened, cutIndex: firstPicture },
        autoPlay: false,
      });
      render(
        <>
          <PlaybackScene />
          <DialogueBox />
        </>,
      );
      const playback = () => useMemoryRoomStore.getState().activePlayback;
      const first = playback()?.cuts[firstPicture];
      expect(first?.narration).toBe(true);
      const count = first?.lines.length ?? 0;
      expect(count).toBeGreaterThan(1);
      const firstKey = first?.lines[0].textKey;
      if (!firstKey) throw new Error("첫 컷에 대사가 없다");
      const firstText = i18n.getFixedT(null, "memoryRoom")(firstKey);

      for (let line = 1; line < count; line++) {
        act(() => {
          vi.advanceTimersByTime(6000);
        });
        expect(playback()?.lineIndex).toBe(line);
        // 앞 줄에 덧붙지 않고 창을 비우고 새로 친다
        expect(screen.queryByText(firstText)).toBeNull();
      }
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(playback()?.cutIndex).toBe(firstPicture + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
