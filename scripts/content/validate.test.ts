import { describe, expect, it } from "vitest";
import {
  countTranslationTodos,
  findUnlockCycles,
  parseDependency,
  resolveDependencyVisit,
  validateContent,
} from "./validate.mjs";

const text = (ko: string) => ({ ko, en: "", ja: "" });

/** 가장 작은 유효 콘텐츠: 기억 둘, 스크립트 하나, 독백 전부. */
function minimal() {
  return {
    memories: [
      {
        id: "alpha",
        icon: "Bag",
        lore: { title: text("알파"), phase1: text("1"), phase2: text("2") },
        phase1: { script: "hello" },
        phase2: { from: "p2" },
      },
      {
        id: "beta",
        icon: "Bag",
        lore: { title: text("베타"), phase2: text("2"), phase3: text("3") },
        phase2: { from: "p2" },
        phase3: { from: "p3", unlockAfter: ["alpha@2"] },
      },
    ],
    scripts: { hello: [{ speaker: "hero", ...text("안녕") }] },
    cutscenes: { quiet: [{ holdMs: 1000, lines: [] }] },
    stages: Object.fromEntries(
      [
        "p0-dark",
        "p1-0",
        "p1-mid",
        "p1-late",
        "turn-bottom",
        "turn-signal",
        "p2-enter",
        "p3-enter",
        "p4-enter",
        "resolve",
      ].map((id) => [id, { monologue: text(id) }]),
    ),
  };
}

describe("콘텐츠 검증 (v4 스키마)", () => {
  it("ko만 있으면 통과하고, 빈 en/ja는 번역 TODO로 센다", () => {
    const content = minimal();
    expect(validateContent(content)).toEqual([]);
    expect(countTranslationTodos(content).length).toBeGreaterThan(0);
  });

  it("ko가 비면 막는다", () => {
    const content = minimal();
    content.scripts.hello[0].ko = "";
    expect(validateContent(content).join("\n")).toContain("ko 문장이 비어 있다");
  });

  it("2차 이후 조사는 from이 있어야 한다", () => {
    const content = minimal();
    delete (content.memories[0].phase2 as { from?: string }).from;
    expect(validateContent(content).join("\n")).toContain("from");
  });

  it("없는 차수를 가리키는 해금 조건을 막는다", () => {
    const content = minimal();
    (content.memories[1].phase3 as { unlockAfter: string[] }).unlockAfter = ["alpha@3"];
    expect(validateContent(content).join("\n")).toContain("3차 조사가 없다");
  });

  it("차수를 넘나드는 순환을 찾는다", () => {
    const content = minimal();
    (content.memories[0].phase2 as { unlockAfter?: string[] }).unlockAfter = ["beta@3"];
    expect(findUnlockCycles(content.memories).length).toBeGreaterThan(0);
  });

  it("대사 없는 컷은 정적(holdMs)이 있어야 넘어간다", () => {
    const content = minimal();
    content.cutscenes.quiet[0] = { lines: [] } as never;
    expect(validateContent(content).join("\n")).toContain("holdMs");
  });

  it("웹툰 칸은 그림·비율이 있고, 3:4 칸은 둘씩 짝을 이룬다", () => {
    const panel = (page: number, ratio: string) => ({
      image: "/assets/images/x.webp",
      page,
      ratio,
      holdMs: 1000,
      lines: [],
    });
    const content = minimal();
    content.cutscenes.quiet = [panel(1, "16:9"), panel(1, "3:4"), panel(1, "3:4")] as never;
    expect(validateContent(content)).toEqual([]);

    content.cutscenes.quiet = [panel(1, "3:4"), panel(1, "16:9")] as never;
    expect(validateContent(content).join("\n")).toContain("짝");

    content.cutscenes.quiet = [panel(1, "16:9"), panel(3, "16:9")] as never;
    expect(validateContent(content).join("\n")).toContain("차례로");

    content.cutscenes.quiet = [{ holdMs: 1000, lines: [] }, panel(1, "16:9")] as never;
    expect(validateContent(content).join("\n")).toContain("뒤에만");
  });

  it("차수별 수첩 제목은 그 차수가 있는 기억에만 붙는다", () => {
    const content = minimal();
    (content.memories[0].lore as Record<string, unknown>).phase2Title = text("새 제목");
    expect(validateContent(content)).toEqual([]);
    (content.memories[1].lore as Record<string, unknown>).phase1Title = text("없는 차수");
    expect(validateContent(content).join("\n")).toContain("phase1Title");
  });

  it("차수를 안 적은 조건은 같은 차수, 없으면 그 아래 가장 가까운 차수다", () => {
    expect(parseDependency("computer@3")).toEqual({ id: "computer", visit: 3 });
    expect(parseDependency("radio")).toEqual({ id: "radio", visit: undefined });
    const only2 = { phase2: {} };
    expect(resolveDependencyVisit(only2, undefined, 3)).toBe(2);
    expect(resolveDependencyVisit({ phase1: {}, phase2: {} }, undefined, 1)).toBe(1);
  });
});
