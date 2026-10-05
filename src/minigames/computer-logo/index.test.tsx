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

  it("틀린 줄은 붉게 떴다 돌아오고, 라온 로고의 줄을 고르면 페이지를 열지 않고 곧장 끝난다", () => {
    const onComplete = vi.fn();
    render(<ComputerLogoMinigame onComplete={onComplete} />);

    // 접속 기록답게 줄마다 들어간 시각이 붙는다. 연구소 이름은 아직 없다
    expect(screen.getByText("Oct 16, 23:40")).toBeTruthy();
    expect(screen.queryByText(/Laon/)).toBeNull();

    fireEvent.click(tile(/gate/i));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(tile(/gate/i)).toHaveProperty("disabled", false);

    fireEvent.click(tile(/staff portal/i));
    // 맞힌 줄에서 연구소 이름이 처음 나온다
    expect(screen.getByText(/Laon Life Science Institute/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ cleared: true });
  });

  it("결과 대사 단계에서는 맞힌 줄이 선 채로 멈춘다", () => {
    render(<ComputerLogoMinigame stage="result" onComplete={() => {}} />);

    expect(screen.getByText(/Laon Life Science Institute/)).toBeTruthy();
    expect(tile(/gate/i)).toHaveProperty("disabled", true);
  });
});
