/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import type { MinigameResult } from "../../types/minigame";
import { PhoneLockMinigame } from "./index";
import { FAILS_BEFORE_SKIP, MOM_MESSAGES, PASSCODE } from "./messages";

/** 키패드로 네 자리를 누른다. */
function typeCode(code: string) {
  for (const digit of code) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
}

/** 틀린 입력이 흔들리고 지워질 때까지 (WRONG_HOLD_MS보다 넉넉히). */
async function waitWrongCleared() {
  await screen.findByText("Hint: the day everything stopped", undefined, { timeout: 1500 });
}

describe("PhoneLockMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  it("맞는 비밀번호로 열면 그날의 문자가 도착하고, 닫을 때 한 번만 완료된다", async () => {
    const results: MinigameResult[] = [];
    render(<PhoneLockMinigame onComplete={(result) => results.push(result)} />);

    typeCode(PASSCODE);

    // 문자가 한 통씩 도착한다. 마지막 통까지 기다린다
    const lastKey = MOM_MESSAGES[MOM_MESSAGES.length - 1].textKey;
    await screen.findByText(i18n.t(lastKey), undefined, { timeout: 4000 });

    const close = await screen.findByRole("button", { name: /Turn off the screen/ });
    fireEvent.click(close);
    fireEvent.click(close);

    expect(results).toEqual([{ cleared: true }]);
  });

  it("틀리면 지워지고 다시 넣을 수 있다. 실패로 닫히지 않는다", async () => {
    const onComplete = vi.fn();
    render(<PhoneLockMinigame onComplete={onComplete} />);

    typeCode("0000");
    expect(screen.getByText("Wrong passcode")).toBeTruthy();
    await waitWrongCleared();

    expect(onComplete).not.toHaveBeenCalled();
    // 지워졌으니 같은 키패드로 다시 시도할 수 있다
    typeCode(PASSCODE);
    expect(
      await screen.findByText(i18n.t(MOM_MESSAGES[0].textKey), undefined, { timeout: 4000 }),
    ).toBeTruthy();
  });

  it("N회 틀리면 스킵이 뜨고, 스킵해도 문자 화면은 그대로 선다", async () => {
    render(<PhoneLockMinigame onComplete={() => {}} />);

    for (let attempt = 0; attempt < FAILS_BEFORE_SKIP; attempt += 1) {
      typeCode("0000");
      await waitWrongCleared();
    }

    // 스킵은 퍼즐을 건너뛰는 것이지 이야기를 건너뛰는 게 아니다
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(
      await screen.findByText(i18n.t(MOM_MESSAGES[0].textKey), undefined, { timeout: 4000 }),
    ).toBeTruthy();
  });

  it("숫자 키보드로도 입력된다 (접근성: 키보드만으로 플레이 가능)", async () => {
    render(<PhoneLockMinigame onComplete={() => {}} />);

    for (const digit of PASSCODE) {
      fireEvent.keyDown(window, { key: digit });
    }

    expect(
      await screen.findByText(i18n.t(MOM_MESSAGES[0].textKey), undefined, { timeout: 4000 }),
    ).toBeTruthy();
  });

  it("결과 대사 단계에서는 판이 멈춘 그림이다. 문자는 전부 떠 있고 닫는 버튼은 없다", () => {
    render(<PhoneLockMinigame onComplete={() => {}} stage="result" />);

    // stage=result는 이미 열린 뒤에만 온다… 는 보장이 없어도, 잠금화면이면 입력이 죽는다
    fireEvent.keyDown(window, { key: PASSCODE[0] });
    expect(screen.queryByRole("button", { name: /Turn off the screen/ })).toBeNull();
  });
});
