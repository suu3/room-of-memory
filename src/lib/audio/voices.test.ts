import { describe, expect, it } from "vitest";
import { VOICES, type VoiceId, voiceDuration } from "./voices";

const IDS = Object.keys(VOICES) as VoiceId[];

describe("synthesised sound voices", () => {
  it("keeps every voice short enough to feel like feedback, not music", () => {
    for (const id of IDS) {
      const duration = voiceDuration(VOICES[id]);
      expect(duration, id).toBeGreaterThan(0);
      // 0.6초를 넘으면 다음 조작을 덮어 "반응"이 아니라 "연출"로 읽힌다
      expect(duration, id).toBeLessThanOrEqual(0.6);
    }
  });

  it("keeps gains in range so the master bus never clips", () => {
    for (const id of IDS) {
      const voice = VOICES[id];
      for (const tone of voice.tones) {
        expect(tone.gain, id).toBeGreaterThan(0);
        expect(tone.gain, id).toBeLessThanOrEqual(1);
        expect(tone.duration, id).toBeGreaterThan(0);
        expect(tone.delay, id).toBeGreaterThanOrEqual(0);
        // exponentialRampToValueAtTime은 0을 지날 수 없다 — 주파수는 항상 양수여야 한다
        expect(tone.from, id).toBeGreaterThan(0);
        if (tone.to !== undefined) expect(tone.to, id).toBeGreaterThan(0);
      }
      // 한 소리 안에서 동시에 울리는 톤들의 합이 1을 넘으면 찌그러진다
      const peak = voice.tones
        .filter((tone) => tone.delay === 0)
        .reduce((sum, tone) => sum + tone.gain, voice.noise?.delay === 0 ? voice.noise.gain : 0);
      expect(peak, id).toBeLessThanOrEqual(1);
    }
  });

  it("keeps hover quieter than every deliberate action", () => {
    // flip처럼 노이즈가 본체인 소리도 있으니 톤만 보면 안 된다.
    const loudest = (id: VoiceId) => {
      const voice = VOICES[id];
      return Math.max(...voice.tones.map((tone) => tone.gain), voice.noise?.gain ?? 0);
    };
    for (const id of IDS.filter((candidate) => candidate !== "hover")) {
      expect(loudest("hover"), id).toBeLessThan(loudest(id));
    }
  });
});
