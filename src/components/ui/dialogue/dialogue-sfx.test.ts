import { describe, expect, it } from "vitest";
import { typeTick } from "./dialogue-sfx";

describe("typeTick", () => {
  it("ticks on the first character and then every other one", () => {
    expect(typeTick("hero", "가", 1)).not.toBeNull();
    expect(typeTick("hero", "가", 2)).toBeNull();
    expect(typeTick("hero", "가", 3)).not.toBeNull();
  });

  it("stays silent on spaces and punctuation so pauses are audible", () => {
    for (const char of [" ", ".", ",", "…", "?", "!", "。", "、"]) {
      expect(typeTick("hero", char, 1), char).toBeNull();
    }
  });

  it("gives each human speaker a different pitch", () => {
    const pitches = (["hero", "dad", "mom", "narrator"] as const).map(
      (speaker) => typeTick(speaker, "a", 1)?.options.pitch,
    );
    expect(new Set(pitches).size).toBe(pitches.length);
  });

  it("types radio speakers with noise instead of a pitched voice", () => {
    expect(typeTick("signal", "a", 1)?.id).toBe("typeRadio");
    expect(typeTick("hero", "a", 1)?.id).toBe("type");
  });

  it("stays silent for the speaker with a recorded voice", () => {
    expect(typeTick("broadcast", "a", 1)).toBeNull();
  });
});
