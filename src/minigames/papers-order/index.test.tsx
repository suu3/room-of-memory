/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { PapersOrderMinigame } from "./index";

/** 판 위의 조각 버튼들 (위에서부터). 날짜로 알아본다. */
function pieces() {
  return screen.getAllByRole("button", { name: /^Position \d/ });
}

function pieceAt(date: string) {
  const index = pieces().findIndex((button) => button.textContent?.startsWith(date));
  if (index < 0) throw new Error(`조각이 없다: ${date}`);
  return index;
}

describe("PapersOrderMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("조각 둘을 차례로 누르면 맞바뀌고, 날짜순이 되면 내려놓아 끝난다", () => {
    const onComplete = vi.fn();
    render(<PapersOrderMinigame onComplete={onComplete} />);
    expect(screen.queryByRole("button", { name: "Put it down" })).toBeNull();

    // 날짜순으로 한 자리씩 채운다: 그 자리에 올 조각을 집어 그 자리에 놓는다
    ["Sep 28", "Oct 9", "Oct 15", "Oct 16"].forEach((date, slot) => {
      const from = pieceAt(date);
      if (from === slot) return;
      fireEvent.click(pieces()[from]);
      fireEvent.click(pieces()[slot]);
    });

    const done = screen.getByRole("button", { name: "Put it down" });
    fireEvent.click(done);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ cleared: true, celebrated: true });
  });

  it("키보드: Space로 집고 ↓로 옮긴다", () => {
    render(<PapersOrderMinigame onComplete={() => {}} />);
    const before = pieces().map((button) => button.textContent);
    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.keyDown(window, { code: "ArrowDown" });
    const after = pieces().map((button) => button.textContent);
    expect(after[1]).toBe(before[0]);
    expect(after[0]).toBe(before[1]);
  });
});
