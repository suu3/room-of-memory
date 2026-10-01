import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import { type Material, type Mesh, MeshStandardMaterial, type Texture } from "three";
import type { EulerTuple, Vec3Tuple } from "../world/types";
import { centerModelXZ } from "./model-utils";

interface FurnitureModelProps {
  path: string;
  position: Vec3Tuple;
  rotation?: EulerTuple;
  /** 축마다 다르게 주면 납작하게 눌러 놓을 수 있다 (베개). */
  scale: number | Vec3Tuple;
  /**
   * 재질 이름 → 팔레트 색. 러그처럼 런타임 팔레트를 따라야 하는 모델에 쓴다.
   * 이름이 없는 재질은 원색 그대로다. 텍스처가 있는 모델에 색을 곱하는 일은 없다.
   */
  materialColors?: Readonly<Record<string, string>>;
  /**
   * 표면에 곱하는 얼룩 텍스처 (docs/visual-experiments.md 5장 "컵라면 용기"). 재질의 기본색
   * 위에 곱해져 어두운 무늬가 앉는다. uv가 있는 메쉬에만 먹는다.
   */
  stainMap?: Texture | null;
}

/**
 * unlit(MeshBasicMaterial)로 들어온 재질을 같은 색의 조명 받는 재질로 바꾼다.
 * 비조명 재질이 들어와도 방 조명을 따르도록 한다. 자체 제작 모델의 StandardMaterial은
 * 복제만 한다. MemoryObjects의 컴퓨터도 같은 변환 경로를 쓴다.
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

/** 얼룩을 곱하는 셰이더 조각. map이 없는 재질에도 uv는 있어야 하므로 USE_UV를 강제한다. */
const STAIN_FRAGMENT = /* glsl */ `
  #include <map_fragment>
  #ifdef USE_UV
  diffuseColor.rgb *= texture2D(uStain, vUv).rgb;
  #endif
`;

function applyStain(material: Material, stain: Texture) {
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  standard.defines = { ...(standard.defines ?? {}), USE_UV: "" };
  standard.onBeforeCompile = (shader) => {
    shader.uniforms.uStain = { value: stain };
    shader.fragmentShader = `uniform sampler2D uStain;\n${shader.fragmentShader.replace(
      "#include <map_fragment>",
      STAIN_FRAGMENT,
    )}`;
  };
  standard.needsUpdate = true;
}

function LoadedFurniture({
  path,
  position,
  rotation,
  scale,
  materialColors,
  stainMap = null,
}: FurnitureModelProps) {
  const { scene } = useGLTF(path, true, true);

  /*
   * KHR_materials_unlit 모델은 GLTFLoader가 MeshBasicMaterial을 만든다.
   * 그대로 두면 방이 아무리 어두워져도 소품만 원래 밝기로 떠 있어서 붙여넣은 것처럼 보인다.
   * 색은 그대로 두고 조명 받는 재질로 갈아끼운다. materialColors에 이름이 있는 재질만
   * 팔레트 색으로 바꾼다.
   */
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    const remake = (material: Material) => {
      const lit = toLitMaterial(material);
      const override = materialColors?.[material.name];
      if (override && lit instanceof MeshStandardMaterial) lit.color.set(override);
      if (stainMap) applyStain(lit, stainMap);
      return lit;
    };
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(remake)
        : remake(mesh.material);
    });
    return centerModelXZ(copy);
  }, [scene, materialColors, stainMap]);

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
 * 소품 모델은 밑면이 y=0에 맞춰져 있어서 놓을 자리의 윗면 높이를 그대로
 * position.y로 주면 된다.
 *
 * Suspense 경계를 컴포넌트 안에 둔다. 이게 없으면 로딩 중 서스펜드가 부모인
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
