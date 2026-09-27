import { describe, expect, it } from "vitest";
import { transposeVoice, VOICES, type VoiceId, voiceDuration } from "./voices";

const IDS = Object.keys(VOICES) as VoiceId[];
/**
 * 조작에 대한 반응이 아니라 방에서 일어나는 사건인 소리. 누른 손에 붙지 않아서 다음
 * 조작을 덮을 일이 없다: 정적 끝에 라디오가 부풀어 오르며 깨어나는 소리 하나.
 */
const SCENE_VOICES: readonly VoiceId[] = ["radioWake"];

describe("synthesised sound voices", () => {
  it("keeps every voice short enough to feel like feedback, not music", () => {
    for (const id of IDS) {
      const duration = voiceDuration(VOICES[id]);
      expect(duration, id).toBeGreaterThan(0);
      // 0.6초를 넘으면 다음 조작을 덮어 "반응"이 아니라 "연출"로 읽힌다
      expect(duration, id).toBeLessThanOrEqual(SCENE_VOICES.includes(id) ? 1.6 : 0.6);
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
        // exponentialRampToValueAtTime은 0을 지날 수 없다. 주파수는 항상 양수여야 한다
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

describe("transposeVoice", () => {
  it("returns the voice untouched at ratio 1", () => {
    expect(transposeVoice(VOICES.wipe, 1)).toBe(VOICES.wipe);
  });

  it("moves tone frequencies and the noise band together", () => {
    // 대역을 두고 음정만 옮기면 재질이 어긋난다. 필터도 같은 비율로 따라가야 한다.
    const moved = transposeVoice(VOICES.wipe, 2);
    expect(moved.tones[0].from).toBeCloseTo(VOICES.wipe.tones[0].from * 2, 5);
    expect(moved.tones[0].to ?? 0).toBeCloseTo((VOICES.wipe.tones[0].to ?? 0) * 2, 5);
    expect(moved.noise?.highpass).toBeCloseTo((VOICES.wipe.noise?.highpass ?? 0) * 2, 5);
    expect(moved.noise?.lowpass).toBeCloseTo((VOICES.wipe.noise?.lowpass ?? 0) * 2, 5);
  });

  it("leaves gains and timing alone so the same action stays the same action", () => {
    const moved = transposeVoice(VOICES.batHit, 1.2);
    expect(voiceDuration(moved)).toBe(voiceDuration(VOICES.batHit));
    expect(moved.tones[0].gain).toBe(VOICES.batHit.tones[0].gain);
    expect(moved.noise?.gain).toBe(VOICES.batHit.noise?.gain);
  });

  it("does not mutate the source voice", () => {
    const before = VOICES.punch.tones[0].from;
    transposeVoice(VOICES.punch, 3);
    expect(VOICES.punch.tones[0].from).toBe(before);
  });

  it("keeps every voice within the gain contract after the widest variation in use", () => {
    // photo-wipe의 0.14가 지금 제일 큰 변주다. 어느 쪽 끝으로 흔들려도 주파수는
    // 양수여야 한다. exponentialRampToValueAtTime이 0을 지날 수 없다.
    for (const id of IDS) {
      for (const ratio of [0.86, 1.14]) {
        const moved = transposeVoice(VOICES[id], ratio);
        for (const tone of moved.tones) {
          expect(tone.from, `${id} @ ${ratio}`).toBeGreaterThan(0);
          if (tone.to !== undefined) expect(tone.to, `${id} @ ${ratio}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
