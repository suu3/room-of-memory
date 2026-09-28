/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("끄려 하면 라디오가 꺼졌다가 스스로 다시 켜지고, 방송은 다음 줄로 이어진다", () => {
    vi.useFakeTimers();
    render(<BroadcastBoard onComplete={vi.fn()} />);
    expect(screen.getByText("…듣고 싶지 않아.")).toBeTruthy();
    expect(screen.queryByText(i18n.t(broadcastLines[1].textKey, { ns: "memoryRoom" }))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "전원 끄기" }));
    expect(screen.getByText("…왜 안 꺼져.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText(i18n.t(broadcastLines[1].textKey, { ns: "memoryRoom" }))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "소리 줄이기" }));
    expect(screen.getByText("그만해…")).toBeTruthy();
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
