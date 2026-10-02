import { describe, expect, it } from "vitest";
import { CUTSCENE_RADIO_BLACKOUT, CUTSCENES } from "@/data/memory-room";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { ASSETS } from "@/lib/assets";
import { broadcastAiring, carriesBroadcast } from "./broadcast-voice";

const line = (speaker: string) => ({ speaker, textKey: "x" }) as never;
const cut = (...speakers: string[]) => ({ lines: speakers.map(line) });

describe("재난 방송의 목소리가 서는 자리", () => {
  it("방송 줄이 없는 컷에서는 울리지 않는다", () => {
    expect(carriesBroadcast(cut("hero", "mom"))).toBe(false);
    expect(broadcastAiring(cut("hero", "mom"), 0)).toBe("off");
    expect(broadcastAiring(undefined, 0)).toBe("off");
  });

  it("방송 줄이 이어지는 동안은 앞에 서고, 다른 사람의 줄에서는 뒤로 물러난다", () => {
    const blackout = cut("broadcast", "broadcast", "broadcast", "hero");
    expect([0, 1, 2, 3].map((index) => broadcastAiring(blackout, index))).toEqual([
      "front",
      "front",
      "front",
      "behind",
    ]);
  });

  it("방송 줄에 닿기 전에는 걸리지 않는다", () => {
    expect(broadcastAiring(cut("hero", "broadcast"), 0)).toBe("off");
    expect(broadcastAiring(cut("hero", "broadcast"), 1)).toBe("front");
  });

  it("대본의 재난 방송 컷이 실제로 이 목소리를 건다", () => {
    const { cuts } = CUTSCENES[CUTSCENE_RADIO_BLACKOUT];
    expect(cuts.filter(carriesBroadcast)).toHaveLength(1);
  });

  it("언어마다 녹음이 하나씩 있다", () => {
    expect(Object.keys(ASSETS.voice.broadcast).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });
});
