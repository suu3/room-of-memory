/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import type { MinigameResult } from "../../types/minigame";
import { MAIL_PAGES, NEWS_PAGES } from "./archive";
import { ComputerBrowseMinigame } from "./index";

describe("ComputerBrowseMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  it("1바퀴는 메일함이다 — 끝까지 넘겨 닫으면 한 번만 완료된다", () => {
    const results: MinigameResult[] = [];
    render(<ComputerBrowseMinigame gamePhase={1} onComplete={(result) => results.push(result)} />);

    // 첫 메일: 제목과 첨부 사진 자리가 선다
    expect(screen.getByText(i18n.t(MAIL_PAGES[0].titleKey))).toBeTruthy();
    expect(screen.getByText("IMG_2183.jpg")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText(i18n.t(MAIL_PAGES[1].titleKey))).toBeTruthy();

    const close = screen.getByRole("button", { name: /Turn the computer off/ });
    fireEvent.click(close);
    fireEvent.click(close);
    expect(results).toEqual([{ cleared: true }]);
  });

  it("2바퀴는 뉴스 캐시다 — 마지막 기사는 저장이 끊긴 표시가 붙는다", () => {
    render(<ComputerBrowseMinigame gamePhase={2} onComplete={() => {}} />);

    expect(screen.getByText(i18n.t(NEWS_PAGES[0].titleKey))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(screen.getByText(i18n.t(NEWS_PAGES[2].titleKey))).toBeTruthy();
    expect(screen.getByText(/the saved copy ends here/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Turn the computer off/ })).toBeTruthy();
  });

  it("키보드(Space/→)로도 넘어간다", () => {
    render(<ComputerBrowseMinigame gamePhase={2} onComplete={() => {}} />);

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByText(i18n.t(NEWS_PAGES[1].titleKey))).toBeTruthy();
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(screen.getByText(i18n.t(NEWS_PAGES[2].titleKey))).toBeTruthy();
  });

  it("다 읽기 전에는 완료를 보고하지 않는다", () => {
    const onComplete = vi.fn();
    render(<ComputerBrowseMinigame gamePhase={1} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Turn the computer off/ })).toBeNull();
  });

  it("결과 대사 단계에서는 입력이 죽는다 — 닫는 버튼도 없다", () => {
    render(<ComputerBrowseMinigame gamePhase={2} stage="result" onComplete={() => {}} />);

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByText(i18n.t(NEWS_PAGES[0].titleKey))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turn the computer off/ })).toBeNull();
  });
});
