"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { SinkWater } from "@/scenes/memory-room/rooms/bathroom/SinkWater";
import { RIPPLE } from "@/scenes/memory-room/rooms/bathroom/water-ripple";
import { resolveRoomPalette } from "@/scenes/memory-room/world/palette";

/**
 * 세면대 고인 물의 단독 데모 (docs/direction/visual-experiments.md 11장 "굴절 · 파문 → 세면대의 물").
 *
 * 대야 하나(바닥판 + 테두리 넷)를 세우고 그 위에 게임과 같은 SinkWater를 얹는다. 버튼이
 * 열쇠를 집는 순간이다: `impactKey`를 하나 올리면 파문 하나가 번지고 배수구가 굴절로
 * 흔들리다 잔다. `intensity`가 진폭, `enabled`를 끄면 파문 없는 잔잔한 물(폴백)만 남는다.
 * 물은 1차·2차가 같다: `gamePhase` 토글은 여기서 아무것도 바꾸지 않는다.
 */
export function SinkWaterLab() {
  const palette = useMemo(resolveRoomPalette, []);
  const [impactKey, setImpactKey] = useState(0);

  return (
    <LabFrame
      title="세면대의 물 · 파문과 굴절"
      note="버튼이 열쇠를 집는 순간. 파문 하나가 번지며 배수구가 굴절로 흔들리다 잔다. intensity가 진폭, disabled는 잔잔한 물만."
    >
      {({ intensity, enabled }) => (
        <div className="space-y-3">
          <div className="relative h-96 w-full overflow-hidden rounded-xs border-2 border-night">
            <Canvas camera={{ position: [0.35, 1.25, 0.55], fov: 40 }} dpr={[1, 2]}>
              <color attach="background" args={[palette.deep]} />
              <ambientLight intensity={0.9} color={palette.daylight} />
              <directionalLight position={[1.2, 2.4, 1.6]} intensity={1.8} color={palette.sun} />
              <directionalLight
                position={[-1.5, 1.4, -1]}
                intensity={0.6}
                color={palette.daylight}
              />
              {/* 대야: BathroomFixtures의 Sink와 같은 치수 (바닥판 0.45×0.29, 테두리 넷) */}
              <group position={[0, 0, 0]}>
                <mesh position={[0, 0.7, 0]}>
                  <boxGeometry args={[0.8, 0.12, 0.46]} />
                  <meshStandardMaterial color={palette.linen} roughness={0.22} />
                </mesh>
                <mesh position={[0, 0.765, 0]}>
                  <boxGeometry args={[0.45, 0.018, 0.29]} />
                  <meshStandardMaterial color={palette.trim} roughness={0.3} />
                </mesh>
                {[-0.31, 0.31].map((x) => (
                  <mesh key={x} position={[x, 0.8, 0]}>
                    <boxGeometry args={[0.24, 0.1, 0.52]} />
                    <meshStandardMaterial color={palette.linen} roughness={0.2} />
                  </mesh>
                ))}
                {[-0.22, 0.22].map((z) => (
                  <mesh key={z} position={[0, 0.8, z]}>
                    <boxGeometry args={[0.44, 0.1, 0.08]} />
                    <meshStandardMaterial color={palette.linen} roughness={0.2} />
                  </mesh>
                ))}
                <mesh position={[0, 0.78, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.01, 24]} />
                  <meshStandardMaterial color={palette.frame} metalness={0.8} />
                </mesh>
                <SinkWater
                  palette={palette}
                  impactKey={impactKey}
                  intensity={intensity}
                  enabled={enabled}
                />
              </group>
              <OrbitControls target={[0, 0.78, 0]} maxPolarAngle={Math.PI / 2.2} />
            </Canvas>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-fog">
            <button
              type="button"
              className="rounded-sm border border-fog/30 px-3 py-1.5 text-sm text-ivory hover:border-memory focus-visible:outline-memory"
              onClick={() => setImpactKey((key) => key + 1)}
            >
              열쇠를 집는다 (파문)
            </button>
            <p>
              파문 {RIPPLE.duration}s · 파장 uv {((Math.PI * 2) / RIPPLE.waveNumber).toFixed(3)}
              {" · "}
              위상 속도 {(RIPPLE.angularSpeed / RIPPLE.waveNumber).toFixed(2)} uv/s · {impactKey}번
              번짐
            </p>
          </div>
        </div>
      )}
    </LabFrame>
  );
}
