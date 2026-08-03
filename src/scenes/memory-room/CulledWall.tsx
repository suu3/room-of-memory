"use client";

import { useFrame } from "@react-three/fiber";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { type Group, MathUtils, type Mesh, type MeshStandardMaterial } from "three";
import { ROOM_SHELL_CENTER } from "./layout";
import { type WallSide, wallOpacity } from "./wall-culling";

const [SHELL_CENTER_X, SHELL_CENTER_Z] = ROOM_SHELL_CENTER;

/**
 * 카메라를 향하면 스러지는 벽 한 면 — 과 그 벽에 붙은 것들.
 *
 * 벽만 지우고 거기 걸린 포스터를 그대로 두면 액자가 허공에 뜬다. 벽면에 속한 건
 * 전부 같은 그룹 안에 넣어서 함께 사라지게 한다 (RoomShell의 창·창밖 풍경,
 * RoomDecor의 벽 장식).
 *
 * 규칙 자체는 wall-culling.ts에 순수 함수로 있다. 여기는 그 값을 머티리얼에
 * 밀어 넣는 일만 한다.
 */
export function CulledWall({ side, children }: { side: WallSide; children: ReactNode }) {
  const groupRef = useRef<Group>(null);
  const materialsRef = useRef<MeshStandardMaterial[]>([]);
  const opacityRef = useRef(1);

  // 자식 머티리얼을 한 번만 모아 둔다. transparent는 프로그램 재컴파일을 부르므로
  // 여기서 한 번 켜고, 이후 프레임에서는 opacity 숫자만 민다.
  //
  // 마운트 시점에 씬 그래프에 있는 메쉬만 잡힌다 — Suspense로 나중에 들어오는
  // glb(FurnitureModel)는 여기 안 걸리므로, 그런 소품은 늘 서 있는 벽에만 둔다.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const collected: MeshStandardMaterial[] = [];
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const standard = material as MeshStandardMaterial;
        standard.transparent = true;
        standard.needsUpdate = true;
        collected.push(standard);
      }
    });
    materialsRef.current = collected;
  }, []);

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const goal = wallOpacity(
      side,
      camera.position.x - SHELL_CENTER_X,
      camera.position.z - SHELL_CENTER_Z,
    );
    const next = MathUtils.damp(opacityRef.current, goal, 9, delta);
    opacityRef.current = next;

    // 완전히 투명해지면 아예 그리지 않는다 — 투명 패스 정렬 비용과
    // 그림자 캐스팅을 같이 덜어낸다.
    group.visible = next > 0.02;
    if (!group.visible) return;
    for (const material of materialsRef.current) material.opacity = next;
  });

  return (
    <group ref={groupRef} name={`wall-${side}-upper`}>
      {children}
    </group>
  );
}
