import { describe, expect, it } from "vitest";
import { SLIT_SCAN, slitFrameIndex, smearFromWarm } from "./slit-scan";

const { ringSize, columns } = SLIT_SCAN;

describe("slit-scan", () => {
  it("링은 프래그먼트 셰이더의 샘플러 개수와 맞고 줄은 링보다 촘촘하다", () => {
    expect(ringSize).toBeGreaterThan(1);
    expect(columns).toBeGreaterThanOrEqual(ringSize);
  });

  it("폭이 0이면 모든 줄이 가장 최근 칸(writeIndex - 1)을 읽는다: 보통 거울", () => {
    for (let write = 0; write < ringSize; write++) {
      const latest = (write - 1 + ringSize) % ringSize;
      for (let column = 0; column < columns; column++) {
        expect(slitFrameIndex(column, columns, write, ringSize, 0)).toBe(latest);
      }
    }
  });

  it("폭이 1이면 왼쪽 끝은 최근, 오른쪽 끝은 링에서 가장 오래된 칸을 읽는다", () => {
    const write = 5;
    const latest = write - 1;
    const oldest = (write - 1 - (ringSize - 1) + ringSize) % ringSize;
    expect(slitFrameIndex(0, columns, write, ringSize, 1)).toBe(latest);
    expect(slitFrameIndex(columns - 1, columns, write, ringSize, 1)).toBe(oldest);
    // 가장 오래된 칸은 다음에 덮어쓸 칸과 같다: 링을 한 바퀴 다 쓴다
    expect(oldest).toBe(write);
  });

  it("칸 번호는 항상 링 안이다. writeIndex가 어디든, 폭이 범위를 벗어나도", () => {
    for (const write of [0, 1, ringSize - 1, ringSize, ringSize * 3 + 2]) {
      for (const smear of [-1, 0, 0.37, 1, 4]) {
        for (let column = -2; column < columns + 2; column++) {
          const index = slitFrameIndex(column, columns, write, ringSize, smear);
          expect(Number.isInteger(index)).toBe(true);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(ringSize);
        }
      }
    }
  });

  it("왼쪽에서 오른쪽으로 갈수록 시간이 단조롭게 뒤로 간다 (프레임 나이 기준)", () => {
    const write = 3;
    for (const smear of [0.2, 0.5, 1]) {
      let previousAge = 0;
      for (let column = 0; column < columns; column++) {
        const index = slitFrameIndex(column, columns, write, ringSize, smear);
        const age = (write - 1 - index + ringSize) % ringSize;
        expect(age).toBeGreaterThanOrEqual(previousAge);
        previousAge = age;
      }
      // 오른쪽 끝의 나이는 폭에 비례한다
      expect(previousAge).toBe(Math.round(smear * (ringSize - 1)));
    }
  });

  it("줄이 하나뿐이면 폭과 무관하게 최근 칸이다 (0으로 나누지 않는다)", () => {
    expect(slitFrameIndex(0, 1, 2, ringSize, 1)).toBe(1);
  });

  it("폭은 볕의 반대다: 1막은 온폭, 2막 완주는 0, 범위 밖은 끝값", () => {
    expect(smearFromWarm(0)).toBe(1);
    expect(smearFromWarm(1)).toBe(0);
    expect(smearFromWarm(0.25)).toBeCloseTo(0.75);
    expect(smearFromWarm(-2)).toBe(1);
    expect(smearFromWarm(3)).toBe(0);
    // 단조 감소: 되찾을수록 줄이 맞아 든다
    let previous = smearFromWarm(0);
    for (let warm = 0.1; warm <= 1; warm += 0.1) {
      const smear = smearFromWarm(warm);
      expect(smear).toBeLessThanOrEqual(previous);
      previous = smear;
    }
  });
});
