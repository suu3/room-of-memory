"use client";

import { useFrame } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { cursorTarget } from "./cursor-target";

const bounds = new Box3();
const center = new Vector3();
/** 화면 좌표의 스크래치. 프레임마다 새 객체를 만들지 않고 이 하나를 고쳐 쓴다. */
const screen = { x: 0, y: 0 };

/**
 * 커서가 얹힌 3D 오브젝트의 가운데를 프레임마다 화면 좌표로 옮겨 적는다 (cursor-target).
 * 그리는 것은 없다. 캔버스 안에 있어야 카메라와 캔버스 크기를 안다.
 *
 * 원점(getWorldPosition)이 아니라 바운딩 박스의 가운데를 쓴다. 물건의 원점은 대개
 * 바닥이나 벽에 붙어 있어서, 거기로 빨려들면 커서가 물건 밑으로 사라진다.
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
    bounds.getCenter(center).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    screen.x = rect.left + ((center.x + 1) / 2) * rect.width;
    screen.y = rect.top + ((1 - center.y) / 2) * rect.height;
    cursorTarget.screen = screen;
  });
  return null;
}
