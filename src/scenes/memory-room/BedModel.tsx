import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import { MathUtils, type Mesh, MeshStandardMaterial } from "three";
import { ASSETS } from "@/lib/assets";
import { useMemoryRoomStore } from "@/store/memory-room";
import { BED_MATTRESS, BED_ORIGIN, BED_ROTATION_Y, BED_SCALE } from "./bed";
import type { RoomPalette } from "./palette";
import { usePlayerPosition } from "./use-near-player";
import { usePrefersReducedMotion } from "./use-seat";

useGLTF.preload(ASSETS.models.bed, true, true);

/**
 * 부품 노드 이름 → 팔레트 색. glb에는 재질이 없어(블렌더에서 안 입혔다) 여기서 입힌다.
 * 이름 규약은 bed.ts 머리 주석. 프레임 계열은 예전 상자 침대와 같은 잉크색, 매트리스는
 * 슬레이트, 베개는 종이색, 이불은 매트리스와 갈라 보이게 올리브.
 */
const PART_COLORS = {
  frame: "ink",
  base: "ink",
  headboard: "ink",
  footboard: "ink",
  mattress: "slate",
  pillow: "paper",
  blanket: "olive",
} as const satisfies Record<string, keyof RoomPalette>;
type BedPart = keyof typeof PART_COLORS;
const BED_PARTS = Object.keys(PART_COLORS) as readonly BedPart[];
/** 이름이 규약에 없는 메쉬 — 모델을 다시 내보내며 이름을 빠뜨렸을 때 눈에 띄게 매트리스색으로 둔다. */
const FALLBACK_PART: BedPart = "mattress";
/** 이불 shape key 이름 (블렌더 shape key 그대로). */
const FOLD_KEY = "folded";

/** 이불이 접히고 펴지는 속도. 걸어와서 걸터앉는 동안(1초 안팎) 다 접혀야 한다. */
const FOLD_LAMBDA = 3.5;
/** 모션을 끈 사람에게는 곧바로 (use-seat와 같은 값). */
const REDUCED_LAMBDA = 18;

interface BedModelProps {
  palette: RoomPalette;
  /** 모델이 붙은 뒤 한 번. 글로우 선택(MemoryGlowSelection)을 다시 훑게 하는 신호다. */
  onModelReady?: () => void;
}

function isBedPart(name: string): name is BedPart {
  return (BED_PARTS as readonly string[]).includes(name);
}

/**
 * 몸이 매트리스 위에 있는가. 걸터앉은 자리(perch)는 매트리스 왼쪽 변 바깥이라 여기 안
 * 든다 — 일어날 때 상체를 세워 가장자리에 앉은 다음에야 이불이 다시 펴진다. 누운 몸
 * 위로 이불이 펴지면 덮어 주는 게 아니라 뚫고 지나간다.
 */
function isOnMattress(position: { x: number; z: number }): boolean {
  return (
    position.x > BED_MATTRESS.minX &&
    position.x < BED_MATTRESS.maxX &&
    position.z > BED_MATTRESS.minZ &&
    position.z < BED_MATTRESS.maxZ
  );
}

function LoadedBed({ palette, onModelReady }: BedModelProps) {
  const { scene } = useGLTF(ASSETS.models.bed, true, true);
  const occupied = useMemoryRoomStore((state) => state.seatedAt === "bed");
  const playerPosition = usePlayerPosition();
  const reducedMotion = usePrefersReducedMotion();

  /*
   * 부품마다 팔레트색 재질을 새로 만든다 — 로더가 재질 없는 메쉬에 끼우는 기본 재질은
   * 흰색에 metalness 1이라 조명 아래서 검게 죽는다. 이불 메쉬는 shape key를 프레임마다
   * 움직여야 해서 같이 돌려준다 — ref에 담지 않는다. 개발 모드의 StrictMode는 useMemo를
   * 두 번 부르고 두 번째 결과를 버리는데, ref는 그 버려진 복제본을 가리키게 되어 화면에
   * 없는 이불만 접혔다.
   */
  const { cloned, materials, blanket } = useMemo(() => {
    const copy = scene.clone(true);
    const made = new Map<BedPart, MeshStandardMaterial>();
    const materialFor = (part: BedPart) => {
      let material = made.get(part);
      if (!material) {
        material = new MeshStandardMaterial({ color: palette[PART_COLORS[part]], roughness: 0.78 });
        material.name = part;
        made.set(part, material);
      }
      return material;
    };
    let blanketMesh: Mesh | null = null;
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = materialFor(isBedPart(mesh.name) ? mesh.name : FALLBACK_PART);
      if (mesh.name === "blanket") blanketMesh = mesh;
    });
    return { cloned: copy, materials: [...made.values()], blanket: blanketMesh as Mesh | null };
  }, [scene, palette]);

  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials],
  );

  // 글로우 선택은 마운트된 메쉬를 훑어 모은다 — 모델이 나중에 붙으면 다시 훑게 알린다.
  useEffect(() => {
    onModelReady?.();
  }, [onModelReady]);

  useFrame((_, delta) => {
    const influences = blanket?.morphTargetInfluences;
    const index = blanket?.morphTargetDictionary?.[FOLD_KEY];
    if (!influences || index === undefined) return;
    // 누르면 접히기 시작하고(걸어오는 동안 접힌다), 일어나 가장자리로 나온 뒤에야 펴진다.
    const folded = occupied || isOnMattress(playerPosition.current) ? 1 : 0;
    const lambda = reducedMotion ? REDUCED_LAMBDA : FOLD_LAMBDA;
    influences[index] = MathUtils.damp(influences[index], folded, lambda, delta);
  });

  return (
    <primitive
      object={cloned}
      position={[BED_ORIGIN.x, 0, BED_ORIGIN.z]}
      rotation={[0, BED_ROTATION_Y, 0]}
      scale={BED_SCALE}
    />
  );
}

/**
 * 침대 glb — 프레임·매트리스·베개·이불이 한 모델이다 (bed.ts).
 *
 * 침대를 누르면 이불이 발치로 접히고(shape key `folded`) 그 자리에 캐릭터가 눕는다.
 * 일어나면 도로 펴진다. 접힘의 목표값은 좌석 상태와 몸의 위치에서 나오고, 프레임마다
 * damp로 따라간다 — 이불은 무거워서 툭 접히지 않는다.
 *
 * Suspense 경계를 안에 두는 이유는 FurnitureModel과 같다 — 로딩 서스펜드가 글로우
 * 루트까지 올라가면 EffectComposer가 렌더러 없이 다시 붙는다.
 */
export function BedModel(props: BedModelProps) {
  return (
    <Suspense fallback={null}>
      <LoadedBed {...props} />
    </Suspense>
  );
}
