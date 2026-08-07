/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPUTER_PASSCODE } from "../../data/room-clues";
import { i18n } from "../../i18n/config";
import type { MinigameResult } from "../../types/minigame";
import {
  ARCHIVE_PAGES,
  BOOT_LINE_MS,
  BOOT_LINES,
  BOOT_SETTLE_MS,
  FAILS_BEFORE_SKIP,
} from "./archive";
import { ComputerBrowseMinigame } from "./index";

/**
 * 부팅이 끝나고 로그인 화면이 뜰 때까지 시계를 돌린다.
 *
 * 한 번에 다 감을 수 없다 — 다음 타이머는 이번 타이머가 부른 상태 갱신의 effect가
 * 걸어야 생긴다. act 한 번이 한 칸이라 줄 수만큼 돌린다.
 */
function runBoot() {
  const step = Math.max(BOOT_LINE_MS, BOOT_SETTLE_MS) + 50;
  for (let tick = 0; tick <= BOOT_LINES.length; tick += 1) {
    act(() => {
      vi.advanceTimersByTime(step);
    });
  }
}

const passwordField = () => screen.getByLabelText("Password");

/** 로그인 칸에 숫자를 넣는다 — 네 자리가 차면 화면이 알아서 검사한다. */
function typeCode(code: string) {
  fireEvent.change(passwordField(), { target: { value: code } });
}

/** 틀린 입력이 흔들리고 지워질 때까지 (WRONG_HOLD_MS보다 넉넉히). */
function clearWrong() {
  act(() => {
    vi.advanceTimersByTime(600);
  });
}

function nextPage() {
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
}

describe("ComputerBrowseMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("로딩 → 로그인 화면 순으로 켜진다", () => {
    render(<ComputerBrowseMinigame onComplete={() => {}} />);

    // 상태 줄이 하나씩 지나간다 — 처음에는 아직 아무 줄도 없다
    expect(screen.queryByText(i18n.t(BOOT_LINES[0]))).toBeNull();
    act(() => {
      vi.advanceTimersByTime(BOOT_LINE_MS + 20);
    });
    expect(screen.getByText(i18n.t(BOOT_LINES[0]))).toBeTruthy();
    // 부팅 중에는 로그인 칸이 없다
    expect(screen.queryByLabelText("Password")).toBeNull();

    runBoot();

    expect(passwordField()).toBeTruthy();
    expect(screen.getByText(/the day of the national tournament/)).toBeTruthy();
    // 아직 아무것도 못 읽는다
    expect(screen.queryByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeNull();
  });

  it("아무 키나 누르면 부팅을 건너뛴다", () => {
    render(<ComputerBrowseMinigame onComplete={() => {}} />);

    fireEvent.keyDown(window, { code: "Space" });
    act(() => {
      vi.advanceTimersByTime(BOOT_SETTLE_MS + 50);
    });

    expect(passwordField()).toBeTruthy();
  });

  it("비밀번호를 맞춰야 저장된 것들이 열린다", () => {
    const onComplete = vi.fn();
    render(<ComputerBrowseMinigame onComplete={onComplete} />);
    runBoot();

    typeCode("0000");
    expect(screen.getByText("Incorrect password")).toBeTruthy();
    expect(screen.queryByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeNull();
    // 틀려도 닫히지 않는다 — 지워지고 다시 넣을 수 있다
    expect(onComplete).not.toHaveBeenCalled();
    clearWrong();

    typeCode(COMPUTER_PASSCODE);
    expect(screen.getByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeTruthy();
  });

  it("네 자리를 못 채우고 보내면 그대로 틀린 것이 된다", () => {
    render(<ComputerBrowseMinigame onComplete={() => {}} />);
    runBoot();

    typeCode("08");
    fireEvent.click(screen.getByRole("button", { name: /Log in/ }));

    expect(screen.getByText("Incorrect password")).toBeTruthy();
  });

  it("여러 번 틀리면 비밀번호 없이도 열어준다 — 막다른 길이 아니다", () => {
    render(<ComputerBrowseMinigame onComplete={() => {}} />);
    runBoot();

    for (let attempt = 0; attempt < FAILS_BEFORE_SKIP; attempt += 1) {
      typeCode("0000");
      clearWrong();
    }

    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    expect(screen.getByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeTruthy();
  });

  it("메일 두 통 뒤에 뉴스 셋 — 끝까지 넘겨 닫으면 한 번만 완료된다", () => {
    const results: MinigameResult[] = [];
    render(<ComputerBrowseMinigame onComplete={(result) => results.push(result)} />);
    runBoot();
    typeCode(COMPUTER_PASSCODE);

    // 첫 메일: 제목과 첨부 사진 자리가 선다
    expect(screen.getByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeTruthy();
    expect(screen.getByText("IMG_2183.jpg")).toBeTruthy();
    // 다 읽기 전에는 닫는 버튼이 없다
    expect(screen.queryByRole("button", { name: /Turn the computer off/ })).toBeNull();

    nextPage();
    expect(screen.getByText(i18n.t(ARCHIVE_PAGES[1].titleKey))).toBeTruthy();
    // 키보드(Space/→)로도 넘어간다
    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.keyDown(window, { code: "ArrowRight" });
    nextPage();

    const last = ARCHIVE_PAGES[ARCHIVE_PAGES.length - 1];
    expect(screen.getByText(i18n.t(last.titleKey))).toBeTruthy();
    expect(screen.getByText(/the saved copy ends here/)).toBeTruthy();

    const close = screen.getByRole("button", { name: /Turn the computer off/ });
    fireEvent.click(close);
    fireEvent.click(close);
    expect(results).toEqual([{ cleared: true }]);
  });

  it("결과 대사 단계에서는 입력이 죽는다 — 닫는 버튼도 없다", () => {
    render(<ComputerBrowseMinigame stage="result" onComplete={() => {}} />);

    // 부팅도 잠금도 돌지 않는다 — 다 읽은 화면이 그대로 멈춰 있다
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByText(i18n.t(ARCHIVE_PAGES[0].titleKey))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turn the computer off/ })).toBeNull();
  });
});
