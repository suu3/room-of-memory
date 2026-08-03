/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { RoomInteractionPrompt } from "./RoomInteractionPrompt";

const labels = {
  console: "Console",
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
      nearbyMemoryId="console"
      nearbyLabel="Console · E / Enter"
      labels={labels}
      availableIds={availableIds}
      onInteract={onInteract}
    />,
  );
}

describe("RoomInteractionPrompt", () => {
  it("renders the nearby prompt and seven translated accessible button names", () => {
    renderPrompt(["console"], () => {});

    expect(screen.getByText("Console · E / Enter")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Console" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Frame" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Radio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ball" })).toBeTruthy();
  });

  it("enables available memories and disables unavailable memories", () => {
    renderPrompt(["console", "radio"], () => {});

    expect((screen.getByRole("button", { name: "Console" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole("button", { name: "Radio" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole("button", { name: "Window" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("dispatches the available button's MemoryId", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["console"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Console" }));

    expect(interacted).toEqual(["console"]);
  });

  it("does not dispatch a disabled memory button", () => {
    const interacted: MemoryId[] = [];
    renderPrompt(["console"], (id) => interacted.push(id));

    fireEvent.click(screen.getByRole("button", { name: "Window" }));

    expect(interacted).toEqual([]);
  });
});
