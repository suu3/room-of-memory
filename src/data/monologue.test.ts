import { describe, expect, it } from "vitest";
import stages from "@/i18n/locales/ko/memory-room.json";
import type { MemoryId } from "./memory-room";
import { MONOLOGUE_IDS, monologueIdFor } from "./monologue";
import { requiredVisits, type StoryProgress } from "./story-phase";

/** 그 페이즈들의 필수 조사를 마친 진행. */
function through(
  phases: readonly ("p1" | "turning" | "p2" | "p3" | "p4")[],
  extra: Partial<StoryProgress> = {},
): StoryProgress {
  const refs = phases.flatMap((phase) => requiredVisits(phase));
  const pick = (visit: number) => refs.filter((ref) => ref.visit === visit).map((ref) => ref.id);
  return {
    collected: pick(1),
    revisited: pick(2),
    rechecked: pick(3),
    introDone: true,
    doorOpened: false,
    ...extra,
  };
}

const p1 = (collected: string[]): StoryProgress => ({
  collected: collected as MemoryId[],
  revisited: [],
  introDone: true,
  doorOpened: false,
});

describe("monologueIdFor", () => {
  it("불을 켜기 전에는 어둠 속의 한 줄이다", () => {
    expect(monologueIdFor({ ...p1([]), introDone: false })).toBe("p0-dark");
  });

  it("1페이즈는 강도를 따라 내려간다", () => {
    expect(monologueIdFor(p1([]))).toBe("p1-0");
    expect(monologueIdFor(p1(["report-card", "console"]))).toBe("p1-0");
    // 강도 0과 강도 1 둘을 다 봤다 = 강도 2에 들어섰다
    expect(monologueIdFor(p1(["report-card", "console", "ball"]))).toBe("p1-mid");
    expect(monologueIdFor(p1(["report-card", "console", "ball", "frame", "phone"]))).toBe(
      "p1-late",
    );
  });

  it("분기점: 바닥의 한 줄, 방송을 들으면 문 쪽으로", () => {
    expect(monologueIdFor(through(["p1"]))).toBe("turn-bottom");
    expect(monologueIdFor(through(["p1", "turning"]))).toBe("turn-signal");
  });

  it("기한 독백은 p2·p3·p4에 들어서는 순간 걸린다", () => {
    expect(monologueIdFor(through(["p1", "turning"], { doorOpened: true }))).toBe("p2-enter");
    expect(monologueIdFor(through(["p1", "turning", "p2"], { doorOpened: true }))).toBe("p3-enter");
    expect(
      monologueIdFor(
        through(["p1", "turning", "p2", "p3"], {
          doorOpened: true,
          openedDoorways: ["living-bathroom", "living-parents"],
        }),
      ),
    ).toBe("p4-enter");
    expect(
      monologueIdFor(
        through(["p1", "turning", "p2", "p3", "p4"], {
          doorOpened: true,
          openedDoorways: ["living-bathroom", "living-parents"],
        }),
      ),
    ).toBe("resolve");
  });

  it("모든 구간 id가 대본에 있다", () => {
    for (const id of MONOLOGUE_IDS) {
      expect((stages.stages as Record<string, unknown>)[id], id).toBeDefined();
    }
  });
});
