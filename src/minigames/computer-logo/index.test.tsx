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

  it("같은 로고 하나로는 안 넘어가고, 둘 다 골라야 메일이 열린다", () => {
    render(<ComputerLogoMinigame onComplete={() => {}} />);

    fireEvent.click(tile(/IMG_2190/));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Tidy up your shelf.")).toBeNull();
    expect(tile(/IMG_2190/)).toHaveProperty("disabled", true);

    fireEvent.click(tile(/gate/i));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Tidy up your shelf.")).toBeTruthy();
  });
});
