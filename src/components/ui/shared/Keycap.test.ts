import { describe, expect, it } from "vitest";
import { splitKeyTokens } from "./Keycap";

const keys = (text: string) =>
  splitKeyTokens(text)
    .filter((part) => part.kind !== "text")
    .map((part) => part.value);

describe("splitKeyTokens", () => {
  it("picks key names out of a sentence without losing text", () => {
    const text = "다음 장으로: 클릭 · Space · →";
    expect(keys(text)).toEqual(["클릭", "Space", "→"]);
    expect(
      splitKeyTokens(text)
        .map((part) => part.value)
        .join(""),
    ).toBe(text);
  });

  it("allows particles glued to a key but not letters inside a word", () => {
    expect(keys("WASD로 걷기")).toEqual(["WASD"]);
    expect(keys("Spaceで取り、↑/↓で動かす")).toEqual(["Space", "↑/↓"]);
    expect(keys("E · click")).toEqual(["E", "click"]);
    expect(keys("방향키로 이동 · Z X C로 공격")).toEqual(["Z", "X", "C"]);
    expect(keys("クリック · WASD")).toEqual(["クリック", "WASD"]);
    expect(keys("Type the password and press Enter")).toEqual(["Enter"]);
    expect(keys("Open Mom's chat")).toEqual([]);
  });

  it("leaves click as a verb inside a sentence alone", () => {
    expect(keys("클릭한 곳으로 이동 · WASD")).toEqual(["WASD"]);
    expect(keys("Click where to go · WASD")).toEqual(["WASD"]);
    expect(keys("クリックした場所へ移動 · WASD")).toEqual(["WASD"]);
  });

  it("caps gestures standing alone in a control list", () => {
    expect(keys("그날의 대화를 따라 내려가세요: 아래로 스크롤 · 터치")).toEqual([
      "아래로 스크롤",
      "터치",
    ]);
    expect(keys("Read the thread from the top: swipe down · tap")).toEqual(["swipe down", "tap"]);
    expect(keys("あの日のやりとりを読み進める: 下にスクロール・タップ")).toEqual([
      "下にスクロール",
      "タップ",
    ]);
    expect(keys("공 조사 · 터치")).toEqual(["터치"]);
    expect(splitKeyTokens("공 조사 · 터치").at(-1)?.kind).toBe("gesture");
  });

  it("leaves gesture verbs inside a sentence alone", () => {
    expect(keys("빛나는 물건을 탭해 조사하세요")).toEqual([]);
    expect(keys("통화 기록 탭도 열어보세요")).toEqual([]);
    expect(keys("끌어서 돌려 보세요")).toEqual([]);
    expect(keys("Drag to turn it")).toEqual([]);
    expect(keys("光る物をタップして調べましょう")).toEqual([]);
  });
});
