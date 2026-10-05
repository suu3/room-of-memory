"use client";

import { useFrame } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { cursorTarget } from "./cursor-target";

const bounds = new Box3();
const corner = new Vector3();
/** 화면 사각형의 스크래치. 프레임마다 새 객체를 만들지 않고 이 하나를 고쳐 쓴다. */
const screen = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * 커서가 얹힌 3D 오브젝트가 화면에서 차지하는 사각형을 프레임마다 옮겨 적는다
 * (cursor-target). 그리는 것은 없다. 캔버스 안에 있어야 카메라와 캔버스 크기를 안다.
 *
 * 바운딩 박스의 여덟 꼭짓점을 화면에 던져 그 테두리를 잡는다. 카메라 뒤로 넘어간 꼭짓점이
 * 하나라도 있으면 사각형을 내지 않는다. 뒤의 점은 투영이 뒤집혀 사각형이 화면을 덮는다.
 */
export function CursorTargetProjector() {
  useFrame(({ camera, gl }) => {
    const object = cursorTarget.object;
    if (!object) {
      cursorTarget.screen = null;
      return;
    }
    bounds.setFromObject(object);
    if (bounds.isEmpty()) {
      cursorTarget.screen = null;
      return;
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < 8; index += 1) {
      corner
        .set(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z,
        )
        .project(camera);
      if (Math.abs(corner.z) > 1) {
        cursorTarget.screen = null;
        return;
      }
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }
    // 화면 밖으로 삐져나간 부분은 캔버스 가장자리에서 자른다
    const rect = gl.domElement.getBoundingClientRect();
    const toX = (ndc: number) =>
      rect.left + ((Math.min(1, Math.max(-1, ndc)) + 1) / 2) * rect.width;
    const toY = (ndc: number) =>
      rect.top + ((1 - Math.min(1, Math.max(-1, ndc))) / 2) * rect.height;
    screen.left = toX(minX);
    screen.right = toX(maxX);
    screen.top = toY(maxY);
    screen.bottom = toY(minY);
    cursorTarget.screen = screen;
  });
  return null;
}
