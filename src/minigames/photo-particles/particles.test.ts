import { describe, expect, it } from "vitest";
import {
  createParticleState,
  DEFAULT_STEP_OPTIONS,
  FACE_MAX_DRIFT,
  FACE_REGIONS,
  hash01,
  type ImageLike,
  inFaceRegion,
  maxDistanceFromHome,
  PARTICLE_TARGET,
  type ParticleState,
  samplePhoto,
  spacingFor,
  stepParticles,
} from "./particles";

/** 합성 이미지: 왼쪽 절반은 빨강, 오른쪽 절반은 투명 */
function halfImage(width: number, height: number): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (x < width / 2) {
        data[offset] = 200;
        data[offset + 1] = 30;
        data[offset + 2] = 10;
        data[offset + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

const DT = 1 / 60;

function run(state: ParticleState, frames: number, active = false) {
  for (let frame = 0; frame < frames; frame += 1) {
    stepParticles(state, DT, { x: 0.5, y: 0.5, active }, DEFAULT_STEP_OPTIONS);
  }
}

describe("samplePhoto", () => {
  it("samples one particle per grid cell and skips transparent pixels", () => {
    const sample = samplePhoto(halfImage(40, 20), 10);

    // 4×2 칸 중 왼쪽 2열만 남는다
    expect(sample.count).toBe(4);
    expect(sample.x.length).toBe(4);
    expect(Array.from(sample.x)).toEqual([5, 15, 5, 15]);
    expect(Array.from(sample.y)).toEqual([5, 5, 15, 15]);
    expect(sample.r[0]).toBe(200);
    expect(sample.g[0]).toBe(30);
    expect(sample.b[0]).toBe(10);
    expect(sample.alpha[0]).toBe(1);
  });

  it("does not read past the image on fractional spacing", () => {
    const sample = samplePhoto(halfImage(13, 7), 2.6);

    expect(sample.count).toBeGreaterThan(0);
    for (let i = 0; i < sample.count; i += 1) {
      expect(sample.x[i]).toBeLessThan(13);
      expect(sample.y[i]).toBeLessThan(7);
    }
  });
});

describe("spacingFor", () => {
  it("lands near the particle target for a photo-sized canvas", () => {
    const spacing = spacingFor(560, 511);
    const count = Math.floor(560 / spacing) * Math.floor(511 / spacing);
    expect(count).toBeGreaterThan(PARTICLE_TARGET * 0.9);
    expect(count).toBeLessThanOrEqual(PARTICLE_TARGET * 1.05);
  });

  it("never drops below one pixel", () => {
    expect(spacingFor(10, 10)).toBe(1);
    expect(spacingFor(0, 100)).toBe(1);
  });
});

describe("inFaceRegion", () => {
  it("finds both parents' faces in the phase photos and nothing at the corners", () => {
    for (const phase of [1, 2] as const) {
      const regions = FACE_REGIONS[phase];
      for (const region of regions) {
        expect(inFaceRegion(region.x + region.w / 2, region.y + region.h / 2, regions)).toBe(true);
      }
      expect(inFaceRegion(0.02, 0.02, regions)).toBe(false);
      expect(inFaceRegion(0.5, 0.95, regions)).toBe(false);
    }
  });
});

describe("hash01", () => {
  it("is deterministic and stays in [0, 1)", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = hash01(i);
      expect(value).toBe(hash01(i));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(hash01(1)).not.toBe(hash01(2));
  });
});

describe("stepParticles", () => {
  const sample = samplePhoto(halfImage(40, 40), 4);

  it("brings every non-face particle home once the pointer is gone", () => {
    const state = createParticleState(sample, { width: 40, height: 40, regions: [], scatter: 0.3 });
    expect(maxDistanceFromHome(state)).toBeGreaterThan(0.1);

    run(state, 300);

    expect(maxDistanceFromHome(state)).toBeLessThan(1e-3);
  });

  it("keeps face particles hovering when faceSpring is 0, inside the drift fence", () => {
    const everywhere = [{ x: 0, y: 0, w: 1, h: 1 }];
    const state = createParticleState(sample, {
      width: 40,
      height: 40,
      regions: everywhere,
      scatter: 0.3,
    });
    expect(state.face.every((flag) => flag === 1)).toBe(true);

    run(state, 600);

    const drift = maxDistanceFromHome(state, true);
    expect(drift).toBeGreaterThan(0.01);
    expect(drift).toBeLessThanOrEqual(FACE_MAX_DRIFT * 1.5 + 1e-6);
  });

  it("brings face particles home too when faceSpring matches the spring", () => {
    const everywhere = [{ x: 0, y: 0, w: 1, h: 1 }];
    const state = createParticleState(sample, {
      width: 40,
      height: 40,
      regions: everywhere,
      scatter: 0.3,
    });
    for (let frame = 0; frame < 300; frame += 1) {
      stepParticles(
        state,
        DT,
        { x: 0.5, y: 0.5, active: false },
        {
          ...DEFAULT_STEP_OPTIONS,
          faceSpring: DEFAULT_STEP_OPTIONS.springStrength,
          faceWander: 0,
        },
      );
    }
    expect(maxDistanceFromHome(state, true)).toBeLessThan(1e-3);
  });

  it("pushes particles away from an active pointer", () => {
    const state = createParticleState(sample, { width: 40, height: 40, regions: [], scatter: 0 });
    // 사진 왼쪽 절반 위에 커서를 둔다 (왼쪽 절반만 입자가 있다)
    for (let frame = 0; frame < 10; frame += 1) {
      stepParticles(state, DT, { x: 0.25, y: 0.5, active: true }, DEFAULT_STEP_OPTIONS);
    }
    expect(maxDistanceFromHome(state)).toBeGreaterThan(0.001);
  });

  it("is deterministic for the same inputs", () => {
    const a = createParticleState(sample, { width: 40, height: 40, regions: [], scatter: 0.2 });
    const b = createParticleState(sample, { width: 40, height: 40, regions: [], scatter: 0.2 });
    run(a, 40, true);
    run(b, 40, true);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.vy)).toEqual(Array.from(b.vy));
  });

  it("clamps a huge dt so a sleeping tab does not explode the spring", () => {
    const state = createParticleState(sample, { width: 40, height: 40, regions: [], scatter: 0.3 });
    stepParticles(state, 5, { x: 0, y: 0, active: false }, DEFAULT_STEP_OPTIONS);
    expect(maxDistanceFromHome(state)).toBeLessThan(0.3);
    expect(Number.isFinite(state.x[0])).toBe(true);
  });
});
