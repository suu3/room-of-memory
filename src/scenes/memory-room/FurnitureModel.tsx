import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import { type Material, type Mesh, MeshStandardMaterial } from "three";
import { centerModelXZ } from "./model-utils";
import type { EulerTuple, Vec3Tuple } from "./types";

interface FurnitureModelProps {
  path: string;
  position: Vec3Tuple;
  rotation?: EulerTuple;
  /** 축마다 다르게 주면 납작하게 눌러 놓을 수 있다 (베개). */
  scale: number | Vec3Tuple;
}

/**
 * unlit(MeshBasicMaterial)로 들어온 재질을 같은 색의 조명 받는 재질로 바꾼다.
 * 가구킷 glb를 쓰는 쪽은 어디든 필요해서 내보낸다 — MemoryObjects의 컴퓨터도
 * 같은 킷이라 이걸 안 거치면 방이 어두워져도 혼자 원래 밝기로 떠 있는다.
 */
export function toLitMaterial(material: Material): Material {
  const source = material as Material & { color?: { getHex: () => number } };
  if (!source.color || material instanceof MeshStandardMaterial) return material.clone();
  const lit = new MeshStandardMaterial({
    color: source.color.getHex(),
    roughness: 0.78,
    metalness: 0,
  });
  lit.name = material.name;
  return lit;
}

function LoadedFurniture({ path, position, rotation, scale }: FurnitureModelProps) {
  const { scene } = useGLTF(path, true, true);

  /*
   * 가구킷 glb는 KHR_materials_unlit이라 GLTFLoader가 MeshBasicMaterial을 만든다.
   * 그대로 두면 방이 아무리 어두워져도 소품만 원래 밝기로 떠 있어서 붙여넣은 것처럼 보인다.
   * 색은 그대로 두고 조명 받는 재질로 갈아끼운다.
   */
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(toLitMaterial)
        : toLitMaterial(mesh.material);
    });
    return centerModelXZ(copy);
  }, [scene]);

  useEffect(
    () => () => {
      cloned.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
    },
    [cloned],
  );

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

/**
 * 방을 채우는 소품 glb 하나. 박스로 짜맞춘 프리미티브를 대체한다.
 *
 * 가구킷 모델은 밑면이 y=0에 맞춰져 있어서 놓을 자리의 윗면 높이를 그대로
 * position.y로 주면 된다.
 *
 * Suspense 경계를 컴포넌트 안에 둔다 — 이게 없으면 로딩 중 서스펜드가 부모인
 * MemoryGlowRoot까지 올라가서, 아웃라인 글로우의 EffectComposer가 렌더러 없이
 * 다시 붙었다가 addPass에서 터진다.
 */
export function FurnitureModel(props: FurnitureModelProps) {
  return (
    <Suspense fallback={null}>
      <LoadedFurniture {...props} />
    </Suspense>
  );
}
