/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { ASSETS } from "@/lib/assets";
import { PhotoPuzzleMinigame } from "./index";
import { PUZZLE_SIZE, TILE_COUNT } from "./puzzle";

function tiles(container: HTMLElement) {
  return [...container.querySelectorAll("button")].filter((button) =>
    button.style.backgroundImage.includes("mg-photo-wipe-phase-2"),
  );
}

describe("PhotoPuzzleMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("sizes each tile's photo on both axes so the pieces do not overlap", () => {
    /*
     * background-size에 값을 하나만 주면 세로는 auto가 된다. 사진 비율대로 늘어난
     * 높이를 0/50/100%로 나눠 잡으니 조각마다 위아래가 겹쳐 보였다. 두 축을 다 줘야
     * 격자 한 칸이 정확히 사진의 1/3씩을 자른다.
     */
    const { container } = render(<PhotoPuzzleMinigame onComplete={() => {}} />);

    for (const tile of tiles(container)) {
      expect(tile.style.backgroundSize).toBe(`${PUZZLE_SIZE * 100}% ${PUZZLE_SIZE * 100}%`);
    }
  });

  it("cuts the photo on the thirds, with one piece per slice", () => {
    const { container } = render(<PhotoPuzzleMinigame onComplete={() => {}} />);
    const positions = tiles(container).map((tile) => tile.style.backgroundPosition);

    // 아홉 조각이 서로 다른 조각이어야 한다 (같은 자리를 두 번 자르면 겹친다)
    expect(new Set(positions).size).toBe(TILE_COUNT);
    for (const position of positions) {
      expect(position).toMatch(/^(0|50|100)% (0|50|100)%$/);
    }
  });

  it("keeps the grid on the photo's own proportions", () => {
    // jsdom은 이미지를 받아오지 않으므로 비율을 못 재고 정사각으로 남는다.
    // 여기서 확인하는 건 "칸마다 비율이 걸려 있다"는 것: 값은 실제 사진이 정한다.
    const { container } = render(<PhotoPuzzleMinigame onComplete={() => {}} />);

    for (const tile of container.querySelectorAll("button")) {
      expect(tile.style.aspectRatio).not.toBe("");
    }
  });

  it("swaps two pieces at a time until the photo is whole", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container } = render(<PhotoPuzzleMinigame onComplete={onComplete} />);
    const slice = (index: number) =>
      (tiles(container)[index] as HTMLElement).style.backgroundPosition;
    const home = (tile: number) => {
      const x = ((tile % PUZZLE_SIZE) / (PUZZLE_SIZE - 1)) * 100;
      const y = (Math.floor(tile / PUZZLE_SIZE) / (PUZZLE_SIZE - 1)) * 100;
      return `${x}% ${y}%`;
    };

    // 자리마다 제 조각을 찾아 맞바꾼다: 많아야 여덟 번
    for (let index = 0; index < TILE_COUNT; index += 1) {
      if (slice(index) === home(index)) continue;
      const from = tiles(container).findIndex((_, at) => slice(at) === home(index));
      fireEvent.click(tiles(container)[index]);
      fireEvent.click(tiles(container)[from]);
    }
    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cleared: true }));
    vi.useRealTimers();
  });

  it("draws the revealed photo, not the shaded one", () => {
    const { container } = render(<PhotoPuzzleMinigame onComplete={() => {}} />);

    expect(tiles(container)[0].style.backgroundImage).toContain(ASSETS.images.mgPhotoWipePhase2);
    expect(container.innerHTML).not.toContain(ASSETS.images.mgPhotoWipePhase1);
  });
});
