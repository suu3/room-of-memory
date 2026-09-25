/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import type { HotspotStatus } from "@/store/memory-room";
import { RoomInteractionPrompt } from "./RoomInteractionPrompt";

const labels = {
  console: "Console",
  window: "Window",
  frame: "Frame",
  computer: "Computer",
  radio: "Radio",
  phone: "Phone",
  calendar: "Calendar",
  ball: "Ball",
  fridge: "Fridge",
  duffel: "Duffel",
  shoes: "Shoes",
  cards: "Note",
  ampoule: "Ampoule",
  "research-note": "Research Log",
  "id-card": "ID Badges",
} satisfies Record<MemoryId, string>;

afterEach(cleanup);

function renderPrompt(availableIds: readonly MemoryId[], onInteract: (id: MemoryId) => void) {
  const statuses = Object.fromEntries(
    (Object.keys(labels) as MemoryId[]).map((id) => [
      id,
      availableIds.includes(id) ? "available" : "locked",
    ]),
  ) as Record<MemoryId, HotspotStatus>;
  render(
    <RoomInteractionPrompt
      nearbyMemoryId="console"
      nearbyLabel="Console 조사 · E"
      legend="Memories in the room"
      labels={labels}
      statuses={statuses}
      onInteract={onInteract}
    />,
  );
}

describe("RoomInteractionPrompt", () => {
  it("renders the nearby prompt and a translated accessible button per memory", () => {
    renderPrompt(["console"], () => {});

    expect(screen.getByText("Console 조사 · E")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(Object.keys(labels).length);
    expect(screen.getByRole("button", { name: "Console" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Frame" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Radio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ball" })).toBeTruthy();
  });

  it("marks unavailable memories aria-disabled but keeps them focusable", () => {
    // disabled는 포커스 순서에서 빠져 스크린리더가 그 물건이 있는지조차 모른다
    renderPrompt(["console", "radio"], () => {});

    expect(screen.getByRole("button", { name: "Console" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "Radio" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
    const window = screen.getByRole("button", { name: "Window" }) as HTMLButtonElement;
    expect(window.getAttribute("aria-disabled")).toBe("true");
    expect(window.disabled).toBe(false);
  });

  it("names the list so it reads as the room's objects, not thirteen loose buttons", () => {
    renderPrompt(["console"], () => {});
    expect(screen.getByRole("group", { name: "Memories in the room" })).toBeTruthy();
  });

  it("dispatches the available button's MemoryId", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["console"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Console" }));

    expect(interacted).toEqual(["console"]);
  });

  it("keeps unavailable memories in the list under the name it was handed", () => {
    // 조사할 수 없는 물건을 목록에서 지우면 스크린리더에는 방이 비어 가는 것으로 들린다.
    // 이름에 이유를 담는 건 호출부(RoomCanvas)의 일이고, 여기는 그 이름을 지운다/남긴다만 정한다.
    renderPrompt(["console"], () => {});

    const window = screen.getByRole("button", { name: "Window" });
    expect(window.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByRole("button")).toHaveLength(Object.keys(labels).length);
  });

  it("does not dispatch a disabled memory button", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["console"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Window" }));

    expect(interacted).toEqual([]);
  });
});
