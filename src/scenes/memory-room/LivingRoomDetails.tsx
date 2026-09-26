"use client";

import { RoundedBox, useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

useGLTF.preload(ASSETS.models.leafyPlant, true, true);
useGLTF.preload(ASSETS.models.books, true, true);

/** All tabletop details use their parent's unscaled furniture coordinates. */
export function Mug({
  palette,
  position,
  color = "linen",
}: {
  palette: RoomPalette;
  position: Vec3Tuple;
  color?: "linen" | "sage";
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.085, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.057, 0.17, 16]} />
        <meshStandardMaterial color={palette[color]} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.172, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.056, 16]} />
        <meshStandardMaterial color={palette.wood} roughness={0.45} />
      </mesh>
      <mesh position={[0.081, 0.094, 0]} castShadow>
        <torusGeometry args={[0.043, 0.012, 6, 12]} />
        <meshStandardMaterial color={palette[color]} roughness={0.42} />
      </mesh>
    </group>
  );
}

/** One remaining pair: shaped toes, soles, collars and laces replace clay blocks. */
export function LivingShoes({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-shoes">
      {([-15.62, -15.46] as const).map((x, index) => (
        <group
          key={x}
          // 신발장의 현관문 쪽(-z) 끝. 벗어 둔 자리는 문 앞이다
          position={[x, 0, index === 0 ? -1.4 : -1.48]}
          rotation={[0, index === 0 ? -0.12 : 0.1, 0]}
        >
          <RoundedBox
            args={[0.13, 0.027, 0.32]}
            radius={0.013}
            smoothness={2}
            position={[0, 0.014, 0]}
            castShadow
          >
            <meshStandardMaterial color={palette.linen} roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.049, 0.026]} scale={[0.061, 0.045, 0.126]} castShadow>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={palette.clay} roughness={0.9} />
          </mesh>
          <RoundedBox
            args={[0.112, 0.092, 0.12]}
            radius={0.024}
            smoothness={2}
            position={[0, 0.066, -0.083]}
            castShadow
          >
            <meshStandardMaterial color={palette.clay} roughness={0.9} />
          </RoundedBox>
          <mesh position={[0, 0.113, -0.085]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.75, 1, 1]}>
            <circleGeometry args={[0.04, 12]} />
            <meshStandardMaterial color={palette.frame} roughness={0.9} />
          </mesh>
          {[-0.027, -0.005, 0.017].map((z) => (
            <mesh key={z} position={[0, 0.093, z]}>
              <boxGeometry args={[0.066, 0.005, 0.008]} />
              <meshStandardMaterial color={palette.linen} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function SofaDetails({ palette }: { palette: RoomPalette }) {
  return (
    <group name="sofa-details">
      {[-10.42, -8.56].map((x, i) => (
        <RoundedBox
          key={x}
          args={[0.38, 0.36, 0.16]}
          radius={0.065}
          smoothness={2}
          position={[x, 0.79, -3.4]}
          rotation={[-0.18, 0, i ? -0.16 : 0.16]}
          castShadow
        >
          <meshStandardMaterial color={i ? palette.sage : palette.clay} roughness={1} />
        </RoundedBox>
      ))}
      {/* A cloth over the armrest, away from the three seat surfaces. */}
      <RoundedBox
        args={[0.31, 0.035, 0.62]}
        radius={0.015}
        smoothness={2}
        position={[-8.23, 0.957, -3.12]}
        castShadow
      >
        <meshStandardMaterial color={palette.linen} roughness={1} />
      </RoundedBox>
      <RoundedBox
        args={[0.025, 0.38, 0.62]}
        radius={0.01}
        smoothness={2}
        position={[-8.088, 0.77, -3.12]}
        castShadow
      >
        <meshStandardMaterial color={palette.linen} roughness={1} />
      </RoundedBox>
    </group>
  );
}

export function DiningDetails({ palette }: { palette: RoomPalette }) {
  return (
    <group name="dining-details">
      <Mug palette={palette} position={[-14.3, 0.978, 4.12]} />
      <Mug palette={palette} position={[-13.35, 0.978, 4.18]} color="sage" />
      <mesh position={[-14.31, 0.982, 3.52]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.14, 0.012, 20]} />
        <meshStandardMaterial color={palette.linen} roughness={0.6} />
      </mesh>
      <FurnitureModel
        path={ASSETS.models.books}
        position={[-13.32, 0.978, 3.27]}
        scale={1.9}
        rotation={[0, 0.15, 0]}
      />
    </group>
  );
}

export function LivingRoomDetails({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-room-details">
      {/* Low woven runner: no new obstacle in the walking area. */}
      <FurnitureModel
        path={ASSETS.models.rug}
        position={[-9.5, 0.004, -0.6]}
        scale={[2.2, 1, 1.8]}
      />
      <FurnitureModel
        path={ASSETS.models.leafyPlant}
        position={[-10.57, 0.503, 6.2]}
        scale={0.95}
      />
      <FurnitureModel path={ASSETS.models.books} position={[-8.68, 0.503, 6.13]} scale={1.5} />
      {/* Remote with a power button and a directional pad, resting on the console. */}
      <group position={[-8.64, 0.664, 6.13]} rotation={[0, -0.2, 0]}>
        <RoundedBox args={[0.072, 0.025, 0.2]} radius={0.009} smoothness={2} castShadow>
          <meshStandardMaterial color={palette.frame} roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0.015, -0.06]}>
          <cylinderGeometry args={[0.01, 0.01, 0.005, 8]} />
          <meshStandardMaterial color={palette.clay} />
        </mesh>
        <mesh position={[0, 0.015, -0.012]}>
          <cylinderGeometry args={[0.019, 0.019, 0.005, 12]} />
          <meshStandardMaterial color={palette.trim} />
        </mesh>
      </group>
    </group>
  );
}
