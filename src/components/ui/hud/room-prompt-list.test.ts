import { describe, expect, it } from "vitest";
import { listedDoorways, listedMemories } from "./room-prompt-list";

describe("화면 밖 조사 목록에 오르는 것", () => {
  it("방문이 열리기 전에는 방의 물건만 오른다 (뒤에 나올 물건의 이름을 먼저 읽지 않는다)", () => {
    const ids = listedMemories(["room"]);
    expect(ids).toContain("radio");
    expect(ids).not.toContain("ampoule");
    expect(ids).not.toContain("fridge");
    expect(ids).not.toContain("research-note");
    expect(ids).not.toContain("id-card");
  });

  it("거실에 닿으면 거실의 물건이, 안방에 닿으면 안방의 물건이 더해진다", () => {
    const living = listedMemories(["room", "living"]);
    expect(living).toContain("fridge");
    expect(living).not.toContain("research-note");
    expect(listedMemories(["room", "living", "parents"])).toContain("research-note");
  });

  it("방에서는 방문 하나만 오른다", () => {
    expect(listedDoorways(["room"], [])).toEqual(["room-living"]);
  });

  it("방문이 열리면 방문은 빠지고 거실의 닫힌 문들이 오른다", () => {
    expect(listedDoorways(["room", "living"], ["room-living"])).toEqual([
      "living-bathroom",
      "living-parents",
    ]);
    expect(
      listedDoorways(["room", "living", "bathroom"], ["room-living", "living-bathroom"]),
    ).toEqual(["living-parents"]);
  });
});
