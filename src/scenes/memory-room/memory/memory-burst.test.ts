import { describe, expect, it } from "vitest";
import { newlyRecorded } from "./MemoryBurst";

describe("newlyRecorded", () => {
  it("새로 붙은 id 하나를 돌려준다", () => {
    expect(newlyRecorded(["ball"], [])).toBe("ball");
    expect(newlyRecorded(["ball", "radio"], ["ball"])).toBe("radio");
  });

  it("줄었거나 같으면 null", () => {
    expect(newlyRecorded([], ["ball"])).toBeNull();
    expect(newlyRecorded(["ball"], ["ball"])).toBeNull();
  });
});
