import { describe, expect, it } from "vitest";
import { KEY_PRESS_DEPTH, PIANO_KEYS } from "@/minigames/piano-melody/keys";
import { PIANO_CABINET_PARTS, PIANO_FALLBOARD } from "./PianoCabinet";

describe("피아노 건반 공간", () => {
  it("건반을 끝까지 눌러도 본체·받침·옆판을 관통하지 않는다", () => {
    for (const key of PIANO_KEYS) {
      for (const part of PIANO_CABINET_PARTS) {
        const intersects = [0, 1, 2].every((axis) => {
          const keyMin =
            key.position[axis] - key.size[axis] / 2 - (axis === 1 ? KEY_PRESS_DEPTH : 0);
          const keyMax = key.position[axis] + key.size[axis] / 2;
          const partMin = part.position[axis] - part.size[axis] / 2;
          const partMax = part.position[axis] + part.size[axis] / 2;
          return keyMin < partMax && keyMax > partMin;
        });
        expect(intersects, `${key.note}/${key.black ? "검정" : "흰색"}: ${part.name}`).toBe(false);
      }
    }
  });

  it("닫힌 덮개는 모든 건반보다 위에 있고 앞뒤를 덮는다", () => {
    for (const key of PIANO_KEYS) {
      expect(PIANO_FALLBOARD.pivot[1] - PIANO_FALLBOARD.thickness / 2).toBeGreaterThan(
        key.position[1] + key.size[1] / 2,
      );
      expect(PIANO_FALLBOARD.pivot[2]).toBeGreaterThan(key.position[2] + key.size[2] / 2);
      expect(PIANO_FALLBOARD.pivot[2] - PIANO_FALLBOARD.depth).toBeLessThan(
        key.position[2] - key.size[2] / 2,
      );
    }
  });
});
