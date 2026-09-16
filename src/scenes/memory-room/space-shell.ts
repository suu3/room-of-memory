import type { Aabb2, Vec3Tuple } from "./types";

/*
 * 공간 껍데기의 공통 치수와 벽 조각 계산. RoomShell·LivingRoomShell이 손으로 들고 있던
 * 값을 새 공간(화장실·안방)이 같이 쓴다. 같은 집이라 벽 높이·두께·굽도리가 다르면
 * 문 하나 건넜을 뿐인데 다른 건물이 된다.
 */

export const WALL_HEIGHT = 4.8;
export const WALL_THICKNESS = 0.18;
export const WALL_CENTER_Y = 2.3;
/** 굽도리 높이: 걸레받이(0.3)와 같다 (RoomShell의 WALL_STUB_TOP_Y 주석). */
export const WALL_STUB_TOP_Y = 0.3;
export const WALL_Y = {
  min: WALL_CENTER_Y - WALL_HEIGHT / 2,
  max: WALL_CENTER_Y + WALL_HEIGHT / 2,
} as const;
/** 문 개구부의 절반 폭과 상인방 아랫면. 방문의 구멍(RoomShell의 DOOR_HOLE)과 같다. */
export const DOOR_HOLE_HALF_WIDTH = 0.82;
export const DOOR_HOLE_TOP_Y = 3.46;

export interface ShellPart {
  size: Vec3Tuple;
  position: Vec3Tuple;
}

interface Range {
  min: number;
  max: number;
}

/** z축을 보고 선 벽(앞·뒤) 한 조각. x·y 범위를 좁혀 개구부를 비운다. */
export function endWallSegment(z: number, x: Range, y: Range): ShellPart {
  return {
    size: [x.max - x.min, y.max - y.min, WALL_THICKNESS],
    position: [(x.min + x.max) / 2, (y.min + y.max) / 2, z],
  };
}

/** x축을 보고 선 벽(왼·오른) 한 조각. */
export function sideWallSegment(x: number, z: Range, y: Range): ShellPart {
  return {
    size: [WALL_THICKNESS, y.max - y.min, z.max - z.min],
    position: [x, (y.min + y.max) / 2, (z.min + z.max) / 2],
  };
}

/**
 * z축 벽을 문 자리에서 끊은 조각들: 굽도리 두 토막(문 아래는 비운다)과 윗벽 세 조각
 * (양옆 + 상인방 위). 문이 없는 벽은 doorX 없이 부르면 통짜 두 조각이다.
 */
export function endWallWithDoor(z: number, x: Range, doorX?: number): ShellPart[] {
  const stub = { min: WALL_Y.min, max: WALL_STUB_TOP_Y };
  const upper = { min: WALL_STUB_TOP_Y, max: WALL_Y.max };
  if (doorX === undefined) {
    return [endWallSegment(z, x, stub), endWallSegment(z, x, upper)];
  }
  const hole = { min: doorX - DOOR_HOLE_HALF_WIDTH, max: doorX + DOOR_HOLE_HALF_WIDTH };
  const left = { min: x.min, max: hole.min };
  const right = { min: hole.max, max: x.max };
  return [
    endWallSegment(z, left, stub),
    endWallSegment(z, right, stub),
    endWallSegment(z, left, upper),
    endWallSegment(z, right, upper),
    endWallSegment(z, hole, { min: DOOR_HOLE_TOP_Y, max: WALL_Y.max }),
  ];
}

/** x축 벽을 문 자리에서 끊은 조각들 (endWallWithDoor의 x축 판). */
export function sideWallWithDoor(x: number, z: Range, doorZ: number): ShellPart[] {
  const stub = { min: WALL_Y.min, max: WALL_STUB_TOP_Y };
  const upper = { min: WALL_STUB_TOP_Y, max: WALL_Y.max };
  const hole = { min: doorZ - DOOR_HOLE_HALF_WIDTH, max: doorZ + DOOR_HOLE_HALF_WIDTH };
  const near = { min: z.min, max: hole.min };
  const far = { min: hole.max, max: z.max };
  return [
    sideWallSegment(x, near, stub),
    sideWallSegment(x, far, stub),
    sideWallSegment(x, near, upper),
    sideWallSegment(x, far, upper),
    sideWallSegment(x, hole, { min: DOOR_HOLE_TOP_Y, max: WALL_Y.max }),
  ];
}

/** x축 벽의 굽도리와 윗벽 (문 없음). */
export function sideWallPlain(x: number, z: Range): { stub: ShellPart; upper: ShellPart } {
  return {
    stub: sideWallSegment(x, z, { min: WALL_Y.min, max: WALL_STUB_TOP_Y }),
    upper: sideWallSegment(x, z, { min: WALL_STUB_TOP_Y, max: WALL_Y.max }),
  };
}

export function floorPart(shell: Aabb2): ShellPart {
  return {
    size: [shell.maxX - shell.minX, 0.22, shell.maxZ - shell.minZ],
    position: [(shell.minX + shell.maxX) / 2, -0.12, (shell.minZ + shell.maxZ) / 2],
  };
}

/** 디오라마 받침: 한 받침 위의 한 집 (RoomShell의 PLINTH와 같은 두 단). */
export function plinthParts(shell: Aabb2): ShellPart[] {
  const width = shell.maxX - shell.minX;
  const depth = shell.maxZ - shell.minZ;
  const cx = (shell.minX + shell.maxX) / 2;
  const cz = (shell.minZ + shell.maxZ) / 2;
  return [
    { size: [width + 0.5, 0.14, depth + 0.5], position: [cx, -0.28, cz] },
    { size: [width + 0.14, 0.55, depth + 0.14], position: [cx, -0.6, cz] },
  ];
}
