/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import { ComputerLogoMinigame } from "./index";

const tile = (source: RegExp) => screen.getByRole("button", { name: source });

describe("ComputerLogoMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("틀린 그림은 붉게 떴다 돌아오고, 라온 로고를 고르면 임직원 포털의 저장된 페이지가 열린다", () => {
    render(<ComputerLogoMinigame onComplete={() => {}} />);

    fireEvent.click(tile(/gate/i));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Dohae's room, the shelf. Vol. 1.")).toBeNull();
    expect(tile(/gate/i)).toHaveProperty("disabled", false);

    fireEvent.click(tile(/staff portal/i));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Dohae's room, the shelf. Vol. 1.")).toBeTruthy();
  });
});
