"use client";

import { useGLTF } from "@react-three/drei";
import { forwardRef, Suspense, useEffect, useMemo } from "react";
import {
  type Group,
  type Material,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import { ASSETS } from "@/lib/assets";
import type { RoomPalette } from "./palette";

/** GLB 실측. 모델은 밑면이 y=0이고, Ampoule 컴포넌트는 기존처럼 가운데가 원점이다. */
export const AMPOULE_MODEL_HEIGHT = 0.199;
const GLASS_MATERIAL = "borosilicate-glass";

useGLTF.preload(ASSETS.models.ampoule, true, true);

interface AmpouleProps {
  palette: RoomPalette;
  /** 관 유리 재질. 글로우 세기를 밖에서 밀 때 잡는다. */
  glassRef?: React.RefObject<MeshStandardMaterial | null>;
  /** 가까이 들어 올렸을 때만 transmission을 유지한다. */
  refractive?: boolean;
}

function LoadedAmpoule({ palette, glassRef, refractive = false }: AmpouleProps) {
  const { scene } = useGLTF(ASSETS.models.ampoule, true, true);

  const { model, glass, materials } = useMemo(() => {
    const copy = scene.clone(true);
    const owned: Material[] = [];
    let glassMaterial: MeshStandardMaterial | null = null;

    const cloneMaterial = (source: Material) => {
      const material = source.clone();
      owned.push(material);
      if (material.name === GLASS_MATERIAL && material instanceof MeshStandardMaterial) {
        material.emissive.set(palette.memory);
        material.emissiveIntensity = 0;
        glassMaterial = material;
        if (!refractive && material instanceof MeshPhysicalMaterial) {
          material.transmission = 0;
          material.transparent = true;
          material.opacity = 0.4;
          material.depthWrite = false;
        }
      }
      return material;
    };

    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(cloneMaterial)
        : cloneMaterial(mesh.material);
    });

    if (!glassMaterial) {
      throw new Error(`${ASSETS.models.ampoule}에 '${GLASS_MATERIAL}' 재질이 없다`);
    }
    return { model: copy, glass: glassMaterial, materials: owned };
  }, [scene, palette.memory, refractive]);

  useEffect(() => {
    if (glassRef) glassRef.current = glass;
    return () => {
      if (glassRef?.current === glass) glassRef.current = null;
    };
  }, [glassRef, glass]);

  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials],
  );

  return <primitive object={model} position={[0, -AMPOULE_MODEL_HEIGHT / 2, 0]} />;
}

/**
 * 라온생명과학연구소 RX-11 앰플.
 *
 * 레퍼런스처럼 두꺼운 유리 바닥, 둥근 어깨, 좁은 목과 크림프 캡이 있는 바이알 GLB를
 * 쓴다. 서랍에서 집는 장면과 조사 화면이 같은 모델을 공유해 실루엣과 라벨이 어긋나지
 * 않는다. transmission은 카메라가 붙는 구간에서만 켜 렌더 비용을 제한한다.
 */
export const Ampoule = forwardRef<Group, AmpouleProps>(function Ampoule(props, ref) {
  return (
    <group ref={ref} name="ampoule">
      <Suspense fallback={null}>
        <LoadedAmpoule {...props} />
      </Suspense>
    </group>
  );
});
