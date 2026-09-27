import { RoundedBox, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Color,
  type Group,
  type Material,
  type Mesh,
  MeshStandardMaterial,
  type PointLight,
} from "three";
import { MEMORIES, type MemoryId } from "@/data/memory-room";
import { CLUE_AFTER_MEMORY, type ClueId } from "@/data/room-clues";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { selectCanvasMinigameMemory } from "@/minigames/active";
import {
  hotspotStatus,
  isSeen,
  MEMORY_TOTAL,
  type RemarkId,
  selectActTwoProgress,
  selectCollectedCount,
  selectRadioSignaling,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { ballSeamGeometry } from "./ball-seam";
import { DotReflection } from "./DotReflection";
import { DrawerRations, FridgeDrawer } from "./FridgeDrawer";
import { toLitMaterial } from "./FurnitureModel";
import { DRAWER_TRAVEL } from "./fridge-drawer";
import { hitRadiusOf, MEMORY_PLACEMENTS, MEMORY_SPACE, type MemorySpace } from "./layout";
import { MemoryBeacon } from "./MemoryBeacon";
import { MemoryGlowLayers, MemoryGlowVisualBoundary } from "./MemoryOutlineGlow";
import { approach, HOVER_LAMBDA, memoryMotion, PUNCH_DURATION } from "./memory-motion";
import { centerModelXZ } from "./model-utils";
import type { RoomPalette } from "./palette";
import { radioSignalLevel } from "./radio-signal";
import { SpaceLight } from "./SpaceLight";
import type { EulerTuple, Vec3Tuple } from "./types";
import { useCoverTexture } from "./use-cover-texture";
import { useGlowHover } from "./use-glow-hover";
import { roomLightLevel, shouldHighlightMemory } from "./visual-state";

// 액자 glb(ch1-photo-frame)는 액자가 아니라 납작한 오각형 판때기라 지웠다.
// 제대로 된 액자 glb가 들어오면 frame 키를 다시 추가할 것.
const MODEL_PATHS = {
  ball: ASSETS.models.baseball,
  radio: ASSETS.models.radio,
  console: ASSETS.models.gamepad,
  phone: ASSETS.models.smartphone,
  // 대체물(ReportCardMemory)과 같은 A4 0.30×0.42, 밑면 가운데 원점, 인쇄면 +Y라 자세 보정이 없다
  "report-card": ASSETS.models.reportCard,
} as const satisfies Partial<Record<MemoryId, string>>;

/** 게임패드 glb 가로 3.06을 러그 위 소품 크기(0.5 안팎)로 줄이는 배율. */
const GAMEPAD_SCALE = 0.16;
/** glb 두께(z 0.92)의 절반. 눕히면 이 값이 높이의 절반이 되어, 이만큼 띄워야 밑면이 원점에 닿는다. */
const GAMEPAD_HALF_THICKNESS = 0.46;

/** 스마트폰 glb 높이 3.80을 대체물(PhoneMemory) 높이 0.72에 맞추는 배율. 가로는 0.39가 되어 폰 비율이 산다. */
const PHONE_SCALE = 0.19;
/** glb 두께(z 0.092)의 절반. 원점이 밑면 가운데라 두께 방향으로는 이미 중심에 있다. */
const PHONE_MODEL_HALF_THICKNESS = 0.046;
/** 대체물 두께 0.16의 절반. 배치표의 y가 이 두께로 매트리스에 닿게 잡혀 있어, 더 얇은 glb는 그 차이만큼 내린다. */
const PHONE_FALLBACK_HALF_THICKNESS = 0.08;
/** 대체물이 세워 든 자세로 갖고 있는 기울기. 배치표의 회전이 이걸 상쇄하도록 잡혀 있어 glb도 같이 기울여야 화면이 천장을 본다. */
const PHONE_VISUAL_TILT = -0.18;

/**
 * glb 하나에만 필요한 자세. 배치표(MEMORY_PLACEMENTS)의 회전·배율은 프리미티브
 * 대체물과 같이 쓰므로, 모델이 다른 자세로 들어왔을 때의 보정은 여기서 준다.
 * 게임패드와 폰은 세워진 채(앞면 +z, 밑면 y=0) 내보내져서 앞면이 위를 보게 눕힌다.
 */
const MODEL_POSE = {
  console: {
    position: [0, GAMEPAD_HALF_THICKNESS * GAMEPAD_SCALE, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: GAMEPAD_SCALE,
  },
  phone: {
    // 배치표 회전을 거치면 로컬 -z가 매트리스 쪽이다. 대체물 밑면이 닿던 깊이까지 얇은 만큼 더 내린다.
    position: [0, 0, PHONE_MODEL_HALF_THICKNESS * PHONE_SCALE - PHONE_FALLBACK_HALF_THICKNESS],
    rotation: [PHONE_VISUAL_TILT, 0, 0],
    scale: PHONE_SCALE,
  },
} as const satisfies Partial<
  Record<MemoryId, { position: Vec3Tuple; rotation: EulerTuple; scale: number }>
>;

/**
 * 폰 glb는 화면 메쉬에 재질이 안 붙어 나온다. GLTFLoader가 이름 없는 기본 재질(흰색·금속성 1)을
 * 끼우는데, 그대로면 방 조명 아래서 검게 죽는다. 대체물(PhoneMemory)과 같은 종이색 화면을
 * 입힌다. 몸통처럼 재질이 붙어 나온 메쉬는 그대로 복제한다.
 */
function remakePhoneMaterial(material: Material, palette: RoomPalette): Material {
  if (material.name !== "") return material.clone();
  const screen = new MeshStandardMaterial({ color: palette.linen, roughness: 0.45, metalness: 0 });
  screen.name = "phone-screen";
  return screen;
}

/** glb 재질에 손을 대야 하는 기억. 없으면 재질을 그대로 복제한다. */
const MODEL_MATERIALS = {
  phone: remakePhoneMaterial,
} as const satisfies Partial<
  Record<MemoryId, (material: Material, palette: RoomPalette) => Material>
>;

function cloneMaterial(material: Material): Material {
  return material.clone();
}

/** 컴퓨터는 한 기억이 glb 세 개(모니터·키보드·마우스)로 이루어진다. */
const COMPUTER_MODEL_PATHS = [
  ASSETS.models.computerScreen,
  ASSETS.models.computerKeyboard,
  ASSETS.models.computerMouse,
] as const;

for (const path of [...Object.values(MODEL_PATHS), ...COMPUTER_MODEL_PATHS]) {
  // Drei enables Meshopt by default; passing `true` keeps that decoder requirement explicit.
  useGLTF.preload(path, true, true);
}

/**
 * 조사 완료 표시: 회색으로 죽이는 대신 금빛을 켜 둔다.
 * DESIGN.md의 핵심 연출이 "기억을 모을수록 화면에서 금빛 비중이 늘어나는 것"이라,
 * 수집한 오브젝트에서 색을 빼면 연출이 정반대로 간다.
 */
const COLLECTED_EMISSIVE_INTENSITY = 0.42;

interface EmissiveBaseline {
  color: number;
  intensity: number;
}

/** 원래 이미시브 값을 재질별로 기억해 둔다. 해제할 때 그대로 되돌리기 위해서. */
const emissiveBaselines = new WeakMap<Material, EmissiveBaseline>();

type EmissiveMaterial = Material & {
  emissive?: Color;
  emissiveIntensity?: number;
};

function setMaterialCollected(material: Material, collected: boolean, memoryColor: string) {
  const target = material as EmissiveMaterial;
  if (!target.emissive) return;

  let baseline = emissiveBaselines.get(material);
  if (!baseline) {
    baseline = { color: target.emissive.getHex(), intensity: target.emissiveIntensity ?? 0 };
    emissiveBaselines.set(material, baseline);
  }

  if (collected) {
    target.emissive.set(memoryColor);
    target.emissiveIntensity = COLLECTED_EMISSIVE_INTENSITY;
  } else {
    target.emissive.setHex(baseline.color);
    target.emissiveIntensity = baseline.intensity;
  }
  /*
   * needsUpdate는 걸지 않는다. emissive 색·세기는 유니폼이라 다음 프레임에
   * 그대로 반영된다. needsUpdate를 걸면 셰이더가 통째로 재컴파일되면서 수집
   * 확정 프레임(미니게임을 닫는 순간)에 그 메쉬가 한 번 비어 보인다. 액자
   * 사진이 닫을 때마다 깜빡이던 원인이다.
   */
}

function setMaterialOpacity(material: Material, opacity: number) {
  material.opacity = opacity;
  material.transparent = opacity < 1;
  material.depthWrite = opacity === 1;
  material.needsUpdate = true;
}

function LoadedGlb({
  path,
  opacity,
  lit,
  remakeMaterial,
}: {
  path: string;
  opacity: number;
  lit?: boolean;
  /** 재질을 바꿔 끼워야 하는 모델의 몫 (MODEL_MATERIALS). 없으면 lit 여부로 고른다. */
  remakeMaterial?: (material: Material) => Material;
}) {
  // The third argument explicitly enables the MeshoptDecoder configured by Drei's useGLTF.
  const { scene } = useGLTF(path, true, true);
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    // unlit 재질도 lit 요청이면 방 조명을 받는 재질로 갈아끼운다.
    const remake = remakeMaterial ?? (lit ? toLitMaterial : cloneMaterial);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(remake)
        : remake(mesh.material);
    });
    // 모델 원점과 관계없이 배치 좌표가 XZ 중심을 뜻하도록 맞춘다.
    return centerModelXZ(copy);
  }, [scene, lit, remakeMaterial]);

  useLayoutEffect(() => {
    cloned.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) setMaterialOpacity(material, opacity);
    });
  }, [cloned, opacity]);

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

  return <primitive object={cloned} />;
}

function GlbMemoryModel({
  id,
  path,
  fallback,
  opacity,
  palette,
  onReady,
}: {
  id: MemoryId;
  path: string;
  fallback: ReactNode;
  opacity: number;
  palette: RoomPalette;
  onReady: () => void;
}) {
  const pose = MODEL_POSE[id as keyof typeof MODEL_POSE];
  const remakeModelMaterial = MODEL_MATERIALS[id as keyof typeof MODEL_MATERIALS];
  const remakeMaterial = useMemo(
    () => remakeModelMaterial && ((material: Material) => remakeModelMaterial(material, palette)),
    [remakeModelMaterial, palette],
  );
  const model = <LoadedGlb path={path} opacity={opacity} remakeMaterial={remakeMaterial} />;
  return (
    <MemoryGlowVisualBoundary fallback={fallback} onVisible={onReady}>
      {/* 자세 보정은 모델에만: 대체 프리미티브는 배치표 기준으로 이미 맞춰져 있다 */}
      {pose ? (
        <group position={pose.position} rotation={pose.rotation} scale={pose.scale}>
          {model}
        </group>
      ) : (
        model
      )}
    </MemoryGlowVisualBoundary>
  );
}

interface VisualProps {
  palette: RoomPalette;
  opacity: number;
}

/**
 * 러그 위에 던져둔 게임패드: glb(ch1-gamepad)가 뜨기 전에 서는 대체물.
 * 몸통 · 손잡이 둘 · 십자키 · 버튼 둘. 방의 다른 소품과 같은 박스 조형으로 짜서
 * 따로 놀지 않게 했다. 원점은 밑면 한가운데(glb와 같다).
 */
function Gamepad({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group>
      <mesh position={[0, 0.045, -0.03]} castShadow>
        <boxGeometry args={[0.44, 0.09, 0.2]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.5}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 손잡이: 몸통 양 끝에서 앞(+z)으로 뻗는다 */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.045, 0.08]} castShadow>
          <boxGeometry args={[0.1, 0.09, 0.14]} />
          <meshStandardMaterial
            color={palette.frame}
            roughness={0.6}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      ))}
      <mesh position={[-0.12, 0.096, -0.05]}>
        <boxGeometry args={[0.06, 0.012, 0.06]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.6}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {[-0.03, 0.03].map((offset) => (
        <mesh key={offset} position={[0.12 + offset, 0.096, -0.05 - offset]}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 10]} />
          <meshStandardMaterial
            color={palette.clay}
            roughness={0.55}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      ))}
    </group>
  );
}

function Ball({ palette, opacity }: VisualProps) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial
        color={palette.linen}
        roughness={0.65}
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/** 실밥이 어디를 지나는지는 ball-seam.ts가 정한다. glb 표면에 파인 홈을 따른다. */
function BallSeam({ palette, opacity }: VisualProps) {
  const geometry = useMemo(ballSeamGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={palette.clay}
        roughness={0.7}
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/** 캐비닛 위에 세워두는 탁상 액자. 원점이 액자 중앙, 아랫변이 -FRAME_HEIGHT/2에 온다. */
const FRAME_WIDTH = 0.52;
const FRAME_HEIGHT = 0.4;
const FRAME_BORDER = 0.045;
const FRAME_DEPTH = 0.035;
const FRAME_OPENING_WIDTH = FRAME_WIDTH - FRAME_BORDER * 2;
const FRAME_OPENING_HEIGHT = FRAME_HEIGHT - FRAME_BORDER * 2;
const FRAME_OPENING_ASPECT = FRAME_OPENING_WIDTH / FRAME_OPENING_HEIGHT;

const FRAME_BARS = [
  {
    size: [FRAME_WIDTH, FRAME_BORDER, FRAME_DEPTH],
    position: [0, (FRAME_HEIGHT - FRAME_BORDER) / 2, 0],
  },
  {
    size: [FRAME_WIDTH, FRAME_BORDER, FRAME_DEPTH],
    position: [0, -(FRAME_HEIGHT - FRAME_BORDER) / 2, 0],
  },
  {
    size: [FRAME_BORDER, FRAME_OPENING_HEIGHT, FRAME_DEPTH],
    position: [-(FRAME_WIDTH - FRAME_BORDER) / 2, 0, 0],
  },
  {
    size: [FRAME_BORDER, FRAME_OPENING_HEIGHT, FRAME_DEPTH],
    position: [(FRAME_WIDTH - FRAME_BORDER) / 2, 0, 0],
  },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple }[];

/**
 * 캐비닛 위 액자. 닦기 미니게임을 열기 전에도 사진이 들어 있다.
 *
 * 예전에는 종이색 판에 벽돌빛 띠 하나가 "사진이 있을 자리"를 흉내내고 있었는데,
 * 방을 둘러보는 사람에게는 그냥 무늬 없는 판때기라 액자로 읽히지 않았다. 사진을
 * 미리 걸어 두면 "저기 뭔가 찍혀 있다 → 가서 봐야겠다"가 클릭보다 먼저 온다.
 *
 * 걸리는 그림은 진행을 따라간다. 2차 조사를 마치기 전까지는 1차(부모 얼굴이 그늘에
 * 묻힌) 버전이다. 닦아서 드러나는 것이 이 오브젝트의 이야기라, 방에 서 있는 액자가
 * 미리 다 보여주면 닦을 이유가 없다. 다 닦고 나면 방의 액자도 드러난 사진으로 남는다:
 * 되찾은 기억이 미니게임 화면 안에서만 살아 있으면 방은 아무것도 달라지지 않는다.
 */
function Frame({ palette, opacity }: VisualProps) {
  const revealed = useMemoryRoomStore((state) => state.revisited.includes("frame"));
  /*
   * 잘려 나가는 정도가 두 그림이 다르다. 1차(1.10:1)는 액자 구멍(1.39:1)보다 세로로
   * 길어 위아래로 21%쯤 깎이고, 2차(1.25:1)는 10%쯤 깎인다. 1차에서 잘리는 건 그늘에
   * 묻힌 부모의 이마와 아래쪽 메달이고, 2차의 세 얼굴은 가운데에 있어 다 남는다.
   */
  const photo = useCoverTexture(
    revealed ? ASSETS.images.mgPhotoWipePhase2 : ASSETS.images.mgPhotoWipePhase1,
    FRAME_OPENING_ASPECT,
  );

  return (
    <group rotation={[-0.12, 0, 0]}>
      {FRAME_BARS.map((bar) => (
        <mesh key={bar.position.join(":")} position={bar.position} castShadow>
          <boxGeometry args={bar.size} />
          <meshStandardMaterial
            color={palette.wood}
            roughness={0.62}
            opacity={opacity}
            transparent={opacity < 1}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, -FRAME_DEPTH / 2]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, FRAME_HEIGHT, 0.012]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.75}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {/*
        사진면. map이 붙기 전(로드 중이거나 파일이 없을 때)에는 종이색 판이 그대로
        보인다. 예전 모습 그대로라 사진이 늦게 와도 액자가 비어 보이지 않는다.

        색은 map에 곱해지므로 종이색이 사진 위에 옅은 크림 베일로 남는다. 흰색으로
        빼지 않는 건, 바랜 세피아가 이 방의 톤이고 팔레트 밖 값을 새로 만들지
        않기 위해서다 (DESIGN.md).
      */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[FRAME_OPENING_WIDTH, FRAME_OPENING_HEIGHT]} />
        <meshStandardMaterial
          map={photo}
          color={palette.linen}
          emissive={palette.memory}
          emissiveIntensity={0.1}
          roughness={0.85}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      <mesh position={[0, -FRAME_HEIGHT * 0.2, -0.085]} rotation={[0.38, 0, 0]} castShadow>
        <boxGeometry args={[0.11, FRAME_HEIGHT * 0.68, 0.014]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.8}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
    </group>
  );
}

/**
 * 창 기억의 시각 요소 = 유리 한 장.
 *
 * 예전엔 종이색(paper) 판을 0.22로 덮었다. 창이 불투명한 판때기였을 땐 "유리에 어린
 * 빛"으로 읽혔지만, 뒷벽에 진짜 구멍이 뚫리고 밤하늘이 들어온 뒤로는 풍경 전체를
 * 베이지로 덮어버린다. 유리답게 차갑고 아주 옅게만 남긴다.
 * (판 자체는 지울 수 없다. 아웃라인 글로우가 이 메쉬를 윤곽으로 쓴다.)
 */
function WindowMemory({ palette, opacity }: VisualProps) {
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[2.55, 2.1]} />
      <meshStandardMaterial
        color={palette.linen}
        emissive={palette.memory}
        emissiveIntensity={0.06}
        opacity={0.07 * opacity}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function RadioMemory({ palette, opacity }: VisualProps) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.92, 0.56, 0.4]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.68}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {[-0.23, 0.23].map((x) => (
        <mesh key={x} position={[x, 0.29, 0.215]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
          <meshStandardMaterial
            color={palette.trim}
            roughness={0.6}
            opacity={opacity}
            transparent={opacity < 1}
          />
        </mesh>
      ))}
      <mesh position={[0.3, 0.78, 0]} rotation={[0, 0, -0.42]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.62, 8]} />
        <meshStandardMaterial
          color={palette.clay}
          roughness={0.5}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
    </group>
  );
}

/**
 * 신호등이 앉는 자리: 라디오 표시창 언저리(로컬 좌표).
 * 배치 스케일(layout의 radio.scale)이 그대로 곱해지므로 glb 원본 크기 기준이다.
 */
const RADIO_SIGNAL_POSITION: Vec3Tuple = [0.132, 0.15, 0.052];
/** 표시등 반경. 판이 아니라 구라 라디오를 어느 각도에서 봐도 보인다. */
const RADIO_SIGNAL_RADIUS = 0.032;
/**
 * 깜빡임이 방으로 새어 나가는 정도. 분기점(v4 3-3)의 방은 가장 어둡고 BGM도 없어서,
 * 이 빨간 빛이 방에서 유일하게 움직이는 것이다. 책상 언저리가 붉게 물들 만큼 준다.
 */
const RADIO_SIGNAL_LIGHT = 3.2;

/**
 * 재난방송이 끊긴 뒤, 도해가 만지지도 않았는데 저 혼자 지직거리는 라디오.
 *
 * 2바퀴의 문은 "다시 조사해 보자"가 아니라 "라디오가 먼저 말을 건다"로 열린다.
 * 그래서 이 깜빡임은 조사 가능 표식(금빛 외곽선·비컨)과 별개다. 표식은 플레이어에게
 * 거는 말이고, 이건 방 안에서 실제로 일어나는 일이다.
 */
function RadioSignal({ palette }: { palette: RoomPalette }) {
  const signaling = useMemoryRoomStore(selectRadioSignaling);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  // setState 없이 매 프레임 값만 민다 (.claude/rules/r3f.md)
  useFrame((state) => {
    const level = radioSignalLevel(state.clock.elapsedTime);
    if (materialRef.current) materialRef.current.emissiveIntensity = level * 2.2;
    if (lightRef.current) lightRef.current.intensity = signaling ? level * RADIO_SIGNAL_LIGHT : 0;
  });

  return (
    <group position={RADIO_SIGNAL_POSITION}>
      {signaling ? (
        <mesh>
          <sphereGeometry args={[RADIO_SIGNAL_RADIUS, 10, 8]} />
          <meshStandardMaterial
            ref={materialRef}
            color={palette.ember}
            emissive={palette.ember}
            emissiveIntensity={0}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {/* 빛은 깜빡이지 않는 동안에도 세워 둔다. 광원이 생겼다 사라지면 재질이 통째로 재컴파일된다 */}
      <SpaceLight ref={lightRef} color={palette.ember} intensity={0} distance={2.8} decay={2} />
    </group>
  );
}

function PhoneMemory({ palette, opacity }: VisualProps) {
  return (
    <group rotation={[-0.18, 0, 0]}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.48, 0.72, 0.16]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.55}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      <mesh position={[0, 0.37, 0.085]}>
        <planeGeometry args={[0.37, 0.52]} />
        <meshStandardMaterial
          color={palette.linen}
          roughness={0.45}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
    </group>
  );
}

function CalendarMemory({ palette, opacity }: VisualProps) {
  return (
    <group>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.82, 1]} />
        <meshStandardMaterial
          color={palette.linen}
          roughness={0.92}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      <mesh position={[0, 0.37, 0.04]}>
        <planeGeometry args={[0.82, 0.24]} />
        <meshStandardMaterial
          color={palette.clay}
          roughness={0.75}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {CALENDAR_DOTS.map((dot) => (
        <mesh key={`${dot.x}:${dot.y}`} position={[dot.x, dot.y, 0.045]}>
          <circleGeometry args={[0.026, 10]} />
          <meshStandardMaterial
            color={palette.frame}
            roughness={0.8}
            opacity={opacity}
            transparent={opacity < 1}
          />
        </mesh>
      ))}
    </group>
  );
}

const CALENDAR_DOTS = Array.from({ length: 16 }, (_, index) => ({
  x: ((index % 4) - 1.5) * 0.15,
  y: (1.5 - Math.floor(index / 4)) * 0.14 - 0.1,
}));

/*
 * 컴퓨터 세트의 부품 배치: 앵커(MEMORY_PLACEMENTS.computer) 기준 로컬 오프셋.
 * 값은 예전 DeskAccessories가 책상 로컬로 들고 있던 좌표에서 앵커만큼 뺀 것이라,
 * 월드에서는 가구였을 때와 같은 자리에 선다. 배율도 책상 소품 공통값(3.1) 그대로.
 */
const COMPUTER_PROP_SCALE = 3.1;
const COMPUTER_PARTS = [
  { path: ASSETS.models.computerScreen, offset: [-0.15, 0, -0.46] },
  { path: ASSETS.models.computerKeyboard, offset: [-0.1, 0, 0.22] },
  { path: ASSETS.models.computerMouse, offset: [0.62, 0, 0.24] },
] as const satisfies readonly { path: string; offset: Vec3Tuple }[];

/** glb가 오기 전의 컴퓨터: 모니터 판과 키보드 슬래브만 세운 대역. */
function ComputerPrimitive({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group>
      <group position={COMPUTER_PARTS[0].offset}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.95, 0.62, 0.07]} />
          <meshStandardMaterial
            color={palette.frame}
            roughness={0.55}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
        {/* 꺼진 모니터: 어두운 유리에 방의 빛만 살짝 어린다 */}
        <mesh position={[0, 0.45, 0.038]}>
          <planeGeometry args={[0.85, 0.52]} />
          <meshStandardMaterial
            color={palette.deep}
            emissive={palette.memory}
            emissiveIntensity={0.08}
            roughness={0.35}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.3, 0.12, 0.22]} />
          <meshStandardMaterial
            color={palette.frame}
            roughness={0.6}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      </group>
      <group position={COMPUTER_PARTS[1].offset}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.72, 0.04, 0.26]} />
          <meshStandardMaterial
            color={palette.trim}
            roughness={0.7}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 책상 위 컴퓨터: 한 기억이 glb 세 개(모니터·키보드·마우스)로 이루어진다.
 * 자체 제작한 세 부품을 책상 로컬 좌표로 배치한다. lit 변환은 비조명 재질도
 * 방 조명을 받도록 보장하고, StandardMaterial은 그대로 복제한다.
 */
function ComputerMemory({ palette, opacity, onReady }: VisualProps & { onReady: () => void }) {
  return (
    <MemoryGlowVisualBoundary
      fallback={<ComputerPrimitive palette={palette} opacity={opacity} />}
      onVisible={onReady}
    >
      <group>
        {COMPUTER_PARTS.map((part) => (
          <group key={part.path} position={part.offset} scale={COMPUTER_PROP_SCALE}>
            <LoadedGlb path={part.path} opacity={opacity} lit />
          </group>
        ))}
        <MonitorReflection palette={palette} />
      </group>
    </MemoryGlowVisualBoundary>
  );
}

/**
 * 모니터 유리(glb의 `void` 노드): 로컬 (0, 0.187, 0.0015)에 반폭 0.1815·반높이 0.095의
 * 얇은 판이 +z를 본다. 세트 배율(3.1)을 곱해 화면 부품 오프셋 위에 세운다. 유리 앞면
 * (두께 0.0055)보다 조금 앞이라 겹쳐 깜빡이지 않는다.
 */
const MONITOR_GLASS = {
  width: 0.1815 * 2 * COMPUTER_PROP_SCALE,
  height: 0.095 * 2 * COMPUTER_PROP_SCALE,
  position: [
    COMPUTER_PARTS[0].offset[0],
    0.187 * COMPUTER_PROP_SCALE,
    COMPUTER_PARTS[0].offset[2] + 0.0075 * COMPUTER_PROP_SCALE + 0.004,
  ] as Vec3Tuple,
} as const;

/**
 * 꺼진 모니터 유리에 비치는 방 (docs/visual-experiments.md 11장, DotReflection). 도트 굵기는
 * 방 밝기를 따른다: 어두울수록 굵어 형체가 안 잡히고, 되찾을수록 촘촘해진다. 켜고 끄는 건
 * 효과 예산 한 곳이 정한다 (effect-budget, 렌더 타깃이 드는 heavy).
 */
function MonitorReflection({ palette }: { palette: RoomPalette }) {
  const collectedCount = useMemoryRoomStore(selectCollectedCount);
  const recovery = useMemoryRoomStore(selectActTwoProgress);
  const level = roomLightLevel({ collected: collectedCount, memoryTotal: MEMORY_TOTAL, recovery });
  const enabled = useEffectEnabled("heavy");
  return (
    <DotReflection
      palette={palette}
      level={level}
      enabled={enabled}
      width={MONITOR_GLASS.width}
      height={MONITOR_GLASS.height}
      position={MONITOR_GLASS.position}
      space="room"
    />
  );
}

/*
 * ── 거실의 기억 (2막) ──────────────────────────────────────────────
 *
 * 셋은 이미 서 있는 가구를 만진다 (냉장고 문·아래칸, 신발장 문). 가구를 복제하지
 * 않고 **여는 면의 테두리만** 가는 막대 넷으로 긋는다. 평소엔 가구와 같은 색이라
 * 이음매처럼 묻혀 있다가, 조사할 차례가 되면 그 사각형이 통째로 금빛으로 뜬다.
 *
 * 판때기로 면을 덮지 않는 이유: 냉장고 문에는 이미 자석에 눌린 메모가 붙어 있고
 * (LivingRoomFurniture의 FRIDGE_PARTS), 판을 얹으면 그 메모가 가려진다. 메모는
 * 마지막 단서(ampoule)가 들추는 물건이라 끝까지 보여야 한다.
 */
const DOOR_EDGE = 0.028;

function DoorOutline({
  width,
  height,
  color,
  opacity,
}: {
  width: number;
  height: number;
  color: string;
  opacity: number;
}) {
  const transparent = opacity < 1;
  const halfW = width / 2;
  const halfH = height / 2;
  const bars: { size: Vec3Tuple; position: Vec3Tuple }[] = [
    { size: [width, DOOR_EDGE, DOOR_EDGE], position: [0, halfH, 0] },
    { size: [width, DOOR_EDGE, DOOR_EDGE], position: [0, -halfH, 0] },
    { size: [DOOR_EDGE, height, DOOR_EDGE], position: [-halfW, 0, 0] },
    { size: [DOOR_EDGE, height, DOOR_EDGE], position: [halfW, 0, 0] },
  ];
  return bars.map((bar) => (
    <mesh key={bar.position.join(":")} position={bar.position}>
      <boxGeometry args={bar.size} />
      <meshStandardMaterial
        color={color}
        roughness={0.75}
        opacity={opacity}
        transparent={transparent}
      />
    </mesh>
  ));
}

/** 냉장실 문: 열면 아직 반이나 남은 식량이 나온다. */
function FridgeDoorMemory({ palette, opacity }: VisualProps) {
  return <DoorOutline width={0.86} height={0.7} color={palette.linen} opacity={opacity} />;
}

/** 냉장고 아래칸: "손대지 마"라던 칸. 앰플이 여기 있다. */
/**
 * 냉장고 아래칸: "손대지 마"라던 서랍. 조사 전엔 닫혀 있고, 앰플을 꺼낸 뒤엔 식량만
 * 남은 채 열려 있다. 여는 순간과 집는 손은 canvas 미니게임(ampoule-pickup)이 같은
 * 자리에서 그린다. 그동안 이 모습은 숨는다 (InteractiveMemory의 liveCanvasMinigame).
 */
function FridgeDrawerMemory({ palette, opacity }: VisualProps) {
  const emptied = useMemoryRoomStore((state) => state.revisited.includes("ampoule"));
  return (
    <group position={[0, 0, emptied ? DRAWER_TRAVEL : 0]}>
      <FridgeDrawer palette={palette} opacity={opacity}>
        <DrawerRations palette={palette} />
      </FridgeDrawer>
    </group>
  );
}

/** 신발장 문: 두고 간 등산화가 그대로 있다. */
function ShoeCabinetMemory({ palette, opacity }: VisualProps) {
  return <DoorOutline width={1.7} height={0.86} color={palette.wood} opacity={opacity} />;
}

/**
 * 식탁 위 엄마 쪽지: 반으로 접어 세워 둔 노란 메모지 한 장 (card-flip).
 *
 * 원래는 치다 만 트럼프 판이었다. 판 밑에 메모를 끼우는 건 억지라 쪽지 하나만 남겼다.
 * 넓은 상판 한가운데 작은 종이라, 텐트처럼 살짝 세워 그림자로 눈에 띄게 한다.
 */
function TableNoteMemory({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group rotation={[0, 0.35, 0]}>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[
            side * (NOTE_HALF / 2) * Math.cos(NOTE_FOLD),
            (NOTE_HALF / 2) * Math.sin(NOTE_FOLD),
            0,
          ]}
          rotation={[0, 0, -side * NOTE_FOLD]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[NOTE_HALF, 0.003, 0.14]} />
          <meshStandardMaterial
            color={palette.sun}
            roughness={0.85}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      ))}
    </group>
  );
}

/** 쪽지 반쪽의 폭과 접혀 선 각(상판에서 들린 각도). */
const NOTE_HALF = 0.1;
const NOTE_FOLD = 0.45;

/** 소파 앞에 던져둔 책가방: 비우고 다시 싸는 물건. */
function BackpackMemory({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  const fabricMaterial = (color: string, roughness = 0.92) => (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      opacity={opacity}
      transparent={transparent}
    />
  );

  return (
    <group rotation={[0, -0.08, -0.04]}>
      {/* 몸통 뒤로 비어져 나온 두 어깨끈. 서로 다른 각도로 흩어져 던져진 느낌을 낸다. */}
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          name="backpack-shoulder-strap"
          position={[side * 0.2, 0.006, 0.05]}
          rotation={[0, side * 0.14, side * 0.08]}
        >
          <mesh position={[side * 0.04, 0, 0.28]} rotation={[0, side * 0.16, 0]} castShadow>
            <boxGeometry args={[0.075, 0.035, 0.42]} />
            {fabricMaterial(palette.coal)}
          </mesh>
          <mesh position={[side * 0.1, -0.004, 0.49]} rotation={[0, side * 0.42, 0]} castShadow>
            <boxGeometry args={[0.055, 0.026, 0.2]} />
            {fabricMaterial(palette.frame)}
          </mesh>
        </group>
      ))}

      {/* 낮게 눕힌 둥근 사각 몸통이 학교 백팩의 단단한 실루엣을 만든다. */}
      <RoundedBox
        name="backpack-body"
        args={[0.58, 0.2, 0.68]}
        radius={0.075}
        smoothness={3}
        castShadow
        receiveShadow
      >
        {fabricMaterial(palette.deep)}
      </RoundedBox>

      {/* 양 옆 천 패널은 몸통의 깊이와 각진 형태를 더 잘 읽히게 한다. */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * 0.292, 0.005, 0.04]} castShadow>
          <boxGeometry args={[0.025, 0.13, 0.45]} />
          {fabricMaterial(palette.coal)}
        </mesh>
      ))}

      {/* 앞주머니: 참고 이미지처럼 아래쪽 절반을 크게 덮는다. */}
      <RoundedBox
        name="backpack-front-pocket"
        args={[0.49, 0.105, 0.29]}
        radius={0.045}
        smoothness={3}
        position={[0, 0.13, 0.14]}
        castShadow
        receiveShadow
      >
        {fabricMaterial(palette.frame)}
      </RoundedBox>

      {/* 본체 지퍼와 앞주머니 지퍼. */}
      <mesh position={[0, 0.108, -0.235]} castShadow={false}>
        <boxGeometry args={[0.46, 0.018, 0.018]} />
        {fabricMaterial(palette.trim, 0.62)}
      </mesh>
      <mesh position={[0, 0.187, 0.055]} castShadow={false}>
        <boxGeometry args={[0.39, 0.014, 0.015]} />
        {fabricMaterial(palette.trim, 0.62)}
      </mesh>

      {/* 위 손잡이는 세 토막으로 만든 낮은 U자다. */}
      <group position={[0, 0.06, -0.39]}>
        <mesh position={[-0.105, 0, 0.035]} rotation={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.035, 0.04, 0.14]} />
          {fabricMaterial(palette.coal)}
        </mesh>
        <mesh position={[0.105, 0, 0.035]} rotation={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.035, 0.04, 0.14]} />
          {fabricMaterial(palette.coal)}
        </mesh>
        <mesh position={[0, 0, -0.02]} castShadow>
          <boxGeometry args={[0.19, 0.04, 0.035]} />
          {fabricMaterial(palette.coal)}
        </mesh>
      </group>
    </group>
  );
}

/** 얇은 판 하나: 종이·카드·봉투를 같은 모양으로 쌓는다. */
function Sheet({
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  opacity,
}: {
  size: Vec3Tuple;
  position?: Vec3Tuple;
  rotation?: EulerTuple;
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/** 안방 책상 위 연구 일지: 서류 두 겹과 집게 하나. 예전 단서 서류 뭉치 자리다. */
function ResearchNoteMemory({ palette, opacity }: VisualProps) {
  return (
    <group>
      <Sheet
        size={[0.55, 0.04, 0.4]}
        position={[0, 0.02, 0]}
        color={palette.linen}
        opacity={opacity}
      />
      <Sheet
        size={[0.5, 0.03, 0.36]}
        position={[0.1, 0.055, -0.05]}
        rotation={[0, 0.12, 0]}
        color={palette.linen}
        opacity={opacity}
      />
      <Sheet
        size={[0.12, 0.02, 0.05]}
        position={[0.1, 0.08, -0.2]}
        color={palette.frame}
        opacity={opacity}
      />
    </group>
  );
}

/** 출입증 두 장: 목걸이 줄이 달린 카드. 로고 자리에 앰버 점 하나. */
function IdCardMemory({ palette, opacity }: VisualProps) {
  return (
    <group>
      {[-0.07, 0.07].map((x, index) => (
        <group
          key={x}
          position={[x, 0.006 + index * 0.008, index * 0.04]}
          rotation={[0, index * 0.3, 0]}
        >
          <Sheet size={[0.12, 0.006, 0.18]} color={palette.linen} opacity={opacity} />
          <Sheet
            size={[0.035, 0.004, 0.035]}
            position={[0, 0.005, -0.05]}
            color={palette.amber}
            opacity={opacity}
          />
          <Sheet
            size={[0.02, 0.004, 0.22]}
            position={[0, 0.001, -0.2]}
            color={palette.clay}
            opacity={opacity}
          />
        </group>
      ))}
    </group>
  );
}

/** 책상 위 모의고사 성적표: glb(ch1-report-card)가 뜨기 전의 대체물. 종이 한 장, 머리띠와 등급표 줄만. */
function ReportCardMemory({ palette, opacity }: VisualProps) {
  return (
    <group>
      <Sheet size={[0.3, 0.004, 0.42]} color={palette.linen} opacity={opacity} />
      <Sheet
        size={[0.3, 0.004, 0.07]}
        position={[0, 0.002, -0.175]}
        color={palette.sage}
        opacity={opacity}
      />
      {[-0.06, 0, 0.06].map((z) => (
        <Sheet
          key={z}
          size={[0.24, 0.004, 0.012]}
          position={[0, 0.002, z]}
          color={palette.frame}
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function PrimitiveVisual({ id, palette, opacity }: VisualProps & { id: MemoryId }) {
  switch (id) {
    case "report-card":
      return <ReportCardMemory palette={palette} opacity={opacity} />;
    case "console":
      return <Gamepad palette={palette} opacity={opacity} />;
    case "ball":
      return <Ball palette={palette} opacity={opacity} />;
    case "frame":
      return <Frame palette={palette} opacity={opacity} />;
    case "window":
      return <WindowMemory palette={palette} opacity={opacity} />;
    case "radio":
      return <RadioMemory palette={palette} opacity={opacity} />;
    case "phone":
      return <PhoneMemory palette={palette} opacity={opacity} />;
    case "calendar":
      return <CalendarMemory palette={palette} opacity={opacity} />;
    case "computer":
      return <ComputerPrimitive palette={palette} opacity={opacity} />;
    case "fridge":
      return <FridgeDoorMemory palette={palette} opacity={opacity} />;
    case "duffel":
      return <BackpackMemory palette={palette} opacity={opacity} />;
    case "shoes":
      return <ShoeCabinetMemory palette={palette} opacity={opacity} />;
    case "cards":
      return <TableNoteMemory palette={palette} opacity={opacity} />;
    case "ampoule":
      return <FridgeDrawerMemory palette={palette} opacity={opacity} />;
    case "research-note":
      return <ResearchNoteMemory palette={palette} opacity={opacity} />;
    case "id-card":
      return <IdCardMemory palette={palette} opacity={opacity} />;
  }
}

function MemoryVisual({
  id,
  palette,
  opacity,
  onModelReady,
}: VisualProps & { id: MemoryId; onModelReady: () => void }) {
  const fallback = <PrimitiveVisual id={id} palette={palette} opacity={opacity} />;

  // 컴퓨터는 glb가 세 개라 1기억-1모델 경로(MODEL_PATHS)를 못 탄다
  if (id === "computer") {
    return <ComputerMemory palette={palette} opacity={opacity} onReady={onModelReady} />;
  }

  const modelPath = MODEL_PATHS[id as keyof typeof MODEL_PATHS];
  /* 모델 위에 코드로 덧입히는 것들: glb가 아직 안 왔어도 fallback 위에 그대로 얹힌다. */
  const overlays = (
    <>
      {/* glb에 실밥이 빠져 있어 코드로 덧입힌다. */}
      {id === "ball" ? <BallSeam palette={palette} opacity={opacity} /> : null}
      {id === "radio" ? <RadioSignal palette={palette} /> : null}
    </>
  );
  if (!modelPath) {
    return (
      <>
        {fallback}
        {overlays}
      </>
    );
  }

  return (
    <>
      <GlbMemoryModel
        id={id}
        path={modelPath}
        fallback={fallback}
        opacity={opacity}
        palette={palette}
        onReady={onModelReady}
      />
      {overlays}
    </>
  );
}

/**
 * 자식 메쉬 전체에 수집 완료 톤을 입힌다. 프리미티브든 glb든 결국 three 재질이라
 * 트래버스 한 번으로 처리된다. 시각 요소마다 emissive prop을 뿌리지 않는다.
 */
function CollectedTint({
  collected,
  memoryColor,
  revision,
  children,
}: {
  collected: boolean;
  memoryColor: string;
  /** glb는 늦게 붙는다. 로드 완료 때 값이 바뀌면서 다시 칠하게 하는 신호. */
  revision: number;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision은 본문에서 읽지 않고 재실행 신호로만 쓴다. glb가 늦게 붙으면 그때 다시 칠해야 한다.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) setMaterialCollected(material, collected, memoryColor);
    });
  }, [collected, memoryColor, revision]);

  return <group ref={groupRef}>{children}</group>;
}

/** 조사를 마치면 배경 오브젝트로 다시 열리는 기억 → 그때 펼칠 단서. */
const BACKGROUND_CLUE = CLUE_AFTER_MEMORY as Partial<Record<MemoryId, ClueId>>;

/**
 * 아직 한 번도 안 본 채 잠긴 기억을 눌렀을 때 흘리는 혼잣말 (v4 3-2).
 * 1페이즈의 컴퓨터는 꺼진 배경이다: 조사가 아니라 한 줄로 밀어낸다.
 */
const LOCKED_REMARK: Partial<Record<MemoryId, RemarkId>> = { computer: "computer-off" };

export function InteractiveMemory({
  id,
  palette,
  nearbyMemoryId,
  onInteract,
}: {
  id: MemoryId;
  palette: RoomPalette;
  nearbyMemoryId: MemoryId | null;
  onInteract: (id: MemoryId) => void;
}) {
  const status = useMemoryRoomStore((state) => hotspotStatus(state, id));
  const openClue = useMemoryRoomStore((state) => state.openClue);
  const sayRemark = useMemoryRoomStore((state) => state.sayRemark);
  const unseen = useMemoryRoomStore((state) => !isSeen(state, id));
  const lockedRemark = status === "locked" && unseen ? LOCKED_REMARK[id] : undefined;
  /*
   * canvas 모드 미니게임이 이 자리에서 도는 동안(앰플 집기) 평소 모습·표식·판정 구는
   * 숨는다. 미니게임이 같은 자리에 같은 물건을 움직이는 모습으로 그리는데, 둘이
   * 겹치면 서랍이 두 개가 되고 판정 구가 미니게임의 클릭을 먼저 삼킨다.
   */
  const liveCanvasMinigame = useMemoryRoomStore(selectCanvasMinigameMemory) === id;
  /*
   * 조사를 마친 뒤 배경 오브젝트로 내려앉는 기억(달력)이 있다. 조사가 끝나도
   * 벽에 걸린 물건이라, 누르면 그때 본 것을 다시 펼쳐 준다. 컴퓨터 비밀번호를
   * 잊었을 때 달력을 다시 볼 유일한 길이다 (src/data/room-clues.ts).
   */
  const backgroundClue = status === "done" ? BACKGROUND_CLUE[id] : undefined;
  const placement = MEMORY_PLACEMENTS[id];
  /*
   * 잠긴 기억도 불투명하게 그린다. 예전에는 "이 바퀴에 곧 열릴 물건"을 0.45로 흐렸는데,
   * 반투명한 라디오·달력은 멀리서 정체 모를 판때기로만 읽혔다. 물건은 그냥 방의
   * 물건으로 서 있고, 만질 수 있는지는 비콘과 글로우가 말한다.
   */
  const opacity = 1;
  // 1인칭 구간에서는 아무 기억도 만질 수 없고(store가 막는다) 빛나지도 않는다.
  // 어둠 속에 금빛 표식이 떠 있으면 스위치가 아니라 그걸 찾으러 간다
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const clickable = !firstPerson && (status === "available" || backgroundClue !== undefined);
  const { hovered, handlers } = useGlowHover(clickable);
  const highlighted = !firstPerson && shouldHighlightMemory(status, id, nearbyMemoryId, hovered);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const refreshSelection = useCallback(() => setSelectionVersion((version) => version + 1), []);
  const motionRef = useRef<Group>(null);
  const hoverRef = useRef(0);
  /** 클릭 펀치가 시작된 뒤 흐른 시간. PUNCH_DURATION을 넘으면 계산이 1로 수렴한다. */
  const punchRef = useRef(PUNCH_DURATION);

  // 호버로 뜨고 클릭에 눌리는 반응. setState 없이 ref만 만진다 (.claude/rules/r3f.md).
  useFrame((_, delta) => {
    const group = motionRef.current;
    if (!group) return;
    hoverRef.current = approach(hoverRef.current, hovered ? 1 : 0, HOVER_LAMBDA, delta);
    punchRef.current = Math.min(PUNCH_DURATION, punchRef.current + delta);
    const motion = memoryMotion(hoverRef.current, punchRef.current);
    group.scale.setScalar(motion.scale);
    group.position.y = motion.lift;
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group is a Canvas pointer target, not a DOM element.
    <group
      name={`memory-${id}`}
      position={placement.position}
      onClick={(event) => {
        event.stopPropagation();
        if (status !== "available") {
          if (backgroundClue) {
            punchRef.current = 0;
            playSound("open");
            openClue(backgroundClue);
          } else if (lockedRemark) {
            sayRemark(lockedRemark);
          } else if (!unseen) {
            // 이미 본 기억: 다시 조사시키지 않고, 수첩에 남은 마지막 기록을 한 줄 흘린다
            sayRemark("seen", id);
          }
          return;
        }
        punchRef.current = 0;
        onInteract(id);
      }}
    >
      {/* 글로우 레이어 밖: 표식은 아웃라인 선택 대상이 아니다 */}
      <MemoryBeacon
        id={id}
        color={palette.memory}
        active={status === "available" && !liveCanvasMinigame && !firstPerson}
        near={nearbyMemoryId === id}
        groundOffset={placement.position[1]}
      />
      {liveCanvasMinigame ? null : (
        <MemoryGlowLayers
          selectionKey={`memory-${id}`}
          enabled={highlighted}
          selectionVersion={selectionVersion}
          visual={
            // 호버 판정은 실제 모델에만 건다. 아래 memory-hit 구는 반경이 커서 호버 대상이 되면 안 된다.
            // motionRef 그룹이 뜨고 눌리는 변형을 맡는다 (판정용 구는 여기 들어오지 않는다).
            <group ref={motionRef}>
              <group rotation={placement.rotation} scale={placement.scale} {...handlers}>
                <CollectedTint
                  collected={status === "done"}
                  memoryColor={palette.memory}
                  revision={selectionVersion}
                >
                  <MemoryVisual
                    id={id}
                    palette={palette}
                    opacity={opacity}
                    onModelReady={refreshSelection}
                  />
                </CollectedTint>
              </group>
            </group>
          }
          helpers={
            /*
             * 수집 완료 표시는 3D에 그리지 않는다. 우측 "기억 수집" 패널이 담당한다.
             *
             * 판정 구는 눌러서 뭔가 일어날 때만 세운다. 끝난 기억·잠긴 기억까지 구를
             * 들고 있으면 옆 물건의 클릭을 삼킨다: 신발장 앞 신발(반경 1.45)이 현관
             * 배트(1.35)와 거의 한 덩어리로 겹쳐, 다 모은 뒤 배트를 눌러도 신발이
             * "이미 본 기억"으로 받아 버렸다. r3f는 카메라에 가까운 교차부터 부르고
             * stopPropagation에서 멈추므로 뒤의 배트는 이벤트를 아예 못 본다.
             * 끝난 기억의 혼잣말·잠긴 컴퓨터의 한 줄은 실물을 눌렀을 때만 나온다.
             */
            clickable ? (
              <mesh name={`memory-hit-${id}`}>
                <sphereGeometry args={[hitRadiusOf(placement), 12, 8]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            ) : null
          }
        />
      )}
    </group>
  );
}

/**
 * 한 공간의 기억들. 씬이 방과 거실을 갈라 그리므로(한 번에 한 방만 보인다)
 * 여기도 공간으로 갈라 낸다. 거실 물건이 방 트리에 섞이면 벽 너머에 떠 있는
 * 유령이 되고, 근접 판정도 벽을 뚫고 잡힌다.
 */
export function MemoryObjects({
  space,
  palette,
  nearbyMemoryId,
  onInteract,
}: {
  space: MemorySpace;
  palette: RoomPalette;
  nearbyMemoryId: MemoryId | null;
  onInteract: (id: MemoryId) => void;
}) {
  return (
    <group name={`memory-objects-${space}`}>
      {MEMORIES.filter((memory) => MEMORY_SPACE[memory.id] === space).map((memory) => (
        <InteractiveMemory
          key={memory.id}
          id={memory.id}
          palette={palette}
          nearbyMemoryId={nearbyMemoryId}
          onInteract={onInteract}
        />
      ))}
    </group>
  );
}
