/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import { ASSETS } from "../../lib/assets";
import type { MinigameResult } from "../../types/minigame";
import { WindowViewMinigame } from "./index";

describe("WindowViewMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  it("shows the view outside", () => {
    const { container } = render(<WindowViewMinigame onComplete={() => {}} />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(ASSETS.images.mgWindowViewOutside);
    // 그림만 덩그러니 두지 않는다 — 무엇을 하는 화면인지 한 줄이 같이 붙는다.
    expect(screen.getByText("Draw the curtain and look outside")).toBeTruthy();
  });

  it("collects the memory once, when the curtain closes", () => {
    const results: MinigameResult[] = [];
    render(<WindowViewMinigame onComplete={(result) => results.push(result)} />);

    const close = screen.getByRole("button", { name: /Close the curtain/ });
    fireEvent.click(close);
    fireEvent.click(close);

    expect(results).toEqual([{ cleared: true }]);
  });

  it("reports nothing until the player closes it", () => {
    const onComplete = vi.fn();
    render(<WindowViewMinigame onComplete={onComplete} />);

    // 창을 열어만 두고 방으로 돌아가면(백드롭 클릭) 아무 일도 없었던 것으로 남는다.
    expect(onComplete).not.toHaveBeenCalled();
  });
});
