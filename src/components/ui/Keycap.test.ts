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
});
