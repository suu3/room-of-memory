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
import {
  CatmullRomCurve3,
  type Color,
  type Group,
  type Material,
  type Mesh,
  TubeGeometry,
  Vector3,
} from "three";
import { MEMORIES, type MemoryId } from "@/data/memory-room";
import { ASSETS } from "@/lib/assets";
import { hotspotStatus, useMemoryRoomStore } from "@/store/memory-room";
import { MEMORY_PLACEMENTS } from "./layout";
import { MemoryGlowLayers, MemoryGlowVisualBoundary } from "./MemoryOutlineGlow";
import { approach, HOVER_LAMBDA, memoryMotion, PUNCH_DURATION } from "./memory-motion";
import { centerModelXZ } from "./model-utils";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { shouldHighlightMemory } from "./visual-state";

// 액자 glb(ch1-photo-frame)는 액자가 아니라 납작한 오각형 판때기라 지웠다.
// 제대로 된 액자 glb가 들어오면 frame 키를 다시 추가할 것.
const MODEL_PATHS = {
  bat: ASSETS.models.baseballBat,
  ball: ASSETS.models.baseball,
  radio: ASSETS.models.radio,
} as const satisfies Partial<Record<MemoryId, string>>;

for (const path of Object.values(MODEL_PATHS)) {
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
  material.needsUpdate = true;
}

function setMaterialOpacity(material: Material, opacity: number) {
  material.opacity = opacity;
  material.transparent = opacity < 1;
  material.depthWrite = opacity === 1;
  material.needsUpdate = true;
}

function LoadedGlb({ path, opacity }: { path: string; opacity: number }) {
  // The third argument explicitly enables the MeshoptDecoder configured by Drei's useGLTF.
  const { scene } = useGLTF(path, true, true);
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    });
    // 일부 glb는 원점이 모서리에 있다 — 배치 좌표가 중심을 뜻하도록 맞춘다.
    return centerModelXZ(copy);
  }, [scene]);

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

function Bat({ palette, opacity }: VisualProps) {
  return (
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[0.1, 0.9, 0.1]} />
      <meshStandardMaterial
        color={palette.bone}
        roughness={0.72}
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
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

/*
 * 야구공 실밥.
 *
 * ch1-baseball.glb 안에도 실밥 메쉬(BézierCurve, 진한 빨강)가 들어 있지만 그 메쉬를
 * 가리키는 node가 없어서 GLTFLoader가 씬 그래프에 올리지 않는다. node를 붙여 봐도
 * 정점의 평균 반지름이 0.57(공 반지름은 1)이라 대부분 공 속에 파묻히고 한 점만
 * 삐죽 나온다 — 즉 파일 안의 실밥은 손볼 수 있는 상태가 아니다. 그래서 직접 그린다.
 *
 * 아래 곡선은 야구공/테니스공 솔기의 고전적인 매개변수식이다.
 *   x = a·cos t + b·cos 3t,  y = a·sin t − b·sin 3t,  z = c·sin 2t
 * c² = 4ab 이면 x²+y²+z² = (a+b)² 로 상수가 되어 곡선이 반지름 (a+b) 구면에
 * 정확히 놓인다. a+b를 1로 잡아 glb 공(반지름 1)에 그대로 맞춘다.
 */
const SEAM_A = 0.75;
const SEAM_B = 0.25;
const SEAM_C = 2 * Math.sqrt(SEAM_A * SEAM_B);
/** 공 표면에서 살짝 띄운다 — 같은 반지름이면 면이 겹쳐 깜빡인다. */
const SEAM_SURFACE_RADIUS = 1.012;
const SEAM_TUBE_RADIUS = 0.055;
const SEAM_SAMPLES = 128;

function ballSeamGeometry() {
  const points = Array.from({ length: SEAM_SAMPLES }, (_, index) => {
    const t = (index / SEAM_SAMPLES) * Math.PI * 2;
    return new Vector3(
      SEAM_A * Math.cos(t) + SEAM_B * Math.cos(3 * t),
      SEAM_A * Math.sin(t) - SEAM_B * Math.sin(3 * t),
      SEAM_C * Math.sin(2 * t),
    ).multiplyScalar(SEAM_SURFACE_RADIUS);
  });
  const curve = new CatmullRomCurve3(points, true, "catmullrom", 0.5);
  return new TubeGeometry(curve, SEAM_SAMPLES * 2, SEAM_TUBE_RADIUS, 6, true);
}

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

function Frame({ palette, opacity }: VisualProps) {
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
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[FRAME_OPENING_WIDTH, FRAME_OPENING_HEIGHT]} />
        <meshStandardMaterial
          color={palette.paper}
          emissive={palette.memory}
          emissiveIntensity={0.1}
          roughness={0.85}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {/* 반투명 덧칠이라 transparent를 유지한다 — 대신 depthWrite를 꺼 사진면과 다투지 않게. */}
      <mesh position={[0, -FRAME_OPENING_HEIGHT * 0.28, 0.009]}>
        <planeGeometry args={[FRAME_OPENING_WIDTH, FRAME_OPENING_HEIGHT * 0.34]} />
        <meshStandardMaterial
          color={palette.ember}
          roughness={0.88}
          opacity={0.55 * opacity}
          transparent
          depthWrite={false}
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

function PrimitiveVisual({ id, palette, opacity }: VisualProps & { id: MemoryId }) {
  switch (id) {
    case "bat":
      return <Bat palette={palette} opacity={opacity} />;
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
  }
}

function MemoryVisual({
  id,
  palette,
  opacity,
  onModelReady,
}: VisualProps & { id: MemoryId; onModelReady: () => void }) {
  const fallback = <PrimitiveVisual id={id} palette={palette} opacity={opacity} />;
  const modelPath = MODEL_PATHS[id as keyof typeof MODEL_PATHS];
  if (!modelPath) return fallback;

  return (
    <>
      <GlbMemoryModel
        path={modelPath}
        fallback={fallback}
        opacity={opacity}
        onReady={onModelReady}
      />
      {/* glb에 실밥이 빠져 있어 코드로 덧입힌다. 로딩 중 fallback 구에도 그대로 얹힌다. */}
      {id === "ball" ? <BallSeam palette={palette} opacity={opacity} /> : null}
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
  const placement = MEMORY_PLACEMENTS[id];
  const opacity = status === "locked" ? 0.45 : 1;
  const { hovered, handlers } = useGlowHover(status === "available");
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
        if (status !== "available") return;
        punchRef.current = 0;
        onInteract(id);
      }}
    >
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

export function MemoryObjects({
  palette,
  nearbyMemoryId,
  onInteract,
}: {
  palette: RoomPalette;
  nearbyMemoryId: MemoryId | null;
  onInteract: (id: MemoryId) => void;
}) {
  return (
    <group name="memory-objects">
      {MEMORIES.map((memory) => (
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
