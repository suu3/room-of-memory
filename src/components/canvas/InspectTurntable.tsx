"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import { type RoomPalette, resolveRoomPalette } from "@/scenes/memory-room/palette";

/**
 * 집어 들고 돌려 보는 물건 (3D 인스펙트, v4.1 2장).
 *
 * 문제집(뒤표지의 이름)에서 시작한 조작을 한 컴포넌트로 모았다: 카드 뒷면의 엄마 메모,
 * 앰플 케이스 옆면의 빈 슬롯과 앰플 라벨의 로고, 거꾸로 꽂힌 책 뒤표지 안쪽의 "11",
 * 출입증 뒷면의 라온 로고. 물건마다 바뀌는 것은 모양·면 그림·찾을 면뿐이다
 * (src/components/canvas/inspect-objects.ts). "뒤집으면 보인다"가 페이즈마다 반복된다.
 *
 * 면 그림은 캔버스에 코드로 그린다. 글자가 언어를 따라야 해서다 (ko/en/ja). 그림 파일
 * (`image`)이 주어지면 불러오는 대로 그 위를 덮고, 없으면 코드 그림이 그대로 남는다.
 *
 * 찾을 면이 카메라를 향한 채 잠깐 머물면(`READ_SECONDS`) 발견으로 쳐서 `onFound`를
 * 한 번 부른다. 휙 지나간 건 못 본 것이다. 저 혼자 돌지 않는다: 돌리는 손이 있어야
 * 나오는 단서라서.
 */

/** 면 하나를 그리는 손. 캔버스 크기는 면의 비율을 따른다. */
export type FacePainter = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  palette: RoomPalette,
  font: string,
) => void;

export interface InspectFace {
  paint: FacePainter;
  /** 그림 파일 (public 기준). 오면 코드 그림을 덮는다. 없거나 못 불러오면 코드 그림 그대로. */
  image?: string;
}

export interface InspectObject {
  /** 상자는 판·책·카드, 원통은 앰플. */
  shape: "box" | "cylinder";
  /** 상자: [폭, 높이, 두께]. 원통: [지름, 높이, 지름]. */
  size: [number, number, number];
  /** 상자: 앞면(+z). 원통: 옆면 한 바퀴(띠). */
  front: InspectFace;
  /** 상자의 뒷면(-z). 원통은 쓰지 않는다. */
  back?: InspectFace;
  /** 상자의 오른쪽 옆면(+x). 앰플 케이스의 빈 슬롯 창이 여기 있다. */
  side?: InspectFace;
  /** 나머지 면(단면·뚜껑)의 색. */
  edge: keyof RoomPalette;
  /**
   * 찾을 면이 카메라를 향하는 회전각(y). 0이 앞면, π가 뒷면, -π/2가 오른쪽 옆면.
   * 원통은 띠의 한가운데(u=0.5)가 π에서 카메라를 본다.
   */
  foundYaw: number;
  /** 카메라에 선 채 처음 보이는 기울기(x). 살짝 내려다보면 판이 아니라 물건으로 읽힌다. */
  tilt?: number;
}

const CAMERA_Z = 2.3;
const CAMERA_FOV = 30;
/** 카메라가 한 화면에 담는 세로 길이 (월드). 확대했을 때 어디까지 옮길 수 있는지의 기준. */
const VIEW_HEIGHT = 2 * CAMERA_Z * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
/** 세로로 끈 픽셀을 월드 거리로. */
const DRAG_PX_TO_WORLD = 0.003;
const ZOOM_DAMP = 14;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.4;
/** 찾을 면을 마주 본 것으로 치는 기준: 목표각과의 차이의 cos가 이보다 크면 (±37° 안). */
const FACING_COS = 0.8;
/** 이만큼 마주 보고 있어야 읽은 것으로 친다(초). */
const READ_SECONDS = 0.35;
/** 면 그림의 긴 변 해상도. 손글씨가 또렷하려면 512는 있어야 한다. */
const FACE_RESOLUTION = 704;

/** 페이지의 글꼴을 그대로 쓴다: 방의 UI와 같은 Pretendard가 next/font로 이미 실려 있다. */
function bodyFont(): string {
  try {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

/** 면의 월드 치수 → 캔버스 크기 (긴 변을 FACE_RESOLUTION에 맞춘다). */
function canvasSize(worldWidth: number, worldHeight: number) {
  const scale = FACE_RESOLUTION / Math.max(worldWidth, worldHeight);
  return {
    width: Math.max(64, Math.round(worldWidth * scale)),
    height: Math.max(64, Math.round(worldHeight * scale)),
  };
}

/** 면 하나를 텍스처로. 그림 파일이 오면 같은 캔버스에 덮어 그린다. 언마운트 때 내려놓는다. */
function useFaceTexture(
  face: InspectFace | undefined,
  size: { width: number; height: number },
  palette: RoomPalette,
  font: string,
): CanvasTexture | null {
  const texture = useMemo(() => {
    if (!face) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ctx.fillRect === "function") face.paint(ctx, size, palette, font);
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    made.anisotropy = 4;
    return made;
  }, [face, size, palette, font]);

  useEffect(() => {
    if (!texture || !face?.image) return;
    const image = new Image();
    let alive = true;
    image.onload = () => {
      if (!alive) return;
      const canvas = texture.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
    };
    image.src = face.image;
    return () => {
      alive = false;
    };
  }, [texture, face]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function InspectedThing({
  object,
  yawRef,
  zoomRef,
  dragYRef,
  onFound,
}: {
  object: InspectObject;
  yawRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  dragYRef: MutableRefObject<number>;
  onFound: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const readRef = useRef(0);
  const foundRef = useRef(false);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const palette = useMemo(resolveRoomPalette, []);
  const font = useMemo(bodyFont, []);
  const [width, height, depth] = object.size;
  const cylinder = object.shape === "cylinder";

  const frontSize = useMemo(
    () => (cylinder ? canvasSize(Math.PI * width, height) : canvasSize(width, height)),
    [cylinder, width, height],
  );
  const sideSize = useMemo(() => canvasSize(depth, height), [depth, height]);
  const front = useFaceTexture(object.front, frontSize, palette, font);
  const back = useFaceTexture(object.back, frontSize, palette, font);
  const side = useFaceTexture(object.side, sideSize, palette, font);

  const materials = useMemo(() => {
    const edge = new MeshStandardMaterial({ color: palette[object.edge], roughness: 0.85 });
    const faceMaterial = (texture: CanvasTexture | null) =>
      texture ? new MeshStandardMaterial({ map: texture, roughness: 0.7 }) : edge;
    if (cylinder) {
      // CylinderGeometry의 재질 순서: 옆면, 윗뚜껑, 아랫뚜껑
      return [faceMaterial(front), edge, edge];
    }
    // BoxGeometry의 면 순서: +x, -x, +y, -y, +z(앞), -z(뒤)
    return [faceMaterial(side), edge, edge, edge, faceMaterial(front), faceMaterial(back)];
  }, [palette, object.edge, cylinder, front, back, side]);
  useEffect(
    () => () => {
      for (const material of new Set(materials)) material.dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const frame = frameRef.current;
    if (!group || !frame) return;
    group.rotation.y = yawRef.current;

    // 확대는 겉 그룹을 키운다. 화면 밖으로 나가는 만큼은 세로로 끌어 옮겨 본다
    const zoom = zoomRef.current;
    const overflow = Math.max(0, (height * zoom - VIEW_HEIGHT) / 2);
    const wanted = Math.max(-overflow, Math.min(overflow, -dragYRef.current * DRAG_PX_TO_WORLD));
    dragYRef.current = -wanted / DRAG_PX_TO_WORLD;
    const ease = 1 - Math.exp(-ZOOM_DAMP * delta);
    frame.scale.setScalar(frame.scale.x + (zoom - frame.scale.x) * ease);
    frame.position.y += (wanted - frame.position.y) * ease;

    if (foundRef.current) return;
    if (Math.cos(yawRef.current - object.foundYaw) > FACING_COS) {
      readRef.current += delta;
      if (readRef.current >= READ_SECONDS) {
        foundRef.current = true;
        onFoundRef.current();
      }
    } else {
      readRef.current = 0;
    }
  });

  return (
    <group ref={frameRef}>
      <group ref={groupRef}>
        <mesh material={materials}>
          {cylinder ? (
            <cylinderGeometry args={[width / 2, width / 2, height, 40]} />
          ) : (
            <boxGeometry args={object.size} />
          )}
        </mesh>
      </group>
    </group>
  );
}

export default function InspectTurntable({
  object,
  yawRef,
  zoomRef,
  dragYRef,
  onFound,
}: {
  object: InspectObject;
  /** 바깥(드래그·버튼)이 쥐고 있는 각도. */
  yawRef: MutableRefObject<number>;
  /** 확대 배율 (ZOOM_MIN~ZOOM_MAX). */
  zoomRef: MutableRefObject<number>;
  /** 세로로 끈 거리(px). 확대한 물건을 위아래로 옮겨 보는 데 쓴다. */
  dragYRef: MutableRefObject<number>;
  /** 찾을 면을 읽었을 때 한 번. */
  onFound: () => void;
}) {
  return (
    <Canvas
      // 손에 든 물건이라 방의 밤 조명이 아니라 밝은 실내 광으로 세운다
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} />
      <group rotation={[object.tilt ?? 0.16, 0, 0]}>
        <InspectedThing
          object={object}
          yawRef={yawRef}
          zoomRef={zoomRef}
          dragYRef={dragYRef}
          onFound={onFound}
        />
      </group>
    </Canvas>
  );
}
