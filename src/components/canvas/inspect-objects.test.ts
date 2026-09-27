import { describe, expect, it } from "vitest";
import { ampouleObject } from "./inspect-objects";

describe("ampoule inspect object", () => {
  it("uses the shared vial GLB instead of a primitive cylinder", () => {
    expect(ampouleObject()).toEqual({
      shape: "model",
      model: "ampoule",
      size: [0.28, 0.78, 0.28],
      foundYaw: Math.PI * 0.525,
      tilt: 0.1,
    });
  });
});

describe("손이 하는 일이 물건마다 갈린다 (뒤집기는 문제집 하나만)", async () => {
  const { inspectControlOf } = await import("./InspectTurntable");
  const { idCardObject, shelfBookObject, tableNoteObject, workbookObject } = await import(
    "./inspect-objects"
  );

  it("문제집은 돌려서 뒤표지를 본다", () => {
    const workbook = workbookObject({ name: "한도해", tagLabel: "이름", tagGrade: "고3" });
    expect(inspectControlOf(workbook)).toEqual({ kind: "turn" });
    expect(workbook.shape === "box" && workbook.foundYaw).toBe(Math.PI);
  });

  it("쪽지는 펼친다", () => {
    const note = tableNoteObject("아래칸 건드리지 마.", "엄마가");
    expect(note.shape).toBe("folded-note");
    expect(inspectControlOf(note)).toEqual({ kind: "unfold" });
  });

  it("책은 장을 넘긴다: 앞표지 한 장 + 본문 넉 장, 찾을 쪽은 세 장 넘긴 오른쪽", () => {
    const book = shelfBookObject("야구 규칙 해설", "11");
    expect(inspectControlOf(book)).toEqual({ kind: "pages", sheets: 5 });
    if (book.shape !== "book") throw new Error("book expected");
    expect(book.pages).toHaveLength(10);
    expect(book.target % 2).toBe(0);
    expect(book.pages[book.target].overlay).toBeDefined();
    expect(book.pages[book.target].image).toContain("mg-shelf-book-inside");
  });

  it("출입증은 기울인다: 찾는 것이 면이 아니라 각도다", () => {
    const card = idCardObject({
      org: "라온",
      mom: { department: "백신개발실", name: "한소하", role: "책임연구원" },
      dad: { department: "감염병연구부", name: "서태오", role: "선임연구원" },
    });
    expect(inspectControlOf(card)).toEqual({ kind: "tilt" });
    if (card.shape !== "box") throw new Error("box expected");
    expect(card.hologram?.spot.pitch).toBeLessThan(0);
    // 씰은 앞면 안에 온전히 들어간다
    const rect = card.hologram?.rect;
    expect(rect && rect.x + rect.width).toBeLessThanOrEqual(1);
    expect(rect && rect.y + rect.height).toBeLessThanOrEqual(1);
  });
});
