/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { AngleTurnMinigame } from "./index";
import { ANSWER, ANSWER_LENGTH, PAIRS } from "./rotation";

function setup(onComplete = vi.fn()) {
  const { container } = render(<AngleTurnMinigame onComplete={onComplete} />);
  const input = container.querySelector("input") as HTMLInputElement;
  const form = container.querySelector("form") as HTMLFormElement;
  return {
    container,
    onComplete,
    input,
    answer(text: string) {
      fireEvent.change(input, { target: { value: text } });
      fireEvent.submit(form);
    },
  };
}

describe("AngleTurnMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("stands up every pair", () => {
    const { container } = setup();

    expect(container.querySelectorAll("li")).toHaveLength(PAIRS.length);
    for (const pair of PAIRS) {
      expect(container.textContent).toContain(pair.from);
      expect(container.textContent).toContain(pair.to);
    }
  });

  it("shows how many digits the answer has, and nothing else about it", () => {
    const { container } = setup();

    expect(container.textContent).toContain("_".repeat(ANSWER_LENGTH));
    expect(container.textContent).not.toContain(ANSWER);
    // 각도가 화면에 적히면 돌려볼 것도 없이 이어 적기만 하면 된다
    for (const pair of PAIRS) {
      expect(container.textContent).not.toContain(String(pair.degrees));
    }
  });

  it("survives a language it was not written in", () => {
    /*
     * 문제가 한글 낱글자를 쓰지만 읽을 필요가 없다는 게 이 퍼즐의 전제다 —
     * 언어를 바꿔도 글자 세 쌍은 그대로 서 있어야 한다.
     */
    const { container } = setup();

    for (const pair of PAIRS) expect(container.textContent).toContain(pair.from);
  });

  it("clears on the right answer", async () => {
    const { answer, onComplete } = setup();

    answer(ANSWER);

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 0 }));
  });

  it("keeps the puzzle open on a wrong answer, and says nothing about why", async () => {
    const { answer, onComplete, container } = setup();

    answer("4518090");

    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Wrong answers");
    // 어느 쌍이 틀렸는지 짚어주면 세 쌍이 따로 풀린다
    expect(container.textContent).not.toMatch(/first|second|third|pair/i);

    answer(ANSWER);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 1 }));
  });

  it("ignores an empty submission", () => {
    const { answer, onComplete, container } = setup();

    answer("   ");

    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Wrong answers");
  });
});
