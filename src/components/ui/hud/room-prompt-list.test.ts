import { describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { progressAt } from "@/data/story-phase";
import {
  listedDoorways,
  listedMemories,
  listedProps,
  memoryStatuses,
  type PromptProgress,
} from "./room-prompt-list";

/** 그 페이즈에 막 들어선 진행. 목록이 보는 나머지 칸은 빈 값으로 채운다. */
function at(
  phase: Parameters<typeof progressAt>[0],
  extra: Partial<PromptProgress> = {},
): PromptProgress {
  return {
    discoveries: ["hero-name"],
    sinkDrained: false,
    batTaken: false,
    endingStarted: false,
    ...progressAt(phase),
    ...extra,
  } as PromptProgress;
}

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

describe("화면 밖 목록의 상태는 3D 물건과 같은 진행을 본다", () => {
  it("안방에 들어서면 연구 일지와 출입증이 조사할 수 있는 것으로 읽힌다", () => {
    const statuses = memoryStatuses(at("p4"));
    expect(statuses["research-note"]).toBe("available");
    expect(statuses["id-card"]).toBe("available");
  });

  it("안방의 둘을 마치고 피아노를 풀면 액자가 다시 열린다 (조사 완료로 읽히지 않는다)", () => {
    const p4 = at("p4");
    const revisited = [...p4.revisited, "research-note", "id-card"] as MemoryId[];
    expect(memoryStatuses({ ...p4, revisited }).frame).toBe("locked");
    const solvedPuzzles = [...p4.solvedPuzzles, "piano-melody"] as typeof p4.solvedPuzzles;
    expect(memoryStatuses({ ...p4, revisited, solvedPuzzles }).frame).toBe("available");
  });

  it("떠나기 전에는 가방과 앰플이 다시 열린다", () => {
    const statuses = memoryStatuses(at("resolve"));
    expect(statuses.duffel).toBe("available");
    expect(statuses.ampoule).toBe("available");
  });
});

describe("기억이 아닌 물건 (마개 · 협탁 서랍 · 배트 · 현관문)", () => {
  it("협탁 서랍은 처음부터 오르지만 번호를 알기 전에는 못 연다. 마개는 화장실에 닿아야 오른다", () => {
    const locked = [{ id: "nightstand-drawer", ready: false }];
    expect(listedProps(at("p1"), ["room"])).toEqual(locked);
    expect(listedProps(at("p2"), ["room", "living"])).toEqual(locked);
  });

  it("화장실에 닿으면 마개가 오르고, 책 속 번호를 보면 서랍을 열 수 있다", () => {
    const reached = ["room", "living", "bathroom"] as const;
    expect(listedProps(at("p3", { solvedPuzzles: [] }), reached)).toEqual([
      { id: "sink-plug", ready: true },
      { id: "nightstand-drawer", ready: false },
    ]);
    const read = at("p3", { solvedPuzzles: [], discoveries: ["hero-name", "drawer-code"] });
    expect(listedProps(read, reached)).toContainEqual({ id: "nightstand-drawer", ready: true });
  });

  it("물을 빼고 서랍을 열면 둘 다 빠진다", () => {
    const props = listedProps(at("p4", { sinkDrained: true }), [
      "room",
      "living",
      "bathroom",
      "parents",
    ]);
    expect(props).toEqual([]);
  });

  it("결심에 들어서면 배트와 현관문이 오른다. 문은 셋을 다 챙겨야 열린다", () => {
    const reached = ["room", "living", "bathroom", "parents"] as const;
    const resolve = at("resolve", { sinkDrained: true });
    expect(listedProps(resolve, reached)).toEqual([
      { id: "bat", ready: true },
      { id: "front-door", ready: false },
    ]);
    const rechecked = [...resolve.rechecked, "duffel", "ampoule"] as MemoryId[];
    expect(listedProps({ ...resolve, rechecked, batTaken: true }, reached)).toEqual([
      { id: "front-door", ready: true },
    ]);
  });

  it("현관문을 연 뒤에는 아무것도 오르지 않는다", () => {
    const resolve = at("resolve", { sinkDrained: true });
    const rechecked = [...resolve.rechecked, "duffel", "ampoule"] as MemoryId[];
    expect(
      listedProps({ ...resolve, rechecked, batTaken: true, endingStarted: true }, [
        "room",
        "living",
        "bathroom",
        "parents",
      ]),
    ).toEqual([]);
  });
});
