import { describe, expect, it } from "vitest";
import ko from "@/i18n/locales/ko/memory-room.json";
import { MINIGAMES } from "@/minigames";
import {
  CUTSCENES,
  MEMORIES,
  MEMORY_BY_ID,
  MEMORY_IDS,
  type MemoryId,
  SCRIPTS,
} from "./memory-room";

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

  it("모든 화자에게 이름이 있다 — 얼굴이 없는 화자도 이름은 뜬다", () => {
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

  it("등록된 스크립트는 모두 쓰인다 — 죽은 대사가 남지 않는다", () => {
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

describe("1바퀴 → 컷씬 → 2바퀴 진행 형태", () => {
  it("라디오는 나머지 전부를 기다린다 — 재난방송이 마지막에 온다", () => {
    const prerequisites = MEMORY_BY_ID.radio.phase1.unlockAfter ?? [];

    expect([...prerequisites].sort()).toEqual(
      MEMORY_IDS.filter((id) => id !== "radio")
        .slice()
        .sort(),
    );
  });

  it("2바퀴에서 손을 쓰는 조사는 라디오와 액자뿐이다", () => {
    const withMinigame = MEMORIES.filter((memory) => memory.phase2?.interaction?.minigameId).map(
      (memory) => memory.id,
    );

    expect(withMinigame.sort()).toEqual(["frame", "radio"]);
  });

  it("2바퀴 재점등 대상은 라디오 목소리를 들은 뒤에만 열린다", () => {
    const gated: MemoryId[] = ["ball", "console", "frame"];

    for (const id of gated) {
      expect(MEMORY_BY_ID[id].phase2?.unlockAfter).toEqual(["radio"]);
    }
    // 라디오 자신은 2바퀴의 첫 관문이라 아무것도 기다리지 않는다
    expect(MEMORY_BY_ID.radio.phase2?.unlockAfter).toBeUndefined();
  });

  it("컷씬의 컷마다 그림과 대사가 하나 이상 있다", () => {
    for (const cutscene of Object.values(CUTSCENES)) {
      expect(cutscene.cuts.length).toBeGreaterThan(0);
      for (const cut of cutscene.cuts) {
        expect(cut.image).toMatch(/^\/assets\/images\/.+\.webp$/);
        expect(cut.lines.length).toBeGreaterThan(0);
      }
    }
  });
});
