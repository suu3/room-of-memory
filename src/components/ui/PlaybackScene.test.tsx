/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACT2_CHAIN, CUTSCENE_RADIO_BLACKOUT, PHASE1_MEMORIES } from "@/data/memory-room";
import { i18n } from "@/i18n/config";
import { openCutscene, useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "./DialogueBox";
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
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: [...ACT2_CHAIN],
      doorOpened: true,
    });
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
    useMemoryRoomStore.setState({
      activePlayback: openCutscene(CUTSCENE_RADIO_BLACKOUT),
    });
    const { container } = render(<PlaybackScene />);

    expect(container.querySelectorAll(".animate-signal-wave").length).toBeGreaterThan(20);
    expect(container.querySelector(".animate-signal-lamp")).not.toBeNull();
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip.className).toContain("bg-night/80");
    expect(skip.className).toContain("text-ivory");
  });
});
