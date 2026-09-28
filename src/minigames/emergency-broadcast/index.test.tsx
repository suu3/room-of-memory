/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MEMORIES, SCRIPTS } from "@/data/memory-room";
import { i18n } from "@/i18n/config";
import { BROADCAST_SCRIPT, BroadcastBoard } from "./index";

const broadcastLines = SCRIPTS[BROADCAST_SCRIPT].lines.filter(
  (line) => line.speaker === "broadcast",
);

describe("재난 방송 (emergency-broadcast)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("라디오 1차의 결과 대사를 흘리고, 마지막 한 줄(도해)은 대사창에 남긴다", () => {
    const radio = MEMORIES.find((memory) => memory.id === "radio");
    expect(radio?.phase1?.interaction?.minigameId).toBe("emergency-broadcast");
    expect(radio?.phase1?.interaction?.resultScriptId).toBe(BROADCAST_SCRIPT);
    const lines = SCRIPTS[BROADCAST_SCRIPT].lines;
    expect(broadcastLines.length).toBeGreaterThan(0);
    // 방송 줄이 앞에 모여 있고, 끝은 도해다: 엔진은 방송 줄 수만큼 건너뛴다
    expect(
      lines.slice(0, broadcastLines.length).every((line) => line.speaker === "broadcast"),
    ).toBe(true);
    expect(lines.at(-1)?.speaker).toBe("hero");
  });

  it("조작 없이 방송이 흐르고, 도해의 속말이 하나씩 바뀐다", () => {
    vi.useFakeTimers();
    render(<BroadcastBoard onComplete={vi.fn()} />);
    const visible = (text: string) => screen.getByText(text).className.includes("opacity-100");
    // 끄는 버튼은 없다
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(visible("…듣고 싶지 않아.")).toBe(true);
    expect(visible("그만해…")).toBe(false);

    const second = i18n.t(broadcastLines[1].textKey, { ns: "memoryRoom" });
    expect(screen.queryByText(second)).toBeNull();
    // 방송이 절반을 넘으면 둘째 속말로 넘어간다
    for (let line = 1; line * 2 <= broadcastLines.length; line += 1) {
      act(() => {
        vi.advanceTimersByTime(4200);
      });
    }
    expect(screen.getByText(second)).toBeTruthy();
    expect(visible("…듣고 싶지 않아.")).toBe(false);
    expect(visible("그만해…")).toBe(true);
  });

  it("안 눌러도 방송은 흘러 끝나고, 보여준 방송 줄 수를 함께 보고한다", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<BroadcastBoard onComplete={onComplete} />);
    // 줄이 바뀔 때마다 다음 시계가 새로 걸린다: 한 줄씩 넘긴다
    for (let step = 0; step <= broadcastLines.length + 1; step += 1) {
      act(() => {
        vi.advanceTimersByTime(4200);
      });
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      cleared: true,
      shownResultLines: broadcastLines.length,
    });
  });
});
