import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import "@/i18n/config";
import { ArActionPicker } from "./ArActionPicker";

afterEach(cleanup);

it("offers all AR actions in order and selects batting from the last button", () => {
  const select = vi.fn();
  render(<ArActionPicker value="toss" onChange={select} />);

  expect(screen.getByRole("group", { name: "캐릭터 동작" })).toBeTruthy();
  const buttons = screen.getAllByRole("button");
  expect(buttons.map((button) => button.textContent?.trim())).toEqual([
    "⚾공 던지기",
    "🧍서 있기",
    "🚶제자리 걷기",
    "🪑앉기",
    "🏏배트 휘두르기",
  ]);
  expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  expect(buttons[4].getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(buttons[4]);
  expect(select).toHaveBeenCalledWith("bat");
});
