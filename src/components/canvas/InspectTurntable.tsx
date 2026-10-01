"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  ExtrudeGeometry,
  type Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
} from "three";
import { composeStill } from "@/lib/still-capture";
import { AMPOULE_MODEL_HEIGHT, Ampoule } from "@/scenes/memory-room/memory/Ampoule";
import { type RoomPalette, resolveRoomPalette } from "@/scenes/memory-room/world/palette";
import { InspectBook } from "./InspectBook";
import { InspectFoldedNote } from "./InspectFoldedNote";
import {
  clampPitchDrag,
  HOLOGRAM_READ,
  type HologramSpot,
  hologramVisibility,
  INSPECT_CAMERA,
  pitchFromDrag,
  ReadTimer,
  SHADOW_GAP,
  VIEW_HEIGHT,
  ZOOM_DAMP,
} from "./inspect-math";
import {
  bodyFont,
  canvasSize,
  type FacePainter,
  type InspectFace,
  useFaceTexture,
} from "./inspect-textures";

export type { FacePainter, InspectFace } from "./inspect-textures";

/**
 * 집어 들고 살펴보는 물건 (3D 인스펙트, v4.1 2장).
 *
 * 문제집(뒤표지의 이름)에서 시작한 판이다. 처음엔 물건마다 모양·면 그림·찾을 면만 갈라
 * "뒤집으면 보인다"를 페이즈마다 되풀이했는데, 같은 트릭이 넷이면 셋은 답을 아는 채로
 * 돌리는 일이 된다. 그래서 손이 하는 일을 물건마다 갈랐다 (`InspectControl`):
 *
 *   turn    돌려서 다른 면을 본다 (문제집 · 앰플 케이스 · 앰플)
 *   tilt    기울여 빛에 비춘다: 출입증의 홀로그램은 한 각도에서만 떠오른다
 *   unfold  위로 끌어 접힌 것을 편다: 식탁 쪽지 (InspectFoldedNote)
 *   pages   장을 넘긴다: 거꾸로 꽂힌 책, 귀 접힌 쪽에 "11" (InspectBook)
 *
 * 면 그림은 코드로 그리고 그림 파일이 오면 덮는다 (inspect-textures). 찾을 것을 잠깐
 * 마주 보고 있어야(READ_SECONDS) 발견으로 쳐서 `onFound`를 한 번 부른다. 저 혼자 돌지
 * 않는다: 돌리는 손이 있어야 나오는 단서라서.
 */

/** 물건마다 손이 하는 일. InspectView가 끌기·버튼을 이걸로 해석한다. */
export type InspectControl =
  | { kind: "turn" }
  | { kind: "tilt" }
  | { kind: "unfold" }
  | { kind: "pages"; sheets: number };

/** 앞면에 붙은 홀로그램 씰. 어느 각도에서나 무지갯빛 결은 비치지만 로고는 `spot`에서만 선다. */
interface InspectHologram {
  /** 로고 그림. 투명 바탕 위에 그린다: 그 밖은 씰의 결이 비친다. */
  paint: FacePainter;
  /** 앞면에서 차지하는 자리 (면 크기 비율, 왼쪽 위 원점). */
  rect: { x: number; y: number; width: number; height: number };
  /** 로고가 떠오르는 각도. */
  spot: HologramSpot;
}

interface PrimitiveInspectObject {
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
   * 원통은 띠의 한가운데(u=0.5)가 π에서 카메라를 본다. `hologram`이 있으면 안 쓴다:
   * 찾는 것이 면이 아니라 각도다.
   */
  foundYaw: number;
  /** 카메라에 선 채 처음 보이는 기울기(x). 살짝 내려다보면 판이 아니라 물건으로 읽힌다. */
  tilt?: number;
  /**
   * 상자의 앞뒤 면 네 귀를 둥글린다 (월드 반지름). 출입증처럼 귀가 둥근 그림을
   * 네모난 판에 붙이면 귀퉁이의 바탕이 비치므로, 판 자체를 그림의 귀에 맞춰 깎는다.
   * 둥글린 상자는 옆면(`side`) 그림을 쓰지 않는다: 둘레가 하나의 테(`edge` 색)다.
   */
  cornerRadius?: number;
  /** 앞면의 홀로그램 씰. 있으면 손은 `tilt`가 된다: 세로 끌기가 기울이기다. */
  hologram?: InspectHologram;
}

interface ModelInspectObject {
  /** 공용 GLB 소품. 현재는 서랍의 앰플과 같은 모델 하나만 쓴다. */
  shape: "model";
  model: "ampoule";
  /** 회전 조사 화면에서 차지할 [폭, 높이, 깊이]. */
  size: [number, number, number];
  foundYaw: number;
  tilt?: number;
}

/** 반으로 접힌 종이. 위로 끌면 윗반이 접힌 자국을 축으로 펴진다. 펴진 안쪽이 찾을 것. */
export interface FoldedNoteInspectObject {
  shape: "folded-note";
  /** 펼쳤을 때의 [폭, 높이, 두께]. */
  size: [number, number, number];
  /** 겉면 (빈 종이). */
  paper: FacePainter;
  /** 안쪽 (메모). 펼친 종이 전체에 그린다: 윗반은 접히는 쪽에, 아랫반은 바닥 쪽에 붙는다. */
  memo: FacePainter;
  tilt?: number;
}

/**
 * 장을 넘기는 책. `pages`는 낱장의 앞·뒤를 번갈아 담는다 (짝수 = 오른쪽에 보이는 앞면,
 * 홀수 = 넘긴 뒤 왼쪽에 남는 뒷면). 0번이 앞표지다: 처음엔 덮인 채로 놓인다.
 */
export interface BookInspectObject {
  shape: "book";
  /** 한 쪽의 [폭, 높이], 그리고 표지 두께. */
  size: [number, number, number];
  /** 뒤표지·책등의 색. */
  cover: keyof RoomPalette;
  pages: readonly InspectFace[];
  /** 찾을 쪽 (`pages` 인덱스). */
  target: number;
  tilt?: number;
}

export type InspectObject =
  | PrimitiveInspectObject
  | ModelInspectObject
  | FoldedNoteInspectObject
  | BookInspectObject;

/** 이 물건에 손이 하는 일. */
export function inspectControlOf(object: InspectObject): InspectControl {
  switch (object.shape) {
    case "folded-note":
      return { kind: "unfold" };
    case "book":
      return { kind: "pages", sheets: object.pages.length / 2 };
    case "box":
      return object.hologram ? { kind: "tilt" } : { kind: "turn" };
    default:
      return { kind: "turn" };
  }
}

/** 세로로 끈 픽셀을 월드 거리로. */
const DRAG_PX_TO_WORLD = 0.003;
/** 찾을 면을 마주 본 것으로 치는 기준: 목표각과의 차이의 cos가 이보다 크면 (±37° 안). */
const FACING_COS = 0.8;
/** 씰의 결(무지갯빛 띠)이 늘 비치는 정도. 로고가 없을 때도 "여기 뭔가 있다"고 말한다. */
const SHEEN_OPACITY = 0.3;

/** 귀가 둥근 사각형 윤곽 (가운데가 원점). */
function roundedRectShape(width: number, height: number, radius: number): Shape {
  const x = width / 2;
  const y = height / 2;
  const r = Math.min(radius, x, y);
  const shape = new Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  return shape;
}

/**
 * 귀가 둥근 판: 앞뒤 면이 같이 쓰는 평면 하나와 두께를 두르는 테.
 * 평면의 uv는 판 전체를 0~1로 편다 (상자 면과 같은 그림이 같은 자리에 붙게).
 */
function roundedSlabGeometry(width: number, height: number, depth: number, radius: number) {
  const shape = roundedRectShape(width, height, radius);
  const face = new ShapeGeometry(shape, 8);
  const position = face.getAttribute("position");
  const uv = face.getAttribute("uv");
  for (let index = 0; index < position.count; index++) {
    uv.setXY(
      index,
      (position.getX(index) + width / 2) / width,
      (position.getY(index) + height / 2) / height,
    );
  }
  uv.needsUpdate = true;
  // 두께만 두른다: 뚜껑은 앞뒤 평면이 맡으니 테 쪽 그룹(1)만 남긴다
  const rim = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
  rim.translate(0, 0, -depth / 2);
  const sides = rim.groups.find((group) => group.materialIndex === 1);
  rim.clearGroups();
  if (sides) rim.addGroup(sides.start, sides.count, 0);
  return { face, rim };
}

/**
 * 홀로그램 씰의 결: 팔레트의 색 넷이 비스듬한 띠로 이어진 무지개. 기울기에 따라 띠가
 * 흘러가도록 텍스처의 offset만 움직인다 (RepeatWrapping). 실제 씰이 그렇듯 색은 옅고
 * 결만 보인다.
 */
function sheenTexture(palette: RoomPalette): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx && typeof ctx.createLinearGradient === "function") {
    const gradient = ctx.createLinearGradient(0, 0, 256, 64);
    const stops = [palette.daylight, palette.memory, palette.sage, palette.ember, palette.daylight];
    stops.forEach((color, index) => {
      gradient.addColorStop(index / (stops.length - 1), color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/** 출입증 앞면에 붙는 씰: 결 한 겹 위에 로고 한 겹. 각도에 따라 로고의 불투명도만 바뀐다. */
function HologramSeal({
  hologram,
  size,
  palette,
  font,
  logoRef,
  sheenRef,
}: {
  hologram: InspectHologram;
  size: [number, number, number];
  palette: RoomPalette;
  font: string;
  logoRef: MutableRefObject<MeshBasicMaterial | null>;
  sheenRef: MutableRefObject<CanvasTexture | null>;
}) {
  const [width, height, depth] = size;
  const { rect } = hologram;
  const sealWidth = rect.width * width;
  const sealHeight = rect.height * height;
  const logoFace = useMemo<InspectFace>(() => ({ paint: hologram.paint }), [hologram.paint]);
  const logoSize = useMemo(() => canvasSize(sealWidth, sealHeight, 512), [sealWidth, sealHeight]);
  const logo = useFaceTexture(logoFace, logoSize, palette, font);
  const sheen = useMemo(() => sheenTexture(palette), [palette]);
  useEffect(() => {
    sheenRef.current = sheen;
    return () => {
      sheenRef.current = null;
      sheen.dispose();
    };
  }, [sheen, sheenRef]);
  const materials = useMemo(() => {
    const sheenMaterial = new MeshBasicMaterial({
      map: sheen,
      transparent: true,
      opacity: SHEEN_OPACITY,
      depthWrite: false,
    });
    const logoMaterial = new MeshBasicMaterial({
      map: logo,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return { sheen: sheenMaterial, logo: logoMaterial };
  }, [sheen, logo]);
  useEffect(() => {
    logoRef.current = materials.logo;
    return () => {
      logoRef.current = null;
      materials.sheen.dispose();
      materials.logo.dispose();
    };
  }, [materials, logoRef]);

  // 면 그림의 왼쪽 위(0,0)가 판의 (-w/2, +h/2)다
  const x = (rect.x + rect.width / 2 - 0.5) * width;
  const y = (0.5 - rect.y - rect.height / 2) * height;
  return (
    <>
      <mesh material={materials.sheen} position={[x, y, depth / 2 + 0.002]}>
        <planeGeometry args={[sealWidth, sealHeight]} />
      </mesh>
      <mesh material={materials.logo} position={[x, y, depth / 2 + 0.004]}>
        <planeGeometry args={[sealWidth, sealHeight]} />
      </mesh>
    </>
  );
}

function InspectedThing({
  object,
  yawRef,
  zoomRef,
  dragYRef,
  onFound,
  palette,
  font,
}: {
  object: PrimitiveInspectObject | ModelInspectObject;
  yawRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  dragYRef: MutableRefObject<number>;
  onFound: () => void;
  palette: RoomPalette;
  font: string;
}) {
  const groupRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const readRef = useRef(new ReadTimer());
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const logoRef = useRef<MeshBasicMaterial | null>(null);
  const sheenRef = useRef<CanvasTexture | null>(null);
  const [width, height, depth] = object.size;
  const cylinder = object.shape === "cylinder";
  const modeled = object.shape === "model";
  const hologram = object.shape === "box" ? object.hologram : undefined;

  const frontSize = useMemo(
    () => (cylinder ? canvasSize(Math.PI * width, height) : canvasSize(width, height)),
    [cylinder, width, height],
  );
  const sideSize = useMemo(() => canvasSize(depth, height), [depth, height]);
  const front = useFaceTexture(modeled ? undefined : object.front, frontSize, palette, font);
  const back = useFaceTexture(modeled ? undefined : object.back, frontSize, palette, font);
  const side = useFaceTexture(modeled ? undefined : object.side, sideSize, palette, font);

  const materials = useMemo(() => {
    if (modeled) return [];
    const edge = new MeshStandardMaterial({ color: palette[object.edge], roughness: 0.85 });
    const faceMaterial = (texture: CanvasTexture | null) =>
      texture ? new MeshStandardMaterial({ map: texture, roughness: 0.7 }) : edge;
    if (cylinder) {
      // CylinderGeometry의 재질 순서: 옆면, 윗뚜껑, 아랫뚜껑
      return [faceMaterial(front), edge, edge];
    }
    // BoxGeometry의 면 순서: +x, -x, +y, -y, +z(앞), -z(뒤)
    return [faceMaterial(side), edge, edge, edge, faceMaterial(front), faceMaterial(back)];
  }, [palette, object, modeled, cylinder, front, back, side]);
  useEffect(
    () => () => {
      for (const material of new Set(materials)) material.dispose();
    },
    [materials],
  );

  const cornerRadius = object.shape === "box" ? object.cornerRadius : undefined;
  const slab = useMemo(
    () => (cornerRadius ? roundedSlabGeometry(width, height, depth, cornerRadius) : null),
    [width, height, depth, cornerRadius],
  );
  useEffect(
    () => () => {
      slab?.face.dispose();
      slab?.rim.dispose();
    },
    [slab],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const frame = frameRef.current;
    if (!group || !frame) return;
    const ease = 1 - Math.exp(-ZOOM_DAMP * delta);
    const zoom = zoomRef.current;
    frame.scale.setScalar(frame.scale.x + (zoom - frame.scale.x) * ease);

    if (hologram) {
      /*
       * 기울이기: 세로 끌기가 판을 눕히고 세운다. 돌린 뒤에 기울여야 하므로(YXZ)
       * 순서를 못박는다. 씰의 결은 각도 따라 흘러가고, 로고는 빛을 받는 한 점 근처에서만
       * 떠오른다 (hologramVisibility). 확대해도 옮기지는 않는다: 세로 끌기는 기울기의 몫이다.
       */
      dragYRef.current = clampPitchDrag(dragYRef.current);
      const pitch = pitchFromDrag(dragYRef.current);
      group.rotation.order = "YXZ";
      group.rotation.set(pitch, yawRef.current, 0);
      frame.position.y += (0 - frame.position.y) * ease;
      const visible = hologramVisibility(pitch, yawRef.current, hologram.spot);
      if (logoRef.current) logoRef.current.opacity = visible;
      if (sheenRef.current) sheenRef.current.offset.set(pitch * 0.9 + yawRef.current * 0.4, 0);
      if (readRef.current.tick(visible > HOLOGRAM_READ, delta)) onFoundRef.current();
      return;
    }

    group.rotation.y = yawRef.current;
    // 확대는 겉 그룹을 키운다. 화면 밖으로 나가는 만큼은 세로로 끌어 옮겨 본다
    const overflow = Math.max(0, (height * zoom - VIEW_HEIGHT) / 2);
    const wanted = Math.max(-overflow, Math.min(overflow, -dragYRef.current * DRAG_PX_TO_WORLD));
    dragYRef.current = -wanted / DRAG_PX_TO_WORLD;
    frame.position.y += (wanted - frame.position.y) * ease;

    const facing = Math.cos(yawRef.current - object.foundYaw) > FACING_COS;
    if (readRef.current.tick(facing, delta)) onFoundRef.current();
  });

  return (
    <group ref={frameRef}>
      {/* 발밑 그림자: 확대·세로 이동을 물건과 함께 따라가도록 frame 안에 둔다 */}
      <ContactShadows
        position={[0, -height / 2 - SHADOW_GAP, 0]}
        opacity={0.75}
        scale={Math.max(width, depth) * 3.2}
        blur={2.4}
        far={height}
      />
      <group ref={groupRef}>
        {modeled ? (
          <group scale={height / AMPOULE_MODEL_HEIGHT}>
            <Ampoule palette={palette} refractive />
          </group>
        ) : slab ? (
          // 상자 재질 순서(+x, -x, +y, -y, +z, -z)를 그대로 빌린다: 4가 앞면, 5가 뒷면, 1이 테
          <>
            <mesh geometry={slab.face} material={materials[4]} position={[0, 0, depth / 2]} />
            <mesh
              geometry={slab.face}
              material={materials[5]}
              position={[0, 0, -depth / 2]}
              rotation={[0, Math.PI, 0]}
            />
            <mesh geometry={slab.rim} material={[materials[1]]} />
          </>
        ) : (
          <mesh material={materials}>
            {cylinder ? (
              <cylinderGeometry args={[width / 2, width / 2, height, 40]} />
            ) : (
              <boxGeometry args={object.size} />
            )}
          </mesh>
        )}
        {hologram && (
          <HologramSeal
            hologram={hologram}
            size={object.size}
            palette={palette}
            font={font}
            logoRef={logoRef}
            sheenRef={sheenRef}
          />
        )}
      </group>
    </group>
  );
}

/** 지금 판을 한 장으로 찍는 함수. 판이 떠 있지 않으면 null. */
export type InspectCapture = () => string | null;

/**
 * 판을 찍는 손잡이를 바깥에 건넨다. 찍는 순간 한 번 더 그려 버퍼를 채운 뒤 곧장 읽는다:
 * preserveDrawingBuffer를 켜면 매 프레임 비용이 들고, 찍는 일은 조사 한 번에 한 번뿐이다.
 */
function CaptureBridge({ captureRef }: { captureRef: MutableRefObject<InspectCapture | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera);
      return composeStill(gl.domElement);
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, gl, scene, camera]);
  return null;
}

export default function InspectTurntable({
  object,
  yawRef,
  zoomRef,
  dragYRef,
  pageRef,
  onFound,
  captureRef,
}: {
  object: InspectObject;
  /** 바깥(드래그·버튼)이 쥐고 있는 각도. */
  yawRef: MutableRefObject<number>;
  /** 확대 배율 (ZOOM_MIN~ZOOM_MAX). */
  zoomRef: MutableRefObject<number>;
  /**
   * 세로로 끈 거리(px). 손이 하는 일에 따라 뜻이 다르다: 돌리기(turn)는 확대한 물건을
   * 위아래로 옮기고, 기울이기(tilt)는 판을 눕히고, 펼치기(unfold)는 접힌 것을 편다.
   */
  dragYRef: MutableRefObject<number>;
  /** 넘긴 장 수 (책만). */
  pageRef?: MutableRefObject<number>;
  /** 찾을 것을 읽었을 때 한 번. */
  onFound: () => void;
  /** 있으면 판을 찍는 함수가 여기 걸린다 (결과 대사·수첩 카드의 정지 그림). */
  captureRef?: MutableRefObject<InspectCapture | null>;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  const font = useMemo(bodyFont, []);
  return (
    <Canvas
      camera={{ position: [0, 0, INSPECT_CAMERA.z], fov: INSPECT_CAMERA.fov }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      {captureRef && <CaptureBridge captureRef={captureRef} />}
      {/*
       * 어두운 무대 위의 물건 (배경은 DOM의 .inspect-stage). 고르게 밝히던 실내 광을 걷고
       * 앞 위의 핀 조명 하나로 세운다: 찾을 면은 늘 카메라 쪽이라 글씨는 그대로 읽힌다.
       * 뒤에서 기억 빛(memory)이 윤곽을 따라 금테를 두르고, 발밑 그림자가 바닥을 만든다.
       */}
      <ambientLight intensity={0.4} />
      <spotLight position={[1.4, 2.4, 2.8]} angle={0.3} penumbra={1} decay={0} intensity={3.2} />
      <directionalLight position={[-1.5, -0.6, 2.5]} intensity={0.35} />
      <directionalLight position={[-2.6, 1.4, -2.4]} intensity={2.2} color={palette.memory} />
      <directionalLight position={[2.6, 0.4, -2]} intensity={1.2} color={palette.memory} />
      <group rotation={[object.tilt ?? 0.16, 0, 0]}>
        {object.shape === "folded-note" ? (
          <InspectFoldedNote
            object={object}
            yawRef={yawRef}
            zoomRef={zoomRef}
            dragYRef={dragYRef}
            onFound={onFound}
            palette={palette}
            font={font}
          />
        ) : object.shape === "book" ? (
          <InspectBook
            object={object}
            zoomRef={zoomRef}
            pageRef={pageRef}
            onFound={onFound}
            palette={palette}
            font={font}
          />
        ) : (
          <InspectedThing
            object={object}
            yawRef={yawRef}
            zoomRef={zoomRef}
            dragYRef={dragYRef}
            onFound={onFound}
            palette={palette}
            font={font}
          />
        )}
      </group>
    </Canvas>
  );
}
