import { useGLTF } from "@react-three/drei";
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
import type { Color, Group, Material, Mesh, MeshStandardMaterial, PointLight } from "three";
import { MEMORIES, type MemoryId, phaseConfigOf } from "@/data/memory-room";
import { CLUE_AFTER_MEMORY, type ClueId } from "@/data/room-clues";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import {
  gamePhaseOf,
  hotspotStatus,
  selectRadioSignaling,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { ballSeamGeometry } from "./ball-seam";
import { toLitMaterial } from "./FurnitureModel";
import { MEMORY_PLACEMENTS, MEMORY_SPACE, type MemorySpace } from "./layout";
import { MemoryBeacon } from "./MemoryBeacon";
import { MemoryGlowLayers, MemoryGlowVisualBoundary } from "./MemoryOutlineGlow";
import { approach, HOVER_LAMBDA, memoryMotion, PUNCH_DURATION } from "./memory-motion";
import { centerModelXZ } from "./model-utils";
import type { RoomPalette } from "./palette";
import { radioSignalLevel } from "./radio-signal";
import type { Vec3Tuple } from "./types";
import { useCoverTexture } from "./use-cover-texture";
import { useGlowHover } from "./use-glow-hover";
import { memoryOpacity, shouldHighlightMemory } from "./visual-state";

// 액자 glb(ch1-photo-frame)는 액자가 아니라 납작한 오각형 판때기라 지웠다.
// 제대로 된 액자 glb가 들어오면 frame 키를 다시 추가할 것.
const MODEL_PATHS = {
  ball: ASSETS.models.baseball,
  radio: ASSETS.models.radio,
} as const satisfies Partial<Record<MemoryId, string>>;

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
 * 조사 완료 표시 — 회색으로 죽이는 대신 금빛을 켜 둔다.
 * DESIGN.md의 핵심 연출이 "기억을 모을수록 화면에서 금빛 비중이 늘어나는 것"이라,
 * 수집한 오브젝트에서 색을 빼면 연출이 정반대로 간다.
 */
const COLLECTED_EMISSIVE_INTENSITY = 0.42;

interface EmissiveBaseline {
  color: number;
  intensity: number;
}

/** 원래 이미시브 값을 재질별로 기억해 둔다 — 해제할 때 그대로 되돌리기 위해서. */
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
   * 그대로 반영된다 — needsUpdate를 걸면 셰이더가 통째로 재컴파일되면서 수집
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

function LoadedGlb({ path, opacity, lit }: { path: string; opacity: number; lit?: boolean }) {
  // The third argument explicitly enables the MeshoptDecoder configured by Drei's useGLTF.
  const { scene } = useGLTF(path, true, true);
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // 가구킷은 unlit이라 방 조명을 무시한다 — lit이면 조명 받는 재질로 갈아끼운다.
      const remake = lit ? toLitMaterial : (material: Material) => material.clone();
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(remake)
        : remake(mesh.material);
    });
    // 일부 glb는 원점이 모서리에 있다 — 배치 좌표가 중심을 뜻하도록 맞춘다.
    return centerModelXZ(copy);
  }, [scene, lit]);

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
  path,
  fallback,
  opacity,
  onReady,
}: {
  path: string;
  fallback: ReactNode;
  opacity: number;
  onReady: () => void;
}) {
  return (
    <MemoryGlowVisualBoundary fallback={fallback} onVisible={onReady}>
      <LoadedGlb path={path} opacity={opacity} />
    </MemoryGlowVisualBoundary>
  );
}

interface VisualProps {
  palette: RoomPalette;
  opacity: number;
}

/**
 * 러그 위에 던져둔 휴대용 게임기. 몸통 · 화면 · 십자키 · 버튼 두 개.
 * 방의 다른 소품과 같은 박스 조형으로 짜서 따로 놀지 않게 했다.
 */
function Console({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group rotation={[-Math.PI / 2 + 0.16, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.46, 0.26, 0.05]} />
        <meshStandardMaterial
          color={palette.slate}
          roughness={0.5}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 켜진 화면 — 어두운 방에서 이 물건만 작게 빛난다 */}
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[0.24, 0.17]} />
        <meshStandardMaterial
          color={palette.paper}
          emissive={palette.memory}
          emissiveIntensity={0.35}
          roughness={0.4}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      <mesh position={[-0.16, 0, 0.028]}>
        <boxGeometry args={[0.075, 0.075, 0.012]} />
        <meshStandardMaterial
          color={palette.ink}
          roughness={0.6}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {[-0.03, 0.03].map((offset) => (
        <mesh key={offset} position={[0.16, offset, 0.028]}>
          <cylinderGeometry args={[0.022, 0.022, 0.012, 10]} />
          <meshStandardMaterial
            color={palette.ember}
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
        color={palette.paper}
        roughness={0.65}
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/** 실밥이 어디를 지나는지는 ball-seam.ts가 정한다 — glb 표면에 파인 홈을 따른다. */
function BallSeam({ palette, opacity }: VisualProps) {
  const geometry = useMemo(ballSeamGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={palette.ember}
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
 * 묻힌) 버전이다 — 닦아서 드러나는 것이 이 오브젝트의 이야기라, 방에 서 있는 액자가
 * 미리 다 보여주면 닦을 이유가 없다. 다 닦고 나면 방의 액자도 드러난 사진으로 남는다:
 * 되찾은 기억이 미니게임 화면 안에서만 살아 있으면 방은 아무것도 달라지지 않는다.
 */
function Frame({ palette, opacity }: VisualProps) {
  const revealed = useMemoryRoomStore((state) => state.revisited.includes("frame"));
  /*
   * 잘려 나가는 정도가 두 그림이 다르다. 1차(1.32:1)는 액자 구멍(1.39:1)과 비슷해
   * 위아래로 5%쯤만 깎이고, 2차(1.09:1)는 훨씬 세로로 길어 22%쯤 깎인다. 둘 다
   * 얼굴은 가운데 세로 절반 안에 있어 남는다 — 잘리는 건 위쪽 배경과 아래쪽 메달이다.
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
            color={palette.bone}
            roughness={0.62}
            opacity={opacity}
            transparent={opacity < 1}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, -FRAME_DEPTH / 2]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, FRAME_HEIGHT, 0.012]} />
        <meshStandardMaterial
          color={palette.ink}
          roughness={0.75}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {/*
        사진면. map이 붙기 전(로드 중이거나 파일이 없을 때)에는 종이색 판이 그대로
        보인다 — 예전 모습 그대로라 사진이 늦게 와도 액자가 비어 보이지 않는다.

        색은 map에 곱해지므로 종이색이 사진 위에 옅은 크림 베일로 남는다. 흰색으로
        빼지 않는 건, 바랜 세피아가 이 방의 톤이고 팔레트 밖 값을 새로 만들지
        않기 위해서다 (DESIGN.md).
      */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[FRAME_OPENING_WIDTH, FRAME_OPENING_HEIGHT]} />
        <meshStandardMaterial
          map={photo}
          color={palette.paper}
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
          color={palette.ink}
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
 * (판 자체는 지울 수 없다 — 아웃라인 글로우가 이 메쉬를 윤곽으로 쓴다.)
 */
function WindowMemory({ palette, opacity }: VisualProps) {
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[2.55, 2.1]} />
      <meshStandardMaterial
        color={palette.bone}
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
          color={palette.ink}
          roughness={0.68}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {[-0.23, 0.23].map((x) => (
        <mesh key={x} position={[x, 0.29, 0.215]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
          <meshStandardMaterial
            color={palette.bone}
            roughness={0.6}
            opacity={opacity}
            transparent={opacity < 1}
          />
        </mesh>
      ))}
      <mesh position={[0.3, 0.78, 0]} rotation={[0, 0, -0.42]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.62, 8]} />
        <meshStandardMaterial
          color={palette.ember}
          roughness={0.5}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
    </group>
  );
}

/**
 * 신호등이 앉는 자리 — 라디오 표시창 언저리(로컬 좌표).
 * 배치 스케일(layout의 radio.scale)이 그대로 곱해지므로 glb 원본 크기 기준이다.
 */
const RADIO_SIGNAL_POSITION: Vec3Tuple = [0, 0.15, 0.11];
/** 표시등 반경. 판이 아니라 구라 라디오를 어느 각도에서 봐도 보인다. */
const RADIO_SIGNAL_RADIUS = 0.022;
/** 깜빡임이 방으로 새어 나가는 정도. 방 조명(1.15~5.6)에 비해 아주 작다. */
const RADIO_SIGNAL_LIGHT = 1.6;

/**
 * 재난방송이 끊긴 뒤, 도해가 만지지도 않았는데 저 혼자 지직거리는 라디오.
 *
 * 2바퀴의 문은 "다시 조사해 보자"가 아니라 "라디오가 먼저 말을 건다"로 열린다.
 * 그래서 이 깜빡임은 조사 가능 표식(금빛 외곽선·비컨)과 별개다 — 표식은 플레이어에게
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
    if (lightRef.current) lightRef.current.intensity = level * RADIO_SIGNAL_LIGHT;
  });

  if (!signaling) return null;

  return (
    <group position={RADIO_SIGNAL_POSITION}>
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
      <pointLight ref={lightRef} color={palette.ember} intensity={0} distance={1.8} decay={2} />
    </group>
  );
}

function PhoneMemory({ palette, opacity }: VisualProps) {
  return (
    <group rotation={[-0.18, 0, 0]}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.48, 0.72, 0.16]} />
        <meshStandardMaterial
          color={palette.slate}
          roughness={0.55}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      <mesh position={[0, 0.37, 0.085]}>
        <planeGeometry args={[0.37, 0.52]} />
        <meshStandardMaterial
          color={palette.paper}
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
          color={palette.paper}
          roughness={0.92}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      <mesh position={[0, 0.37, 0.04]}>
        <planeGeometry args={[0.82, 0.24]} />
        <meshStandardMaterial
          color={palette.ember}
          roughness={0.75}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {CALENDAR_DOTS.map((dot) => (
        <mesh key={`${dot.x}:${dot.y}`} position={[dot.x, dot.y, 0.045]}>
          <circleGeometry args={[0.026, 10]} />
          <meshStandardMaterial
            color={palette.ink}
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
 * 컴퓨터 세트의 부품 배치 — 앵커(MEMORY_PLACEMENTS.computer) 기준 로컬 오프셋.
 * 값은 예전 DeskAccessories가 책상 로컬로 들고 있던 좌표에서 앵커만큼 뺀 것이라,
 * 월드에서는 가구였을 때와 같은 자리에 선다. 배율도 책상 소품 공통값(3.1) 그대로.
 */
const COMPUTER_PROP_SCALE = 3.1;
const COMPUTER_PARTS = [
  { path: ASSETS.models.computerScreen, offset: [-0.15, 0, -0.46] },
  { path: ASSETS.models.computerKeyboard, offset: [-0.1, 0, 0.22] },
  { path: ASSETS.models.computerMouse, offset: [0.62, 0, 0.24] },
] as const satisfies readonly { path: string; offset: Vec3Tuple }[];

/** glb가 오기 전의 컴퓨터 — 모니터 판과 키보드 슬래브만 세운 대역. */
function ComputerPrimitive({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group>
      <group position={COMPUTER_PARTS[0].offset}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.95, 0.62, 0.07]} />
          <meshStandardMaterial
            color={palette.slate}
            roughness={0.55}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
        {/* 꺼진 모니터 — 어두운 유리에 방의 빛만 살짝 어린다 */}
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
            color={palette.slate}
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
            color={palette.bone}
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
 * 책상 위 컴퓨터 — 한 기억이 glb 세 개(모니터·키보드·마우스)로 이루어진다.
 * 가구였을 때(DeskAccessories)와 같은 킷·같은 자리라, 승격 전후로 방이 달라
 * 보이지 않는다. 가구킷은 unlit이라 lit 변환을 거친다.
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
      </group>
    </MemoryGlowVisualBoundary>
  );
}

/*
 * ── 거실의 기억 (2막) ──────────────────────────────────────────────
 *
 * 셋은 이미 서 있는 가구를 만진다 (냉장고 문·아래칸, 신발장 문). 가구를 복제하지
 * 않고 **여는 면의 테두리만** 가는 막대 넷으로 긋는다 — 평소엔 가구와 같은 색이라
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

/** 냉장실 문 — 열면 아직 반이나 남은 식량이 나온다. */
function FridgeDoorMemory({ palette, opacity }: VisualProps) {
  return <DoorOutline width={0.86} height={0.7} color={palette.paper} opacity={opacity} />;
}

/** 냉장고 아래칸 — "손대지 마"라던 칸. 앰플이 여기 있다. */
function FridgeDrawerMemory({ palette, opacity }: VisualProps) {
  return <DoorOutline width={0.86} height={0.38} color={palette.paper} opacity={opacity} />;
}

/** 신발장 문 — 두고 간 등산화가 그대로 있다. */
function ShoeCabinetMemory({ palette, opacity }: VisualProps) {
  return <DoorOutline width={1.7} height={0.86} color={palette.dusk} opacity={opacity} />;
}

/**
 * 식탁에 펼쳐진 트럼프 — 넷이서 치다 만 판이 그대로다.
 *
 * 원래 거실 가구(LivingRoomFurniture의 TableCards)가 미궁 문제(activePuzzle)로
 * 열던 물건인데, 2막 추리 체인의 한 칸이 되면서 기억으로 올라왔다. 미궁 축을
 * 따로 둘 이유가 사라졌다 — 카드는 이제 대사도 기록도 남긴다.
 */
function TableCardsMemory({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group>
      {/* 덱 — 반쯤 남은 더미 */}
      <mesh position={[-0.15, 0.025, -0.02]} castShadow>
        <boxGeometry args={[0.2, 0.05, 0.28]} />
        <meshStandardMaterial
          color={palette.bone}
          roughness={0.7}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {SPREAD_CARDS.map(([x, z, turn]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.004, z]} rotation={[0, turn, 0]} castShadow>
          <boxGeometry args={[0.18, 0.008, 0.26]} />
          <meshStandardMaterial
            color={palette.paper}
            roughness={0.7}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      ))}
    </group>
  );
}

/** 흩어진 카드들 — 식탁 상판 중심 기준의 [x, z, y회전]. */
const SPREAD_CARDS = [
  [-0.3, -0.25, 0.3],
  [-0.1, 0.3, -0.5],
  [0.25, 0.15, 0.9],
  [0.3, -0.3, -0.15],
] as const;

/**
 * 소파 앞에 던져둔 야구 가방 — 비우고 다시 싸는 물건.
 *
 * 거실에서 유일하게 새로 서는 기억이다. 나머지는 이미 있던 가구를 다시 보는
 * 것이지만, 나갈 준비는 없던 행동이라 없던 물건이 필요하다.
 */
function DuffelMemory({ palette, opacity }: VisualProps) {
  const transparent = opacity < 1;
  return (
    <group>
      {/* 몸통 — 눕힌 원통이 천 가방의 처진 실루엣에 가장 가깝다 */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.62, 12]} />
        <meshStandardMaterial
          color={palette.olive ?? palette.dusk}
          roughness={0.9}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 어깨끈 — 몸통 위를 가로지른다 */}
      <mesh position={[0, 0.16, 0]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.09]} />
        <meshStandardMaterial
          color={palette.ink}
          roughness={0.85}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 지퍼 — 몸통 위쪽을 따라 난 줄 하나 */}
      <mesh position={[0, 0.185, 0.03]} castShadow={false}>
        <boxGeometry args={[0.56, 0.012, 0.02]} />
        <meshStandardMaterial
          color={palette.bone}
          roughness={0.6}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 옆주머니 — 가방 한쪽 끝에 덧댄 천 */}
      <mesh position={[-0.28, -0.02, 0.02]} castShadow>
        <boxGeometry args={[0.1, 0.24, 0.3]} />
        <meshStandardMaterial
          color={palette.slate}
          roughness={0.9}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
    </group>
  );
}

function PrimitiveVisual({ id, palette, opacity }: VisualProps & { id: MemoryId }) {
  switch (id) {
    case "console":
      return <Console palette={palette} opacity={opacity} />;
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
      return <DuffelMemory palette={palette} opacity={opacity} />;
    case "shoes":
      return <ShoeCabinetMemory palette={palette} opacity={opacity} />;
    case "cards":
      return <TableCardsMemory palette={palette} opacity={opacity} />;
    case "ampoule":
      return <FridgeDrawerMemory palette={palette} opacity={opacity} />;
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
  /* 모델 위에 코드로 덧입히는 것들 — glb가 아직 안 왔어도 fallback 위에 그대로 얹힌다. */
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
        path={modelPath}
        fallback={fallback}
        opacity={opacity}
        onReady={onModelReady}
      />
      {overlays}
    </>
  );
}

/**
 * 자식 메쉬 전체에 수집 완료 톤을 입힌다. 프리미티브든 glb든 결국 three 재질이라
 * 트래버스 한 번으로 처리된다 — 시각 요소마다 emissive prop을 뿌리지 않는다.
 */
function CollectedTint({
  collected,
  memoryColor,
  revision,
  children,
}: {
  collected: boolean;
  memoryColor: string;
  /** glb는 늦게 붙는다 — 로드 완료 때 값이 바뀌면서 다시 칠하게 하는 신호. */
  revision: number;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision은 본문에서 읽지 않고 재실행 신호로만 쓴다 — glb가 늦게 붙으면 그때 다시 칠해야 한다.
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
  /*
   * 조사를 마친 뒤 배경 오브젝트로 내려앉는 기억(달력)이 있다. 조사가 끝나도
   * 벽에 걸린 물건이라, 누르면 그때 본 것을 다시 펼쳐 준다 — 컴퓨터 비밀번호를
   * 잊었을 때 달력을 다시 볼 유일한 길이다 (src/data/room-clues.ts).
   */
  const backgroundClue = status === "done" ? BACKGROUND_CLUE[id] : undefined;
  const placement = MEMORY_PLACEMENTS[id];
  /*
   * 이 바퀴에 있는 기억인가 — 흐림을 줄지 정한다 (visual-state의 memoryOpacity).
   *
   * 2바퀴는 문이 열려야 시작한다(selectDoorReady 주석) — 문이 열리기 전의 방은
   * 아직 1바퀴 끝자락이라 흐림("곧 열릴 물건" 신호)을 걸지 않는다. 이때 걸면
   * 가장 어두운 방에서 어두운 물건이 0.45로 내려가 그냥 없는 물건으로 읽힌다
   * (책상 위 컴퓨터가 통째로 사라져 보이던 원인).
   */
  const inThisRound = useMemoryRoomStore((state) => {
    const gamePhase = gamePhaseOf(state);
    if (!phaseConfigOf(id, gamePhase)) return false;
    return gamePhase === 1 || state.doorOpened;
  });
  const opacity = memoryOpacity(status, inThisRound);
  const clickable = status === "available" || backgroundClue !== undefined;
  const { hovered, handlers } = useGlowHover(clickable);
  const highlighted = shouldHighlightMemory(status, id, nearbyMemoryId, hovered);
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
          }
          return;
        }
        punchRef.current = 0;
        onInteract(id);
      }}
    >
      {/* 글로우 레이어 밖 — 표식은 아웃라인 선택 대상이 아니다 */}
      <MemoryBeacon
        id={id}
        color={palette.memory}
        active={status === "available"}
        near={nearbyMemoryId === id}
        groundOffset={placement.position[1]}
      />
      <MemoryGlowLayers
        selectionKey={`memory-${id}`}
        enabled={highlighted}
        selectionVersion={selectionVersion}
        visual={
          // 호버 판정은 실제 모델에만 건다 — 아래 memory-hit 구는 반경이 커서 호버 대상이 되면 안 된다.
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
          // 수집 완료 표시는 3D에 그리지 않는다 — 우측 "기억 수집" 패널이 담당한다.
          <mesh name={`memory-hit-${id}`}>
            <sphereGeometry args={[placement.interactionRadius, 12, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        }
      />
    </group>
  );
}

/**
 * 한 공간의 기억들. 씬이 방과 거실을 갈라 그리므로(한 번에 한 방만 보인다)
 * 여기도 공간으로 갈라 낸다 — 거실 물건이 방 트리에 섞이면 벽 너머에 떠 있는
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
