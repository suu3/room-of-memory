/** 닦은 면적을 셀 단위로 세는 격자. 캔버스 픽셀을 읽지 않고 진행도를 계산한다. */
export interface WipeGrid {
  cols: number;
  rows: number;
  cells: readonly boolean[];
}

export interface WipeArea {
  width: number;
  height: number;
}

export function createWipeGrid(cols: number, rows: number): WipeGrid {
  return { cols, rows, cells: new Array<boolean>(cols * rows).fill(false) };
}

/**
 * (x, y) 반경 radius 안의 셀을 닦은 격자를 돌려준다. 받은 격자는 고치지 않는다.
 * 새로 닦인 셀이 없으면 받은 격자를 그대로 돌려준다 (같은 자리를 문지르는 동안 새 배열을
 * 만들지 않는다).
 */
export function wipeCircle(
  grid: WipeGrid,
  area: WipeArea,
  x: number,
  y: number,
  radius: number,
): WipeGrid {
  const cellW = area.width / grid.cols;
  const cellH = area.height / grid.rows;
  let cells: boolean[] | null = null;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      if (grid.cells[index]) continue;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      if ((cx - x) ** 2 + (cy - y) ** 2 > radius ** 2) continue;
      cells ??= [...grid.cells];
      cells[index] = true;
    }
  }
  return cells ? { ...grid, cells } : grid;
}

/** 전체 대비 닦인 비율 (0~1). */
export function wipedRatio(grid: WipeGrid): number {
  if (grid.cells.length === 0) return 0;
  return grid.cells.filter(Boolean).length / grid.cells.length;
}
