import { describe, expect, it } from "vitest";
import { MEMORIES } from "@/data/memory-room";
import { sanitizeProgress } from "./memory-room";

const [first, second] = MEMORIES.map((memory) => memory.id);

describe("sanitizeProgress", () => {
  it("keeps a well-formed save as-is", () => {
    expect(
      sanitizeProgress({
        collected: [first, second],
        revisited: [first],
        doorOpened: false,
        batTaken: false,
        solvedPuzzles: ["angle-turn"],
        discoveries: ["hero-name"],
        endingStarted: false,
        soundMuted: true,
        lightsOn: false,
        difficulty: "normal",
        introDone: true,
        doorwayDone: false,
        openedDoorways: [],
        inventory: ["parents-key"],
        cluesSeen: ["drawer-note"],
        autoPlay: true,
      }),
    ).toEqual({
      collected: [first, second],
      revisited: [first],
      doorOpened: false,
      batTaken: false,
      solvedPuzzles: ["angle-turn"],
      discoveries: ["hero-name"],
      endingStarted: false,
      soundMuted: true,
      lightsOn: false,
      difficulty: "normal",
      introDone: true,
      doorwayDone: false,
      openedDoorways: [],
      inventory: ["parents-key"],
      cluesSeen: ["drawer-note"],
      autoPlay: true,
    });
  });

  it("가진 물건은 아는 것만 남기고, 없으면 빈손이다", () => {
    expect(sanitizeProgress({}).inventory).toEqual([]);
    expect(sanitizeProgress({ inventory: ["parents-key", "ghost-key"] }).inventory).toEqual([
      "parents-key",
    ]);
    expect(sanitizeProgress({ inventory: "nope" }).inventory).toEqual([]);
  });

  it("오토는 저장본에 켜져 있을 때만 켜진다", () => {
    expect(sanitizeProgress({}).autoPlay).toBe(false);
    expect(sanitizeProgress({ autoPlay: "yes" }).autoPlay).toBe(false);
    expect(sanitizeProgress({ autoPlay: true }).autoPlay).toBe(true);
  });

  it("펼쳐 본 단서는 아는 것만 남는다", () => {
    expect(sanitizeProgress({}).cluesSeen).toEqual([]);
    expect(sanitizeProgress({ cluesSeen: ["mirror", "ghost-note"] }).cluesSeen).toEqual(["mirror"]);
    expect(sanitizeProgress({ cluesSeen: "nope" }).cluesSeen).toEqual([]);
  });

  it("거실 너머의 문은 방문이 열린 저장본에서만 살아남고, 모르는 문과 방문 자체는 버린다", () => {
    const opened = { collected: MEMORIES.map((memory) => memory.id), revisited: ["radio"] };
    expect(sanitizeProgress({ openedDoorways: ["living-bathroom"] }).openedDoorways).toEqual([]);
    expect(
      sanitizeProgress({
        ...opened,
        doorOpened: true,
        openedDoorways: ["living-bathroom", "room-living", "attic"],
      }).openedDoorways,
    ).toEqual(["living-bathroom"]);
  });

  it("인트로는 한 번뿐이다: 적혀 있거나 기억을 모은 저장본은 어둠에서 다시 시작하지 않는다", () => {
    expect(sanitizeProgress({}).introDone).toBe(false);
    expect(sanitizeProgress({ introDone: true }).introDone).toBe(true);
    // 이 값을 모르던 시절의 저장본: 기억을 하나라도 모았으면 방에 이미 들어와 있던 것이다
    expect(sanitizeProgress({ collected: [first] }).introDone).toBe(true);
    expect(sanitizeProgress({ introDone: "yes" }).introDone).toBe(false);
  });

  it("문 넘기는 문이 열린 저장본에만 있고, 이 값을 모르던 저장본은 지난 것으로 본다", () => {
    const opened = { collected: MEMORIES.map((memory) => memory.id), revisited: ["radio"] };
    expect(sanitizeProgress({ doorwayDone: true }).doorwayDone).toBe(false);
    expect(sanitizeProgress({ ...opened, doorOpened: true }).doorwayDone).toBe(true);
    expect(sanitizeProgress({ ...opened, doorOpened: true, doorwayDone: false }).doorwayDone).toBe(
      false,
    );
    expect(sanitizeProgress({ ...opened, doorOpened: true, doorwayDone: true }).doorwayDone).toBe(
      true,
    );
  });

  it("keeps only discoveries that still exist", () => {
    // 방에서 알아낸 사실도 진행이다. 모르는 id는 버리고, 없으면 빈 목록으로 시작한다
    expect(sanitizeProgress({ discoveries: ["hero-name", "ghost"] }).discoveries).toEqual([
      "hero-name",
    ]);
    expect(sanitizeProgress({}).discoveries).toEqual([]);
  });

  it("falls back to easy when the saved difficulty is unknown", () => {
    // 스킵을 숨기는 쪽(normal)이 잘못 살아나면 접근성 장치가 말없이 사라진다.
    // 모르는 값은 스킵이 보이는 쪽으로 넘어진다
    expect(sanitizeProgress({ difficulty: "hardcore" }).difficulty).toBe("easy");
    expect(sanitizeProgress({}).difficulty).toBe("easy");
  });

  it("drops ids that no longer exist", () => {
    // 저장 뒤에 기억 목록이 바뀌면 없는 id가 남는다. 그대로 세면 수집 개수가
    // 실제보다 많아져 엔딩이 잘못 열린다.
    const result = sanitizeProgress({ collected: [first, "ghost-memory"], revisited: ["ghost"] });
    expect(result.collected).toEqual([first]);
    expect(result.revisited).toEqual([]);
  });

  it("removes duplicates so counts stay honest", () => {
    expect(sanitizeProgress({ collected: [first, first, second] }).collected).toEqual([
      first,
      second,
    ]);
  });

  it("never lets a revisit outrun its first pass", () => {
    // 2바퀴는 1바퀴를 마친 기억에만 붙는다
    expect(sanitizeProgress({ collected: [first], revisited: [first, second] }).revisited).toEqual([
      first,
    ]);
  });

  it("refuses an ending that the save has not earned", () => {
    // 엔딩은 배트를 쥔 뒤에만 시작될 수 있고, 배트는 앰플을 되찾아야 쥐어진다
    expect(sanitizeProgress({ collected: [first], endingStarted: true }).endingStarted).toBe(false);
    expect(
      sanitizeProgress({
        collected: MEMORIES.map((memory) => memory.id),
        batTaken: true,
        endingStarted: true,
      }).endingStarted,
    ).toBe(false);
    expect(
      sanitizeProgress({
        collected: MEMORIES.map((memory) => memory.id),
        revisited: ["ampoule"],
        batTaken: true,
        endingStarted: true,
      }).endingStarted,
    ).toBe(true);
  });

  it("puts the bat back when the save has no ampoule", () => {
    expect(sanitizeProgress({ batTaken: true }).batTaken).toBe(false);
    expect(sanitizeProgress({ revisited: ["ampoule"], batTaken: true }).batTaken).toBe(true);
  });

  it("leaves the lights on unless the save says otherwise", () => {
    // 불은 켜진 게 기본이다. 저장본에 없거나 깨졌다고 어두운 방으로 떨어지면 안 된다
    expect(sanitizeProgress({}).lightsOn).toBe(true);
    expect(sanitizeProgress({ lightsOn: "nope" }).lightsOn).toBe(true);
    expect(sanitizeProgress({ lightsOn: false }).lightsOn).toBe(false);
  });

  it("survives garbage instead of breaking the game", () => {
    // 저장본이 깨졌다고 플레이를 막는 쪽이 더 나쁘다
    expect(sanitizeProgress(null)).toEqual({});
    expect(sanitizeProgress("nope")).toEqual({});
    expect(sanitizeProgress({ collected: "not-an-array" }).collected).toEqual([]);
    expect(sanitizeProgress({}).collected).toEqual([]);
  });
});
