/** 닦은 면적을 셀 단위로 세는 격자. 캔버스 픽셀을 읽지 않고 진행도를 계산한다. */
export interface WipeGrid {
  cols: number;
  rows: number;
  cells: boolean[];
}

export interface WipeArea {
  width: number;
  height: number;
}

export function createWipeGrid(cols: number, rows: number): WipeGrid {
  return { cols, rows, cells: new Array(cols * rows).fill(false) };
}

/** (x, y) 반경 radius 안의 셀을 닦은 것으로 표시하고, 전체 대비 닦인 비율을 돌려준다. */
export function wipeCircle(
  grid: WipeGrid,
  area: WipeArea,
  x: number,
  y: number,
  radius: number,
): number {
  const cellW = area.width / grid.cols;
  const cellH = area.height / grid.rows;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      if (grid.cells[index]) continue;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= radius ** 2) grid.cells[index] = true;
    }
  }
  return grid.cells.filter(Boolean).length / grid.cells.length;
}
