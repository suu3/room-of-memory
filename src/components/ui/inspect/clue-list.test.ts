import { describe, expect, it } from "vitest";
import { listedClues } from "./clue-list";

describe("화면 밖 목록에 오르는 단서", () => {
  it("방에서는 방의 단서만 오른다 (화장실의 출입증 배지는 아직 읽지 않는다)", () => {
    const clues = listedClues(["room"]);
    expect(clues).toContain("workbook");
    expect(clues).toContain("mirror");
    expect(clues).not.toContain("raon-badge");
  });

  it("화장실에 닿으면 출입증 배지가 더해진다", () => {
    expect(listedClues(["room", "living", "bathroom"])).toContain("raon-badge");
  });
});
