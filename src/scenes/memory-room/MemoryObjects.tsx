import { Edges, useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import {
  Component,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { AdditiveBlending, Color, type Material, type Mesh } from "three";
import { MEMORIES, type MemoryId } from "@/data/memory-room";
import { ASSETS } from "@/lib/assets";
import { hotspotStatus, useMemoryRoomStore } from "@/store/memory-room";
import { MEMORY_PLACEMENTS } from "./layout";
import type { RoomPalette } from "./palette";
import { shouldHighlightMemory } from "./visual-state";

const MODEL_PATHS = {
  bat: ASSETS.models.baseballBat,
  ball: ASSETS.models.baseball,
  frame: ASSETS.models.photoFrame,
} as const satisfies Partial<Record<MemoryId, string>>;

const HIGHLIGHT_BOUNDS = {
  bat: [0.42, 1.25, 0.42],
  window: [2.68, 2.22, 0.16],
  frame: [1.22, 0.72, 0.88],
  radio: [1.08, 0.95, 0.58],
  phone: [0.66, 0.92, 0.34],
  calendar: [0.98, 1.16, 0.14],
  ball: [2.18, 2.18, 2.18],
} as const satisfies Record<MemoryId, readonly [number, number, number]>;

const GLOW_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const GLOW_FRAGMENT_SHADER = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
    float rim = pow(1.0 - facing, 2.2);
    float softGlow = smoothstep(0.05, 1.0, rim);
    gl_FragColor = vec4(glowColor, softGlow * 0.5);
  }
`;

for (const path of Object.values(MODEL_PATHS)) {
  // Drei enables Meshopt by default; passing `true` keeps that decoder requirement explicit.
  useGLTF.preload(path, true, true);
}

interface ModelErrorBoundaryState {
  failed: boolean;
}

class ModelErrorBoundary extends Component<
  PropsWithChildren<{ fallback: ReactNode }>,
  ModelErrorBoundaryState
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
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
    return copy;
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
}: {
  path: string;
  fallback: ReactNode;
  opacity: number;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedGlb path={path} opacity={opacity} />
      </Suspense>
    </ModelErrorBoundary>
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
      <meshStandardMaterial color={palette.bone} roughness={0.72} opacity={opacity} transparent />
    </mesh>
  );
}

function Ball({ palette, opacity }: VisualProps) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color={palette.paper} roughness={0.65} opacity={opacity} transparent />
    </mesh>
  );
}

function Frame({ palette, opacity }: VisualProps) {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[1.05, 0.08, 0.72]} />
        <meshStandardMaterial color={palette.ink} roughness={0.7} opacity={opacity} transparent />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.85, 0.54]} />
        <meshStandardMaterial color={palette.paper} roughness={0.9} opacity={opacity} transparent />
      </mesh>
    </group>
  );
}

function FramePhotoFace({ palette, opacity }: VisualProps) {
  return (
    <mesh position={[-0.56, 0.38, 0.47]}>
      <planeGeometry args={[0.94, 0.46]} />
      <meshStandardMaterial
        color={palette.paper}
        emissive={palette.paper}
        emissiveIntensity={0.08}
        roughness={0.82}
        opacity={opacity}
        transparent
      />
    </mesh>
  );
}

function WindowMemory({ palette, opacity }: VisualProps) {
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[2.55, 2.1]} />
      <meshStandardMaterial
        color={palette.paper}
        emissive={palette.memory}
        emissiveIntensity={0.12}
        opacity={0.22 * opacity}
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
        <meshStandardMaterial color={palette.ink} roughness={0.68} opacity={opacity} transparent />
      </mesh>
      {[-0.23, 0.23].map((x) => (
        <mesh key={x} position={[x, 0.29, 0.215]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
          <meshStandardMaterial
            color={palette.bone}
            roughness={0.6}
            opacity={opacity}
            transparent
          />
        </mesh>
      ))}
      <mesh position={[0.3, 0.78, 0]} rotation={[0, 0, -0.42]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.62, 8]} />
        <meshStandardMaterial color={palette.ember} roughness={0.5} opacity={opacity} transparent />
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
          transparent
        />
      </mesh>
      <mesh position={[0, 0.37, 0.085]}>
        <planeGeometry args={[0.37, 0.52]} />
        <meshStandardMaterial
          color={palette.paper}
          roughness={0.45}
          opacity={opacity}
          transparent
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
          transparent
        />
      </mesh>
      <mesh position={[0, 0.37, 0.04]}>
        <planeGeometry args={[0.82, 0.24]} />
        <meshStandardMaterial
          color={palette.ember}
          roughness={0.75}
          opacity={opacity}
          transparent
        />
      </mesh>
      {CALENDAR_DOTS.map((dot) => (
        <mesh key={`${dot.x}:${dot.y}`} position={[dot.x, dot.y, 0.045]}>
          <circleGeometry args={[0.026, 10]} />
          <meshStandardMaterial color={palette.ink} roughness={0.8} opacity={opacity} transparent />
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

function MemoryVisual({ id, palette, opacity }: VisualProps & { id: MemoryId }) {
  const fallback = <PrimitiveVisual id={id} palette={palette} opacity={opacity} />;
  const modelPath = MODEL_PATHS[id as keyof typeof MODEL_PATHS];
  return modelPath ? (
    <group>
      <GlbMemoryModel path={modelPath} fallback={fallback} opacity={opacity} />
      {id === "frame" ? <FramePhotoFace palette={palette} opacity={opacity} /> : null}
    </group>
  ) : (
    fallback
  );
}

function ActiveBorder({ id, color }: { id: MemoryId; color: string }) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new Color(color) },
    }),
    [color],
  );

  return (
    <mesh scale={1.08}>
      <boxGeometry args={HIGHLIGHT_BOUNDS[id]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={GLOW_VERTEX_SHADER}
        fragmentShader={GLOW_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={AdditiveBlending}
      />
      <Edges scale={1.01} color={color} lineWidth={1.6} transparent opacity={0.95} />
      <Edges scale={1.075} color={color} lineWidth={2.2} transparent opacity={0.32} />
      <Edges scale={1.15} color={color} lineWidth={2.8} transparent opacity={0.1} />
    </mesh>
  );
}

function StatusEffect({
  status,
  highlighted,
  palette,
  interactionRadius,
}: {
  status: ReturnType<typeof hotspotStatus>;
  highlighted: boolean;
  palette: RoomPalette;
  interactionRadius: number;
}) {
  if (status === "available" && highlighted) {
    return <pointLight color={palette.memory} intensity={3.2} distance={3.4} decay={2} />;
  }
  if (status === "done") {
    return (
      <mesh>
        <torusGeometry args={[interactionRadius * 0.52, 0.025, 8, 32]} />
        <meshStandardMaterial
          color={palette.memory}
          emissive={palette.memory}
          emissiveIntensity={0.2}
          opacity={0.62}
          transparent
        />
      </mesh>
    );
  }
  return null;
}

function InteractiveMemory({
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
  const highlighted = shouldHighlightMemory(status, id, nearbyMemoryId);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group is a Canvas pointer target, not a DOM element.
    <group
      name={`memory-${id}`}
      position={placement.position}
      onClick={(event) => {
        event.stopPropagation();
        if (status === "available") onInteract(id);
      }}
    >
      <group rotation={placement.rotation} scale={placement.scale}>
        <MemoryVisual id={id} palette={palette} opacity={opacity} />
        {highlighted ? <ActiveBorder id={id} color={palette.memory} /> : null}
      </group>
      <StatusEffect
        status={status}
        highlighted={highlighted}
        palette={palette}
        interactionRadius={placement.interactionRadius}
      />
      <mesh>
        <sphereGeometry args={[placement.interactionRadius, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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
