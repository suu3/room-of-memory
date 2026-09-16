"use client";

import { useFrame } from "@react-three/fiber";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { type Group, MathUtils } from "three";
import { useMemoryRoomStore, viewpointOf } from "@/store/memory-room";
import { ROOM_SHELL_CENTER } from "./layout";
import { type WallSide, wallOpacity } from "./wall-culling";
import {
  applyWallOpacity,
  prepareWallMaterials,
  WALL_HIDDEN_OPACITY,
  WALL_OPACITY_EPSILON,
} from "./wall-materials";

const [SHELL_CENTER_X, SHELL_CENTER_Z] = ROOM_SHELL_CENTER;

/**
 * 카메라를 향하면 스러지는 벽 한 면: 과 그 벽에 붙은 것들.
 *
 * 벽만 지우고 거기 걸린 포스터를 그대로 두면 액자가 허공에 뜬다. 벽면에 속한 건
 * 전부 같은 그룹 안에 넣어서 함께 사라지게 한다 (RoomShell의 창·창밖 풍경,
 * RoomDecor의 벽 장식).
 *
 * Suspense로 나중에 들어오는 glb(FurnitureModel)도 같이 스러진다. 마운트 시점
 * 재질만 들고 있으면 늦게 붙었다는 이유만으로 소품이 벽에서 떨어져 나온다.
 *
 * 규칙 자체는 wall-culling.ts에 순수 함수로, 재질을 만지는 일은 wall-materials.ts에
 * 있다. 여기는 프레임마다 그 둘을 잇는다.
 */
export function CulledWall({
  side,
  center,
  hidden = false,
  children,
}: {
  side: WallSide;
  /**
   * 이 벽이 둘러싼 공간의 중심(x·z). 기본은 방: 거실 벽은 거실 중심을 넘긴다.
   * 공간마다 중심이 달라야 "카메라가 이 공간의 어느 쪽에 있나"가 맞게 계산된다.
   */
  center?: readonly [number, number];
  /**
   * 카메라 각도와 무관하게 강제로 걷는다. 방과 거실의 공유벽이 쓴다. 플레이어가
   * 거실에 있으면 이 벽이 카메라와 플레이어 사이에 서는데, 각도 규칙으로는 잡히지
   * 않는 가림이다 (카메라는 늘 +x 쪽에 있어 왼벽의 facing이 음수다).
   */
  hidden?: boolean;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  const opacityRef = useRef(1);
  /** 마지막으로 재질에 써 넣은 값. 이만큼 움직였을 때만 다시 칠한다. */
  const appliedRef = useRef(1);

  // 마운트 시점 메쉬는 transparent를 미리 켜 둔다. 벽이 스러지기 시작하는 첫
  // 프레임에 셰이더 재컴파일이 한꺼번에 몰리지 않게. 나중에 들어오는 메쉬는
  // applyWallOpacity가 처음 칠할 때 같이 켠다.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (group) prepareWallMaterials(group);
  }, []);

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const [centerX, centerZ] = center ?? [SHELL_CENTER_X, SHELL_CENTER_Z];
    /*
     * 1인칭(1인칭)에서는 벽을 걷지 않는다. 걷는 규칙은 밖에서 내려다보는 카메라를
     * 위한 것이라, 안에서 보면 다가서는 벽마다 사라져 방이 뚫린다. 스토어를 프레임마다
     * 읽지만 getState는 구독이 아니라 싸다.
     */
    const firstPerson = viewpointOf(useMemoryRoomStore.getState()) !== null;
    const goal = hidden
      ? 0
      : firstPerson
        ? 1
        : wallOpacity(side, camera.position.x - centerX, camera.position.z - centerZ);
    let next = MathUtils.damp(opacityRef.current, goal, 9, delta);
    // damp는 목표에 수렴만 하고 닿지는 않는다. 눈에 안 보이는 나머지를 끊어야
    // 벽이 멈춘 뒤 트래버스도 같이 멈춘다.
    if (Math.abs(next - goal) < WALL_OPACITY_EPSILON) next = goal;
    opacityRef.current = next;

    // 완전히 투명해지면 아예 그리지 않는다. 투명 패스 정렬 비용과
    // 그림자 캐스팅을 같이 덜어낸다.
    group.visible = next > WALL_HIDDEN_OPACITY;
    if (!group.visible) return;
    if (Math.abs(next - appliedRef.current) < WALL_OPACITY_EPSILON) return;

    applyWallOpacity(group, next);
    appliedRef.current = next;
  });

  return (
    <group ref={groupRef} name={`wall-${side}-upper`}>
      {children}
    </group>
  );
}
