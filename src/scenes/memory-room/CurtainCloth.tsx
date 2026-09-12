import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { type RefObject, Suspense, useEffect, useMemo } from "react";
import { DoubleSide, type Mesh, MeshStandardMaterial } from "three";
import { ASSETS } from "@/lib/assets";
import { CURTAIN_OPEN_KEY } from "./curtain-model";
import type { CurtainSide } from "./curtain-motion";
import type { RoomPalette } from "./palette";

useGLTF.preload(ASSETS.models.curtain, true, true);

interface CurtainClothProps {
  side: CurtainSide;
  palette: Pick<RoomPalette, "fabric">;
  /** 마운트된 천 메쉬. Curtain이 프레임마다 shape key `open`의 influence를 써 준다. */
  meshRef: RefObject<Mesh | null>;
  /** 모델이 붙은 뒤 한 번. 글로우 선택(MemoryGlowSelection)을 다시 훑게 하는 신호다. */
  onReady?: () => void;
}

function LoadedCurtainCloth({ side, palette, meshRef, onReady }: CurtainClothProps) {
  const { scene } = useGLTF(ASSETS.models.curtain, true, true);

  /*
   * 파일의 그 쪽 메쉬를 복제해 팔레트 재질을 입힌다. glb에 재질이 없는 것은 침대와 같다
   * (로더의 기본 재질은 흰색에 metalness 1이라 조명 아래서 검게 죽는다). 복제본은 원본과
   * 지오메트리를 공유하지만 morph influence는 메쉬마다 따로 든다. ref에 담지 않고
   * 반환값으로 넘긴다 (r3f.md: useMemo 안에서 ref를 세팅하지 않는다).
   */
  const { mesh, material } = useMemo(() => {
    const source = scene.getObjectByName(side) as Mesh | undefined;
    if (!source?.isMesh) {
      throw new Error(`room-curtain.glb에 '${side}' 메쉬가 없다 (curtain-model.ts의 규약)`);
    }
    const cloth = source.clone();
    cloth.name = `curtain-cloth-${side}`;
    cloth.castShadow = false;
    cloth.receiveShadow = true;
    const fabric = new MeshStandardMaterial({
      color: palette.fabric,
      roughness: 0.98,
      metalness: 0,
      side: DoubleSide,
      // 머리단·밑단 음영은 COLOR_0으로 들어 있다. 없는 파일(블렌더 제작본)이면 켜지 않는다.
      vertexColors: cloth.geometry.hasAttribute("color"),
    });
    fabric.name = "fabric";
    cloth.material = fabric;
    // 닫힌 채로 붙는다. 실제 진행도는 Curtain의 useFrame이 첫 프레임부터 써 준다.
    const index = cloth.morphTargetDictionary?.[CURTAIN_OPEN_KEY];
    if (cloth.morphTargetInfluences && index !== undefined) cloth.morphTargetInfluences[index] = 0;
    return { mesh: cloth, material: fabric };
  }, [scene, side, palette]);

  useEffect(() => () => material.dispose(), [material]);

  // 글로우 선택은 마운트된 메쉬를 훑어 모은다. 모델이 나중에 붙으면 다시 훑게 알린다.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return <primitive object={mesh} ref={meshRef} />;
}

/**
 * 커튼 천 한 장 (room-curtain.glb의 `left` 또는 `right`).
 *
 * 여닫힘은 shape key `open` 하나다 (curtain-model.ts). 천을 옮기는 코드는 없고, Curtain이
 * 젖힘 진행도를 influence에 쓰면 천이 바깥쪽 끝에 뭉치며 창이 드러난다.
 *
 * Suspense 경계를 안에 두는 이유는 FurnitureModel과 같다. 로딩 서스펜드가 글로우
 * 루트까지 올라가면 EffectComposer가 렌더러 없이 다시 붙는다.
 */
export function CurtainCloth(props: CurtainClothProps) {
  return (
    <Suspense fallback={null}>
      <LoadedCurtainCloth {...props} />
    </Suspense>
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
