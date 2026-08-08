/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { ANSWER, BOARD } from "./cards";
import { CardOddMinigame } from "./index";

function setup(onComplete = vi.fn()) {
  const { container } = render(<CardOddMinigame onComplete={onComplete} />);
  const input = container.querySelector("input") as HTMLInputElement;
  return {
    container,
    onComplete,
    answer(text: string) {
      // 슬롯 UI는 다 채우면 스스로 확인한다 — 별도 제출이 없다
      fireEvent.change(input, { target: { value: text } });
    },
    input,
  };
}

describe("CardOddMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("shows the spread as a picture, not as pickable cards", () => {
    /*
     * 미궁 문제라 카드를 골라내는 게 아니라 읽어내는 것이다. 카드가 눌리면
     * "클릭해서 찾는 게임"으로 읽혀서 입력칸이 장식이 된다.
     */
    const { container } = setup();

    expect(container.querySelectorAll("li")).toHaveLength(BOARD.length);
    // 카드 판 안에는 버튼이 하나도 없다 — 화면 키패드의 버튼은 판 밖이다
    expect(container.querySelectorAll("ul button")).toHaveLength(0);
  });

  it("gives away neither rule on screen", () => {
    // 규칙이 화면에 적히는 순간 문제가 아니라 안내가 된다 — 단서는 방 곳곳에 있다
    const { container } = setup();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/black|red|upside|symmetr/i);
    expect(text).not.toContain(ANSWER);
  });

  it("leaves the lower index upright only on the asymmetric card", () => {
    // 이 게임의 단서 자체다 — 여기가 어긋나면 대칭 오류 카드를 찾을 방법이 없다
    const { container } = setup();
    const cards = [...container.querySelectorAll("li")];

    for (const [index, card] of BOARD.entries()) {
      const lower = card.flaw === "asymmetry";
      const indices = cards[index].querySelectorAll("[data-flipped]");
      expect(indices[0].getAttribute("data-flipped")).toBe("false");
      expect(indices[1].getAttribute("data-flipped"), `${card.suit}-${card.rank}`).toBe(
        String(!lower),
      );
    }
  });

  it("puts the rotation on the index itself, not on the box that places it", () => {
    /*
     * 자리를 잡는 상자(justify-end)에 rotate-180을 걸면 상자가 통째로 돌면서 오른쪽에
     * 붙여 둔 인덱스가 왼쪽으로 넘어간다 — 정상 카드가 전부 어긋나 보였던 원인이다.
     */
    const { container } = setup();
    const rotated = container.querySelectorAll(".rotate-180");

    for (const element of rotated) {
      expect(element.getAttribute("data-flipped")).toBe("true");
      expect(element.className).not.toContain("justify-end");
    }
  });

  it("clears on the right answer", async () => {
    const { answer, onComplete } = setup();

    answer(ANSWER);

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 0 }));
  });

  it("keeps the puzzle open on a wrong answer, and says nothing about why", async () => {
    const { answer, onComplete, container } = setup();

    answer("111");

    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Wrong answers");
    // 틀린 자리를 짚어주면 답을 몰라도 좁혀 들어갈 수 있다
    expect(container.textContent).not.toMatch(/close|almost|digit/i);

    answer(ANSWER);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ cleared: true, score: 1 }));
  });

  it("ignores an empty submission", () => {
    const { answer, onComplete, container } = setup();

    answer("   ");

    expect(onComplete).not.toHaveBeenCalled();
    // 빈 칸으로 제출한 것을 오답으로 세면 세지도 않은 시도가 쌓인다
    expect(container.textContent).not.toContain("Wrong answers");
  });
});
