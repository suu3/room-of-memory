import type {} from "@react-three/fiber";
import { type RefObject, useEffect, useMemo } from "react";
import { DoubleSide, type Mesh } from "three";
import { createCurtainCloth } from "./curtain-cloth";
import type { CurtainSide } from "./curtain-motion";
import type { RoomPalette } from "./palette";

export function CurtainCloth({
  side,
  palette,
  meshRef,
}: {
  side: CurtainSide;
  palette: Pick<RoomPalette, "fabric">;
  meshRef: RefObject<Mesh | null>;
}) {
  const geometry = useMemo(() => createCurtainCloth(side), [side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    // Mesh must receive geometry in its constructor to initialise morphTargetInfluences.
    <mesh ref={meshRef} name={`curtain-cloth-${side}`} args={[geometry]} receiveShadow>
      <meshStandardMaterial
        color={palette.fabric}
        roughness={0.98}
        metalness={0}
        side={DoubleSide}
        vertexColors
      />
    </mesh>
  );
}

export function CurtainRod({ palette }: { palette: RoomPalette }) {
  return (
    <group name="curtain-rod" position={[1.15, 3.98, -3.6]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 4.12, 10]} />
        <meshStandardMaterial color={palette.frame} roughness={0.7} />
      </mesh>
      {[-2.06, 2.06].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <sphereGeometry args={[0.054, 10, 8]} />
          <meshStandardMaterial color={palette.trim} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}
