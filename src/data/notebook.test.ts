import { describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { type NotebookSource, notebookEntries, unreadNotebookTabs } from "./notebook";

const EMPTY: NotebookSource = {
  collected: [],
  revisited: [],
  rechecked: [],
  discoveries: [],
  inventory: [],
  doorOpened: false,
  openedDoorways: [],
};

describe("수첩의 안 읽은 알림", () => {
  it("추리를 이으면 추리 페이지에 새 글이 선다", () => {
    const state = { ...EMPTY, deduced: ["trip-doubt" as const], notebookRead: [] };
    expect(notebookEntries(state).deductions).toEqual(["deduction:trip-doubt"]);
    expect(unreadNotebookTabs(state)).toEqual(["deductions"]);
    expect(unreadNotebookTabs({ ...state, notebookRead: ["deduction:trip-doubt"] })).toEqual([]);
  });

  it("아무것도 안 적힌 수첩에는 알림이 없다", () => {
    expect(unreadNotebookTabs({ ...EMPTY, notebookRead: [] })).toEqual([]);
  });

  it("새로 적힌 것이 있는 페이지만 탭 순서대로 선다", () => {
    const state = {
      ...EMPTY,
      discoveries: ["hero-name" as const],
      inventory: ["parents-key" as const],
      notebookRead: [],
    };
    expect(unreadNotebookTabs(state)).toEqual(["profile", "items"]);
  });

  it("펼쳐 본 항목은 다시 알리지 않는다", () => {
    const source = { ...EMPTY, discoveries: ["hero-name" as const] };
    const read = notebookEntries(source).profile;
    expect(unreadNotebookTabs({ ...source, notebookRead: read })).toEqual([]);
  });

  it("같은 기록이 2차 조사로 갈아끼워지면 새 글로 친다", () => {
    const radio = "radio" as MemoryId;
    const first = { ...EMPTY, collected: [radio] };
    const read = notebookEntries(first).lore;
    expect(unreadNotebookTabs({ ...first, notebookRead: read })).toEqual([]);
    expect(unreadNotebookTabs({ ...first, revisited: [radio], notebookRead: read })).toEqual([
      "lore",
    ]);
  });

  it("평면도는 방문이 열려야 적힌다", () => {
    expect(notebookEntries(EMPTY).map).toEqual([]);
    expect(notebookEntries({ ...EMPTY, doorOpened: true }).map).toEqual(["map"]);
  });
});
