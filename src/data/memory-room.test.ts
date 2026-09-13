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

/**
 * 기억이 나르면 안 되는 미궁 문제들: 지금은 현관 잠금(angle-turn) 하나다.
 * 규칙이 화면에 없고 단서가 방에 흩어져 있다 (src/data/room-clues.ts의 RULE_CLUES).
 */
const MAZE_MINIGAMES: readonly string[] = [...PUZZLE_IDS];

/** "scripts.radio-intro.line1" 같은 키가 ko 리소스에 실제로 있는지. */
function hasKey(path: string): boolean {
  return (
    path.split(".").reduce<unknown>((node, part) => {
      if (node === null || typeof node !== "object") return undefined;
      return (node as Record<string, unknown>)[part];
    }, ko) !== undefined
  );
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
      [memory.phase1, memory.phase2].flatMap((config) =>
        config?.interaction?.minigameId ? [config.interaction.minigameId] : [],
      ),
    );

    expect(ids.filter((id) => !(id in MINIGAMES))).toEqual([]);
  });

  it("참조하는 스크립트가 레지스트리에 등록돼 있다", () => {
    const ids = MEMORIES.flatMap((memory) =>
      [memory.phase1, memory.phase2].flatMap((config) =>
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
        [memory.phase1, memory.phase2].flatMap((config) =>
          [config?.interaction?.scriptId, config?.interaction?.resultScriptId].filter(Boolean),
        ),
      ),
    );

    expect(Object.keys(SCRIPTS).filter((id) => !used.has(id))).toEqual([]);
  });

  it("해금 조건이 실재하는 기억을 가리키고, 자기 자신을 기다리지 않는다", () => {
    for (const memory of MEMORIES) {
      for (const config of [memory.phase1, memory.phase2]) {
        for (const dependency of config?.unlockAfter ?? []) {
          expect(MEMORY_IDS).toContain(dependency);
          expect(dependency).not.toBe(memory.id);
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
      expect(existsSync(`public${path}`), path).toBe(true);
    }
  });
});

describe("1바퀴 → 컷씬 → 2바퀴 진행 형태", () => {
  it("라디오는 1바퀴의 나머지 전부를 기다린다. 재난방송이 마지막에 온다", () => {
    const prerequisites = MEMORY_BY_ID.radio.phase1?.unlockAfter ?? [];

    expect([...prerequisites].sort()).toEqual(
      PHASE1_MEMORIES.map((memory) => memory.id)
        .filter((id) => id !== "radio")
        .sort(),
    );
  });

  it("바퀴마다 모으는 목록이 다르다. 진행 표시가 못 채울 칸을 세지 않는다", () => {
    const round1 = memoriesForPhase(1).map((memory) => memory.id);
    const round2 = memoriesForPhase(2).map((memory) => memory.id);

    // 1바퀴에만 있는 것(창문·달력)과 2바퀴에만 있는 것(컴퓨터)이 서로 갈린다
    expect(round1).not.toContain("computer");
    expect(round2).toContain("computer");
    expect(round2).not.toContain("window");
    expect(round2).not.toContain("calendar");
    // 목록은 각 바퀴의 phase 설정과 정확히 같아야 한다
    expect(round1).toEqual(MEMORIES.filter((memory) => memory.phase1).map((memory) => memory.id));
    expect(round2).toEqual(MEMORIES.filter((memory) => memory.phase2).map((memory) => memory.id));
  });

  it("1막에 없는 기억은 컴퓨터와 거실 물건들이다. 2막에 처음 열린다", () => {
    const phase2Only = MEMORIES.filter((memory) => !memory.phase1).map((memory) => memory.id);

    expect(phase2Only.sort()).toEqual([
      "ampoule",
      "cards",
      "computer",
      "duffel",
      "fridge",
      "shoes",
    ]);
    // 1바퀴에 없는 기억을 1바퀴 조건으로 기다리면 그 기억은 영영 안 열린다
    for (const memory of PHASE1_MEMORIES) {
      expect(memory.phase1?.unlockAfter ?? [], memory.id).not.toContain("computer");
    }
  });

  it("현관 잠금은 기억이 나르지 않는다. 문에 붙은 문제다", () => {
    /*
     * angle-turn은 거실 끝 현관 잠금장치에 붙는다 (docs/content-design.md 3-2,
     * 스토어의 openPuzzle). 기억 쪽에 다시 붙으면 같은 문제가 두 입구를 갖는다.
     * card-odd는 반대로 2막 추리 체인의 한 칸이 되면서 기억(cards)으로 올라갔다.
     */
    const carried = MEMORIES.flatMap((memory) =>
      [memory.phase1, memory.phase2].flatMap((config) =>
        config?.interaction?.minigameId ? [config.interaction.minigameId] : [],
      ),
    );
    for (const maze of MAZE_MINIGAMES) expect(carried).not.toContain(maze);

    const withMinigame = MEMORIES.filter((memory) => memory.phase2?.interaction?.minigameId).map(
      (memory) => memory.id,
    );
    // 앰플은 서랍을 열고 집는 손(ampoule-pickup)이 있다. 미궁이 아니라 탐색이다
    expect(withMinigame.sort()).toEqual([
      "ampoule",
      "cards",
      "computer",
      "frame",
      "phone",
      "radio",
    ]);
  });

  it("규칙이 화면에 없는 문제마다 단서와 미니게임 구현이 다 있다", () => {
    for (const id of Object.keys(RULE_CLUES) as (keyof typeof RULE_CLUES)[]) {
      expect(MINIGAMES[id], id).toBeDefined();
      expect(RULE_CLUES[id], id).toBeDefined();
    }
    for (const id of PUZZLE_IDS) expect(MINIGAMES[id], id).toBeDefined();
  });

  it("2막 곁가지는 라디오 목소리를 들은 뒤에만 열린다", () => {
    for (const id of ["console", "computer", "fridge", "duffel"] as MemoryId[]) {
      expect(MEMORY_BY_ID[id].phase2?.unlockAfter).toEqual(["radio"]);
    }
    // 폰은 컴퓨터의 여행 메일까지 기다린다. 엄마 문자가 그 사실을 받아 쓴다
    expect(MEMORY_BY_ID.phone.phase2?.unlockAfter).toEqual(["radio", "computer"]);
    // 라디오 자신은 2막의 첫 관문이라 아무것도 기다리지 않는다
    expect(MEMORY_BY_ID.radio.phase2?.unlockAfter).toBeUndefined();
  });

  it("2막 추리 체인은 거실 ↔ 방을 두 번 왕복한다", () => {
    // 왕복 상한 원칙: 방 방문 2회를 넘지 않는다 (docs/content-design.md 2장)
    expect(MEMORY_BY_ID.frame.phase2?.unlockAfter).toEqual(["radio", "fridge", "duffel"]);
    expect(MEMORY_BY_ID.shoes.phase2?.unlockAfter).toEqual(["frame"]);
    expect(MEMORY_BY_ID.cards.phase2?.unlockAfter).toEqual(["frame"]);
    expect(MEMORY_BY_ID.ball.phase2?.unlockAfter).toEqual(["shoes", "cards"]);
    expect(MEMORY_BY_ID.ampoule.phase2?.unlockAfter).toEqual(["ball"]);
  });

  it("컷씬의 컷마다 대사가 하나 이상, 그림은 있다면 제 자리에", () => {
    // 그림은 이제 선택이다. 작별의 회상(farewell)과 배트(bat-grip)는 공간이 비친 채 흐른다
    for (const cutscene of Object.values(CUTSCENES)) {
      expect(cutscene.cuts.length).toBeGreaterThan(0);
      for (const cut of cutscene.cuts) {
        if (cut.image !== undefined) expect(cut.image).toMatch(/^\/assets\/images\/.+\.webp$/);
        expect(cut.lines.length).toBeGreaterThan(0);
      }
    }
  });
});
