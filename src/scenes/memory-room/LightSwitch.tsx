"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { MathUtils } from "three";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LIGHT_SWITCH_PLACEMENT } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import { useGlowHover } from "./use-glow-hover";

const { plateSize, rockerSize } = LIGHT_SWITCH_PLACEMENT;
/** 토글이 위아래로 젖혀지는 각도(라디안). */
const ROCKER_TILT = 0.42;

/**
 * 문 쪽 벽에 붙은 전등 스위치. 누르면 방 불이 꺼지고 다시 누르면 켜진다.
 *
 * 기억도 엔딩 트리거도 아니다 — 눌러도 진행에는 아무 일이 없다. 기획의 배경
 * 오브젝트(docs/content-design.md 4-2)와 같은 성격이라, 수집 카운터에도
 * 잠금 규칙에도 끼지 않는다. 언제든 만질 수 있다.
 */
export function LightSwitch({ palette }: { palette: RoomPalette }) {
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  const toggleLights = useMemoryRoomStore((state) => state.toggleLights);
  const { hovered, handlers } = useGlowHover(true);
  const rockerRef = useRef<Group>(null);

  // 토글은 각도만 오가므로 setState 없이 ref를 민다 (.claude/rules/r3f.md)
  useFrame((_, delta) => {
    const rocker = rockerRef.current;
    if (!rocker) return;
    rocker.rotation.x = MathUtils.damp(
      rocker.rotation.x,
      lightsOn ? -ROCKER_TILT : ROCKER_TILT,
      18,
      delta,
    );
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="light-switch"
      position={LIGHT_SWITCH_PLACEMENT.position}
      rotation={LIGHT_SWITCH_PLACEMENT.rotation}
      {...handlers}
      onClick={(event) => {
        event.stopPropagation();
        // 딸깍은 조작음이라 방 밝기와 무관하게 늘 같은 크기로 울린다
        playSound("select");
        toggleLights();
      }}
    >
      <MemoryGlowSelection selectionKey="light-switch" enabled={hovered}>
        {/* 벽에 붙는 판 */}
        <mesh castShadow>
          <boxGeometry args={plateSize} />
          <meshStandardMaterial color={palette.bone} roughness={0.6} />
        </mesh>
        {/* 젖혀지는 토글. 판 앞면에 얹혀 위아래로 기운다 */}
        <group ref={rockerRef} position={[0, 0, plateSize[2] / 2]}>
          <mesh position={[0, 0, rockerSize[2] / 2]}>
            <boxGeometry args={rockerSize} />
            <meshStandardMaterial color={palette.paper} roughness={0.45} />
          </mesh>
        </group>
      </MemoryGlowSelection>
    </group>
  );
}
