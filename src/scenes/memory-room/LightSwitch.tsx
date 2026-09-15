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
import { useNearPlayer } from "./use-near-player";

const { plateSize, rockerSize, pilotSize } = LIGHT_SWITCH_PLACEMENT;
const [SWITCH_X, , SWITCH_Z] = LIGHT_SWITCH_PLACEMENT.position;
/** 토글이 위아래로 젖혀지는 각도(라디안). */
const ROCKER_TILT = 0.42;

/**
 * 문 쪽 벽에 붙은 전등 스위치. 누르면 방 불이 꺼지고 다시 누르면 켜진다.
 *
 * 기억도 엔딩 트리거도 아니다. 눌러도 진행에는 아무 일이 없다. 기획의 배경
 * 오브젝트(docs/content-design.md 6-3)와 같은 성격이라, 수집 카운터에도
 * 잠금 규칙에도 끼지 않는다. 언제든 만질 수 있다.
 *
 * 한 번은 예외다. 새 게임은 불 꺼진 방의 1인칭에서 시작하고(인트로), 이 스위치를
 * 켜는 것이 그 구간의 유일한 할 일이다. 켜는 순간 스토어가 인트로를 마친 것으로
 * 적는다 (toggleLights). 그래서 꺼져 있을 때는 판에 표시등 하나가 켜진다. 어둠 속에서
 * 찾아야 하는 물건이 아무 빛도 없으면 찾는 게 아니라 헤매는 것이다.
 */
export function LightSwitch({ palette }: { palette: RoomPalette }) {
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  const toggleLights = useMemoryRoomStore((state) => state.toggleLights);
  const { hovered, handlers } = useGlowHover(true);
  // 표식을 달기엔 곁가지 물건이라, 다가간 사람에게만 빛으로 알린다.
  // 마우스가 없는 화면에서는 이게 스위치를 찾는 유일한 단서다.
  const near = useNearPlayer(SWITCH_X, SWITCH_Z, LIGHT_SWITCH_PLACEMENT.interactionRadius);
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
      {/* 인트로에서 유일하게 빛나는 물건. 어둠 속에서 이것만은 남아야 한다 */}
      <MemoryGlowSelection
        selectionKey="light-switch"
        tier="prop"
        enabled={hovered || near}
        inFirstPerson="keep"
      >
        {/* 벽에 붙는 판 */}
        <mesh castShadow>
          <boxGeometry args={plateSize} />
          <meshStandardMaterial color={palette.trim} roughness={0.6} />
        </mesh>
        {/* 표시등: 불이 꺼져 있을 때만 켜진다. 어둠 속에서 스위치 자리를 알리는 유일한 점 */}
        <mesh position={[0, -plateSize[1] / 2 + pilotSize[1], plateSize[2] / 2 + pilotSize[2] / 2]}>
          <boxGeometry args={pilotSize} />
          <meshStandardMaterial
            color={palette.memory}
            emissive={palette.memory}
            emissiveIntensity={lightsOn ? 0 : 1.6}
            roughness={0.4}
          />
        </mesh>
        {/* 젖혀지는 토글. 판 앞면에 얹혀 위아래로 기운다 */}
        <group ref={rockerRef} position={[0, 0, plateSize[2] / 2]}>
          <mesh position={[0, 0, rockerSize[2] / 2]}>
            <boxGeometry args={rockerSize} />
            <meshStandardMaterial color={palette.linen} roughness={0.45} />
          </mesh>
        </group>
      </MemoryGlowSelection>
    </group>
  );
}
