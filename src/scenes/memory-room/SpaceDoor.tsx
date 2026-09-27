"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { playSound } from "@/lib/audio";
import { selectDoorwayOpen, selectDoorwayReady, useMemoryRoomStore } from "@/store/memory-room";
import { ROOM_DOOR_LEAF } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import { approach } from "./memory-motion";
import type { RoomPalette } from "./palette";
import { DOORWAYS, type DoorwayId } from "./spaces";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";

/** 문틀: 방문(RoomShell)과 같은 치수. 같은 집의 문이다. */
const DOOR_FRAME = [
  { size: [0.18, 3.62, 0.18], position: [-0.82, 0.09, 0] },
  { size: [0.18, 3.62, 0.18], position: [0.82, 0.09, 0] },
  { size: [1.82, 0.18, 0.18], position: [0, 1.81, 0] },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

/**
 * 거실에서 새 공간으로 이어지는 문 (화장실·안방). 방문·현관문과 같은 문법이다:
 * 조건이 차면 금빛이 돌고, 누르면 열리고, 한 번 열리면 계속 열려 있다.
 *
 * 문짝은 경첩(문틀 -x 기둥 안쪽)을 축으로 **저쪽 공간 쪽으로** 젖혀진다. 거실 쪽으로
 * 젖히면 판이 거실 통로를 물어 콜라이더가 하나 더 필요하다. 저쪽 공간의 문 앞은
 * 비워 두는 것이 배치 원칙이라(layout.test) 콜라이더 없이 판만 돈다.
 *
 * 두 공간 그룹 밖, 씬 층위에 선다. 어느 쪽에 서 있든 문은 보여야 하는데, 한 번에 한
 * 공간만 그리는 씬에서 문을 한쪽 껍데기에 넣으면 다른 쪽에서 문틀 없는 구멍만 남는다.
 */
export function SpaceDoor({ id, palette }: { id: DoorwayId; palette: RoomPalette }) {
  const doorway = DOORWAYS[id];
  const open = useMemoryRoomStore(selectDoorwayOpen(id));
  const ready = useMemoryRoomStore(selectDoorwayReady(id));
  const openDoorway = useMemoryRoomStore((state) => state.openDoorway);
  const { hovered, handlers } = useGlowHover(ready);
  const leafRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const leaf = leafRef.current;
    if (!leaf) return;
    leaf.rotation.y = approach(leaf.rotation.y, open ? -ROOM_DOOR_LEAF.openAngle : 0, 4, delta);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name={`door-${id}`}
      position={doorway.position}
      rotation={doorway.rotation}
      {...handlers}
      onClick={(event) => {
        if (open) return;
        event.stopPropagation();
        if (!ready) {
          playSound("deny");
          return;
        }
        playSound("doorOpen");
        openDoorway(id);
      }}
    >
      <group ref={leafRef} position={[-ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
        <MemoryGlowSelection selectionKey={`door-${id}`} tier="memory" enabled={ready}>
          <group position={[ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
            <mesh castShadow>
              <boxGeometry
                args={[ROOM_DOOR_LEAF.width, ROOM_DOOR_LEAF.height, ROOM_DOOR_LEAF.thickness]}
              />
              <meshStandardMaterial
                color={palette.frame}
                emissive={palette.memory}
                emissiveIntensity={ready && hovered ? 0.35 : 0}
                roughness={0.82}
              />
            </mesh>
            <mesh position={[0.48, 0, 0.1]}>
              <boxGeometry args={[0.11, 0.11, 0.1]} />
              <meshStandardMaterial
                color={palette.amber}
                emissive={palette.memory}
                emissiveIntensity={ready ? 0.8 : 0}
                roughness={0.82}
              />
            </mesh>
          </group>
        </MemoryGlowSelection>
      </group>
      {DOOR_FRAME.map((part) => (
        <mesh key={part.position.join(":")} position={part.position} castShadow>
          <boxGeometry args={part.size} />
          <meshStandardMaterial color={palette.wood} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}
