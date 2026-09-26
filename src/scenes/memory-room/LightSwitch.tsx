"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshStandardMaterial, PointLight } from "three";
import { MathUtils } from "three";
import { playSound } from "@/lib/audio";
import { selectViewpoint, useMemoryRoomStore } from "@/store/memory-room";
import { LIGHT_SWITCH_PLACEMENT } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import { SpaceLight } from "./SpaceLight";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

const { plateSize, rockerSize, pilotSize } = LIGHT_SWITCH_PLACEMENT;
const [SWITCH_X, , SWITCH_Z] = LIGHT_SWITCH_PLACEMENT.position;
/** 토글이 위아래로 젖혀지는 각도(라디안). */
const ROCKER_TILT = 0.42;
/**
 * 인트로의 표시등. 소등한 방의 표시등은 점 하나지만, 인트로에서는 이걸 **찾아야**
 * 하므로 조금 더 세다: 숨 쉬듯 맥동하고(주기 1.6초), 벽 한 뼘을 물들이는 점광원을 단다.
 * 스위치를 켜면 둘 다 꺼진다. 처음 값(2.4+1.4, 점광원 1.4)은 어둠 속에서 눈이 부셨다.
 * 찾을 수 있을 만큼만 남긴다.
 */
const PILOT = { base: 1.6, introBase: 1.3, introSwing: 0.5, periodS: 1.6 } as const;
const PILOT_LIGHT = { intensity: 0.45, distance: 2.6, decay: 2 } as const;

/**
 * 문 쪽 벽에 붙은 전등 스위치. 누르면 방 불이 꺼지고 다시 누르면 켜진다.
 *
 * 기억도 엔딩 트리거도 아니다. 눌러도 진행에는 아무 일이 없다. 기획의 배경
 * 오브젝트(docs/content-design.md 6-3)와 같은 성격이라, 수집 카운터에도
 * 잠금 규칙에도 끼지 않는다. 언제든 만질 수 있다.
 *
 * 한 번은 예외다. 새 게임은 불 꺼진 방의 1인칭에서 시작하고(인트로), 이 스위치를
 * 켜는 것이 그 구간의 유일한 할 일이다. 켜는 순간 스토어가 인트로를 마친 것으로
 * 적는다 (toggleLights). 그래서 인트로 동안은 기억처럼 빛난다: 금빛 윤곽과 헤일로,
 * 맥동하는 표시등, 벽을 물들이는 점광원. 어둠 속에서 찾아야 하는 물건이 아무 빛도
 * 없으면 찾는 게 아니라 헤매는 것이다. 평소 소등 때는 표시등 점 하나만 남는다.
 */
export function LightSwitch({ palette }: { palette: RoomPalette }) {
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  const toggleLights = useMemoryRoomStore((state) => state.toggleLights);
  const intro = useMemoryRoomStore(selectViewpoint) === "intro";
  const { hovered, handlers } = useGlowHover(true);
  // 표식을 달기엔 곁가지 물건이라, 다가간 사람에게만 빛으로 알린다.
  // 마우스가 없는 화면에서는 이게 스위치를 찾는 유일한 단서다.
  const near = useNearPlayer(SWITCH_X, SWITCH_Z, LIGHT_SWITCH_PLACEMENT.interactionRadius);
  const rockerRef = useRef<Group>(null);
  const pilotRef = useRef<MeshStandardMaterial>(null);
  const pilotLightRef = useRef<PointLight>(null);

  // 토글은 각도만 오가므로 setState 없이 ref를 민다 (.claude/rules/r3f.md)
  useFrame((state, delta) => {
    const rocker = rockerRef.current;
    if (rocker) {
      rocker.rotation.x = MathUtils.damp(
        rocker.rotation.x,
        lightsOn ? -ROCKER_TILT : ROCKER_TILT,
        18,
        delta,
      );
    }
    const pilot = pilotRef.current;
    const pilotLight = pilotLightRef.current;
    if (!pilot || !pilotLight) return;
    if (lightsOn) {
      pilot.emissiveIntensity = MathUtils.damp(pilot.emissiveIntensity, 0, 12, delta);
      pilotLight.intensity = MathUtils.damp(pilotLight.intensity, 0, 12, delta);
      return;
    }
    const breath = intro
      ? PILOT.introBase +
        PILOT.introSwing *
          (0.5 + 0.5 * Math.sin((state.clock.elapsedTime / PILOT.periodS) * Math.PI * 2))
      : PILOT.base;
    pilot.emissiveIntensity = MathUtils.damp(pilot.emissiveIntensity, breath, 8, delta);
    pilotLight.intensity = MathUtils.damp(
      pilotLight.intensity,
      intro ? PILOT_LIGHT.intensity * (breath / (PILOT.introBase + PILOT.introSwing)) : 0,
      8,
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
      {/*
        인트로에서 유일하게 빛나는 물건. 어둠 속에서 이것만은 남아야 한다. 그동안은
        기억 등급(헤일로 + 벽 너머 투과)이라 돌아서기만 하면 눈에 든다. 평소엔 곁가지 등급.
      */}
      <MemoryGlowSelection
        selectionKey="light-switch"
        tier={intro ? "memory" : "prop"}
        enabled={intro || hovered || near}
        inFirstPerson="keep"
      >
        {/* 벽에 붙는 판 */}
        <mesh castShadow>
          <boxGeometry args={plateSize} />
          <meshStandardMaterial color={palette.trim} roughness={0.6} />
        </mesh>
        {/* 표시등: 불이 꺼져 있을 때만 켜진다. 어둠 속에서 스위치 자리를 알리는 점 */}
        <mesh position={[0, -plateSize[1] / 2 + pilotSize[1], plateSize[2] / 2 + pilotSize[2] / 2]}>
          <boxGeometry args={pilotSize} />
          <meshStandardMaterial
            ref={pilotRef}
            color={palette.memory}
            emissive={palette.memory}
            emissiveIntensity={lightsOn ? 0 : PILOT.base}
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
      {/* 표시등이 벽에 번지는 빛. 인트로에서만 세기가 붙는다 */}
      <SpaceLight
        ref={pilotLightRef}
        position={[0, 0, 0.12]}
        color={palette.memory}
        intensity={0}
        distance={PILOT_LIGHT.distance}
        decay={PILOT_LIGHT.decay}
      />
    </group>
  );
}
