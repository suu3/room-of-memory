import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoomInteractionPrompt } from "./RoomInteractionPrompt";

describe("RoomInteractionPrompt", () => {
  it("renders a nearby prompt and one accessible button per memory", () => {
    const html = renderToStaticMarkup(
      <RoomInteractionPrompt
        nearbyMemoryId="bat"
        nearbyLabel="Baseball bat · E / Enter"
        labels={{
          bat: "Bat",
          window: "Window",
          frame: "Frame",
          radio: "Radio",
          phone: "Phone",
          calendar: "Calendar",
          ball: "Ball",
        }}
        availableIds={["bat", "window", "frame", "radio", "phone", "calendar", "ball"]}
        onInteract={() => {}}
      />,
    );

    expect(html).toContain("Baseball bat · E / Enter");
    expect(html.match(/<button/g)).toHaveLength(7);
  });
});
