import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUZZLE_IDS, RULE_CLUES } from "@/data/room-clues";
import ko from "@/i18n/locales/ko/memory-room.json";
import { MINIGAMES } from "@/minigames";
import { buildMemoryReplay } from "@/store/memory-room";
import {
  CUTSCENES,
  MEMORIES,
  MEMORY_BY_ID,
  MEMORY_IDS,
  type MemoryId,
  memoriesForPhase,
  PHASE1_MEMORIES,
  SCRIPTS,
} from "./memory-room";
import { requiredVisits, visitConfig } from "./story-phase";

/**
 * 기억이 나르면 안 되는 미궁 문제들: 지금은 현관 잠금(angle-turn) 하나다.
 * 규칙이 화면에 없고 단서가 방에 흩어져 있다 (src/data/room-clues.ts의 RULE_CLUES).
 */
const MAZE_MINIGAMES: readonly string[] = [...PUZZLE_IDS];

/** ko 리소스에서 "scripts.radio-intro.line1" 같은 키의 값. */
function readKey(path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    if (node === null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[part];
  }, ko);
}

/** "scripts.radio-intro.line1" 같은 키가 ko 리소스에 실제로 있는지. */
function hasKey(path: string): boolean {
  return readKey(path) !== undefined;
}

const ALL_LINES = [
  ...Object.values(SCRIPTS).flatMap((script) => script.lines),
  ...Object.values(CUTSCENES).flatMap((cutscene) => cutscene.cuts.flatMap((cut) => cut.lines)),
];

describe("시나리오 데이터 정합성", () => {
  it("모든 대사의 textKey가 ko 리소스에 있다", () => {
    const missing = ALL_LINES.map((line) => line.textKey).filter((key) => !hasKey(key));

    expect(missing).toEqual([]);
  });

  it("모든 화자에게 이름이 있다. 얼굴이 없는 화자도 이름은 뜬다", () => {
    const missing = [...new Set(ALL_LINES.map((line) => line.speaker))].filter(
      (speaker) => !hasKey(`characters.${speaker}.name`),
    );

    expect(missing).toEqual([]);
  });

  it("참조하는 미니게임이 레지스트리에 등록돼 있다", () => {
    const ids = MEMORIES.flatMap((memory) =>
      [memory.phase1, memory.phase2, memory.phase3].flatMap((config) =>
        config?.interaction?.minigameId ? [config.interaction.minigameId] : [],
      ),
    );

    expect(ids.filter((id) => !(id in MINIGAMES))).toEqual([]);
  });

  it("참조하는 스크립트가 레지스트리에 등록돼 있다", () => {
    const ids = MEMORIES.flatMap((memory) =>
      [memory.phase1, memory.phase2, memory.phase3].flatMap((config) =>
        [config?.interaction?.scriptId, config?.interaction?.resultScriptId].filter(
          (id): id is string => id !== undefined,
        ),
      ),
    );

    expect(ids.filter((id) => !(id in SCRIPTS))).toEqual([]);
  });

  it("등록된 스크립트는 모두 쓰인다. 죽은 대사가 남지 않는다", () => {
    const used = new Set(
      MEMORIES.flatMap((memory) =>
        [memory.phase1, memory.phase2, memory.phase3].flatMap((config) =>
          [config?.interaction?.scriptId, config?.interaction?.resultScriptId].filter(Boolean),
        ),
      ),
    );

    expect(Object.keys(SCRIPTS).filter((id) => !used.has(id))).toEqual([]);
  });

  it("해금 조건이 실재하는 기억을 가리키고, 자기 자신을 기다리지 않는다", () => {
    for (const memory of MEMORIES) {
      for (const config of [memory.phase1, memory.phase2, memory.phase3]) {
        for (const dependency of config?.unlockAfter ?? []) {
          expect(MEMORY_IDS).toContain(dependency.id);
          expect(dependency.id).not.toBe(memory.id);
          // 가리키는 차수가 그 기억에 실제로 있다
          expect(
            visitConfig(dependency.id, dependency.visit),
            JSON.stringify(dependency),
          ).toBeDefined();
        }
      }
    }
  });
});

describe("다시보기", () => {
  /** 패널·수첩에서 누를 수 있는 모든 줄. 눌렀는데 아무 일도 없으면 안 된다. */
  const REPLAYABLE = MEMORIES.flatMap((memory) =>
    ([1, 2] as const)
      .filter((gamePhase) => (gamePhase === 1 ? memory.phase1 : memory.phase2))
      .map((gamePhase) => ({ id: memory.id, gamePhase })),
  );

  it("모든 기억이 되짚을 대사를 갖는다. 대사가 없으면 기록으로 대신한다", () => {
    for (const { id, gamePhase } of REPLAYABLE) {
      const playback = buildMemoryReplay(id, gamePhase);
      expect(playback, `${id} phase${gamePhase}`).not.toBeNull();
      expect(playback?.cuts[0].lines.length, `${id} phase${gamePhase}`).toBeGreaterThan(0);
    }
  });

  it("되짚는 대사의 textKey가 전부 ko 리소스에 있다. 기록으로 대신한 것도", () => {
    const missing = REPLAYABLE.flatMap(({ id, gamePhase }) =>
      (buildMemoryReplay(id, gamePhase)?.cuts[0].lines ?? [])
        .map((line) => line.textKey)
        .filter((key) => !hasKey(key)),
    );

    expect(missing).toEqual([]);
  });

  it("미니게임을 끌고 오지 않는다. 되짚기는 재도전이 아니다", () => {
    for (const { id, gamePhase } of REPLAYABLE) {
      expect(buildMemoryReplay(id, gamePhase)?.kind).toBe("replay");
      expect(buildMemoryReplay(id, gamePhase)?.intro).toBe(false);
    }
  });

  it("다시보기 스틸은 리포에 실제로 있는 파일을 가리킨다", () => {
    const stills = MEMORIES.flatMap((memory) =>
      [memory.phase1?.replayStill, memory.phase2?.replayStill].filter(
        (path): path is string => path !== undefined,
      ),
    );

    expect(stills.length).toBeGreaterThan(0);
    for (const path of stills) {
      const filePath = path.split(/[?#]/, 1)[0];
      expect(existsSync(`public${filePath}`), path).toBe(true);
    }
  });
});

describe("v4 진행 형태", () => {
  const deps = (config?: { unlockAfter?: { id: MemoryId; visit: number }[] }) =>
    (config?.unlockAfter ?? []).map((ref) => `${ref.id}@${ref.visit}`).sort();

  it("1페이즈는 강도 순서다: 강도 1 → 강도 2 → 강도 3 → 라디오", () => {
    expect(deps(MEMORY_BY_ID.console.phase1)).toEqual([]);
    expect(deps(MEMORY_BY_ID.ball.phase1)).toEqual([]);
    expect(deps(MEMORY_BY_ID.frame.phase1)).toEqual(["ball@1", "console@1"]);
    expect(deps(MEMORY_BY_ID.phone.phase1)).toEqual(["ball@1", "console@1"]);
    expect(deps(MEMORY_BY_ID.calendar.phase1)).toEqual(["phone@1"]);
    expect(deps(MEMORY_BY_ID.window.phase1)).toEqual(["frame@1", "phone@1"]);
    expect(deps(MEMORY_BY_ID.radio.phase1)).toEqual(
      PHASE1_MEMORIES.map((memory) => memory.id)
        .filter((id) => id !== "radio")
        .map((id) => `${id}@1`)
        .sort(),
    );
  });

  it("1페이즈에서 컴퓨터는 조사 대상이 아니다", () => {
    expect(PHASE1_MEMORIES.map((memory) => memory.id)).not.toContain("computer");
  });

  it("2페이즈 필수는 거실 넷 + 컴퓨터 2차 + 폰 2차, 폰은 컴퓨터를 기다린다", () => {
    const p2 = requiredVisits("p2")
      .map((ref) => `${ref.id}@${ref.visit}`)
      .sort();
    expect(p2).toEqual(["cards@2", "computer@2", "duffel@2", "fridge@2", "phone@2", "shoes@2"]);
    expect(deps(MEMORY_BY_ID.phone.phase2)).toEqual(["computer@2"]);
    for (const id of ["duffel", "fridge", "shoes", "cards", "computer"] as MemoryId[]) {
      expect(deps(MEMORY_BY_ID[id].phase2), id).toEqual([]);
    }
  });

  it("3페이즈: 앰플 → 컴퓨터 3차(로고). 하부장·안방 문은 퍼즐과 문이 잇는다", () => {
    expect(
      requiredVisits("p3")
        .map((ref) => `${ref.id}@${ref.visit}`)
        .sort(),
    ).toEqual(["ampoule@2", "computer@3"]);
    expect(deps(MEMORY_BY_ID.computer.phase3)).toEqual(["ampoule@2"]);
    expect(PUZZLE_IDS).toContain("sink-dial");
  });

  it("4페이즈: 서류 순서 + 출입증 → 액자 2차, 액자가 끝나면 정적 비트", () => {
    expect(deps(MEMORY_BY_ID.frame.phase2)).toEqual(["id-card@2", "research-note@2"]);
    expect(MEMORY_BY_ID["research-note"].phase2?.interaction?.minigameId).toBe("papers-order");
    expect(MEMORY_BY_ID["id-card"].phase2?.interaction?.minigameId).toBe("id-card-flip");
    expect(MEMORY_BY_ID.frame.phase2?.from).toBe("p4");
    expect(MEMORY_BY_ID.frame.phase2?.cutscene).toBe("still-beat");
  });

  it("곁가지(게임기·공의 2차)는 어느 페이즈의 필수에도 안 낀다", () => {
    for (const phase of ["turning", "p2", "p3", "p4"] as const) {
      const ids = requiredVisits(phase).map((ref) => ref.id);
      expect(ids).not.toContain("console");
      expect(ids).not.toContain("ball");
    }
  });

  it("바퀴마다 모으는 목록이 다르다. 진행 표시가 못 채울 칸을 세지 않는다", () => {
    const round1 = memoriesForPhase(1).map((memory) => memory.id);
    const round2 = memoriesForPhase(2).map((memory) => memory.id);
    expect(round1).not.toContain("computer");
    expect(round2).toContain("computer");
    expect(round2).not.toContain("window");
    // 곁가지는 2바퀴 진행 표시의 분모가 아니다
    expect(round2).not.toContain("console");
    expect(round1).toEqual(MEMORIES.filter((memory) => memory.phase1).map((memory) => memory.id));
  });

  it("현관 잠금·하부장·피아노는 기억이 나르지 않는다. 물건에 붙은 문제다", () => {
    const carried = MEMORIES.flatMap((memory) =>
      [memory.phase1, memory.phase2, memory.phase3].flatMap((config) =>
        config?.interaction?.minigameId ? [config.interaction.minigameId] : [],
      ),
    );
    for (const maze of MAZE_MINIGAMES) expect(carried).not.toContain(maze);
  });

  it("규칙이 화면에 없는 문제마다 단서와 미니게임 구현이 다 있다", () => {
    for (const id of Object.keys(RULE_CLUES) as (keyof typeof RULE_CLUES)[]) {
      expect(MINIGAMES[id], id).toBeDefined();
      expect(RULE_CLUES[id], id).toBeDefined();
    }
    for (const id of PUZZLE_IDS) expect(MINIGAMES[id], id).toBeDefined();
  });

  it("컷씬의 컷마다 대사가 있거나 정적(holdMs)이 있다. 그림은 있다면 제 자리에", () => {
    for (const cutscene of Object.values(CUTSCENES)) {
      expect(cutscene.cuts.length).toBeGreaterThan(0);
      for (const cut of cutscene.cuts) {
        if (cut.image !== undefined)
          expect(cut.image).toMatch(/^\/assets\/images\/[^?]+\.webp(\?v=[\w.-]+)?$/);
        if (cut.lines.length === 0) expect(cut.holdMs ?? 0, cutscene.id).toBeGreaterThan(0);
        // 웹툰 칸은 그림이 있어야 선다
        if (cut.panel) expect(cut.image, cutscene.id).toBeDefined();
      }
    }
  });

  it("작별의 회상과 옛 라디오 목소리·폰 잠금 대사는 없다 (v4 7-3)", () => {
    expect(CUTSCENES.farewell).toBeUndefined();
    expect(SCRIPTS["radio-voice"]).toBeUndefined();
    expect(Object.keys(SCRIPTS).filter((id) => id.startsWith("phone-unlock"))).toEqual([]);
  });

  it("1페이즈의 대사와 기록에는 '좀비'가 없다", () => {
    const p1Scripts = PHASE1_MEMORIES.filter((memory) => memory.id !== "radio").flatMap((memory) =>
      [memory.phase1?.interaction?.scriptId, memory.phase1?.interaction?.resultScriptId].filter(
        (id): id is string => id !== undefined,
      ),
    );
    const texts = p1Scripts.flatMap((id) =>
      SCRIPTS[id].lines.map((line) => JSON.stringify(readKey(line.textKey))),
    );
    for (const memory of PHASE1_MEMORIES) {
      texts.push(JSON.stringify(readKey(`lore.${memory.id}.phase1`)));
    }
    expect(texts.filter((text) => text.includes("좀비"))).toEqual([]);
  });
});
