import { describe, expect, it } from "vitest";
import { MELODY } from "@/minigames/piano-melody/melody";
import { ledgerLines, STAFF, STAFF_BOTTOM_Y, staffY } from "./sheet-staff";

/** 이 y가 오선의 몇 번째 줄인가 (0이 맨 윗줄). 칸이면 정수가 아니다. */
function lineAt(y: number): number {
  return (y - STAFF.top) / STAFF.gap;
}

describe("sheet-staff", () => {
  it("높은음자리표: 미가 맨 아랫줄, 솔이 아래에서 둘째 줄에 앉는다", () => {
    expect(staffY("mi")).toBe(STAFF_BOTTOM_Y);
    expect(lineAt(staffY("mi"))).toBe(4);
    expect(lineAt(staffY("sol"))).toBe(3);
    expect(lineAt(staffY("ti"))).toBe(2);
  });

  it("파·라는 줄이 아니라 칸에 앉는다", () => {
    expect(Number.isInteger(lineAt(staffY("fa")))).toBe(false);
    expect(Number.isInteger(lineAt(staffY("la")))).toBe(false);
  });

  it("계이름 한 걸음은 줄 간격의 절반이고, 높을수록 위다", () => {
    expect(staffY("mi") - staffY("fa")).toBe(STAFF.gap / 2);
    expect(staffY("do")).toBeGreaterThan(staffY("ti"));
  });

  it("도는 오선 밖 덧줄 하나를 깔고 앉는다", () => {
    expect(staffY("do")).toBe(STAFF_BOTTOM_Y + STAFF.gap);
    expect(ledgerLines("do")).toEqual([staffY("do")]);
  });

  it("레는 오선 바로 아래 칸이라 덧줄이 없다", () => {
    expect(ledgerLines("re")).toEqual([]);
    expect(ledgerLines("sol")).toEqual([]);
  });

  /*
   * 계이름 글자와 음표가 같은 곡을 말하는지 본다. 한 칸 밀린 악보는 솔미미(단3도)를
   * 라파파(장3도)로 그려 놓고 글자만 맞게 적어 둔다: 읽을 줄 아는 사람에게만 틀린다.
   */
  it("곡의 첫 음(솔)은 아래에서 둘째 줄, 셋째 음(미)은 맨 아랫줄이다", () => {
    expect(MELODY[0]).toBe("sol");
    expect(lineAt(staffY(MELODY[0]))).toBe(3);
    expect(MELODY[2]).toBe("mi");
    expect(lineAt(staffY(MELODY[2]))).toBe(4);
  });
});
