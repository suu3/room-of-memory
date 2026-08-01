/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { RoomInteractionPrompt } from "./RoomInteractionPrompt";

const labels = {
  bat: "Bat",
  window: "Window",
  frame: "Frame",
  radio: "Radio",
  phone: "Phone",
  calendar: "Calendar",
  ball: "Ball",
} satisfies Record<MemoryId, string>;

afterEach(cleanup);

function renderPrompt(availableIds: readonly MemoryId[], onInteract: (id: MemoryId) => void) {
  render(
    <RoomInteractionPrompt
      nearbyMemoryId="bat"
      nearbyLabel="Baseball bat · E / Enter"
      labels={labels}
      availableIds={availableIds}
      onInteract={onInteract}
    />,
  );
}

describe("RoomInteractionPrompt", () => {
  it("renders the nearby prompt and seven translated accessible button names", () => {
    renderPrompt(["bat"], () => {});

    expect(screen.getByText("Baseball bat · E / Enter")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Bat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Frame" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Radio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ball" })).toBeTruthy();
  });

  it("enables available memories and disables unavailable memories", () => {
    renderPrompt(["bat", "radio"], () => {});

    expect((screen.getByRole("button", { name: "Bat" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Radio" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole("button", { name: "Window" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("dispatches the available button's MemoryId", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["bat"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Bat" }));

    expect(interacted).toEqual(["bat"]);
  });

  it("does not dispatch a disabled memory button", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["bat"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Window" }));

    expect(interacted).toEqual([]);
  });
});
