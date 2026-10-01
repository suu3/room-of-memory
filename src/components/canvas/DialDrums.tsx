"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  type Group,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { type RoomPalette, resolveRoomPalette } from "@/scenes/memory-room/world/palette";

/**
 * 세면대 하부장의 숫자 드럼 (v4.1 6장: 하부장 다이얼 [3D]).
 *
 * 가로로 누운 원통이 자리수만큼 나란히 선다. 옆면 띠에 0~9가 한 바퀴 적혀 있고, 원통을
 * x축으로 굴리면 앞을 향한 숫자가 바뀐다. 숫자 i는 띠의 u = i/10에 있어 rotation.x가
 * i·2π/10일 때 카메라를 본다. 위의 숫자(i+1)가 굴러 내려와 들어온다: 엄지로 내리는
 * 방향이 +1이다.
 *
 * 각도는 부르는 쪽이 쥔다. `steps`는 한 칸씩 쌓인 누적 눈금이라 9→0에서 거꾸로
 * 한 바퀴 돌지 않는다. `dragRef`는 끄는 중인 칸의 덜 넘어간 몫(-1~1)이다.
 */

const DIGITS = 10;
const STEP_ANGLE = (Math.PI * 2) / DIGITS;
const RADIUS = 0.34;
const LENGTH = 0.42;
const GAP = 0.14;
const TURN_DAMP = 16;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 192;

function bodyFont(): string {
  try {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

/** 띠 한 바퀴에 0~9를 그린다. 캔버스 x가 화면 위, 캔버스 y가 화면 오른쪽이라 글자를 90° 눕힌다. */
function paintBand(ctx: CanvasRenderingContext2D, palette: RoomPalette, font: string) {
  const cell = TEXTURE_WIDTH / DIGITS;
  ctx.fillStyle = palette.linen;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.strokeStyle = palette.trim;
  ctx.lineWidth = 3;
  for (let i = 0; i <= DIGITS; i++) {
    const x = (i + 0.5) * cell;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, TEXTURE_HEIGHT - 10);
    ctx.stroke();
  }
  ctx.fillStyle = palette.coal;
  ctx.font = `700 ${Math.round(cell * 0.8)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // 0은 이음매에 걸쳐 있어 양 끝에 한 번씩 그린다
  for (let i = 0; i <= DIGITS; i++) {
    ctx.save();
    ctx.translate(i * cell, TEXTURE_HEIGHT / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(String(i % DIGITS), 0, cell * 0.04);
    ctx.restore();
  }
}

function Drums({
  steps,
  dragRef,
  focus,
  solved,
}: {
  steps: readonly number[];
  dragRef: MutableRefObject<number[]>;
  focus: number;
  solved: boolean;
}) {
  const palette = useMemo(resolveRoomPalette, []);
  const font = useMemo(bodyFont, []);
  const meshes = useRef<(Group | null)[]>([]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const band = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx && typeof ctx.fillRect === "function") paintBand(ctx, palette, font);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }, [palette, font]);

  const materials = useMemo(() => {
    const cap = new MeshStandardMaterial({ color: palette.frame, roughness: 0.6, metalness: 0.3 });
    const side = new MeshStandardMaterial({ map: band, roughness: 0.55 });
    return [side, cap, cap];
  }, [palette, band]);

  useEffect(
    () => () => {
      band.dispose();
      for (const material of new Set(materials)) material.dispose();
    },
    [band, materials],
  );

  useFrame((_, delta) => {
    const ease = 1 - Math.exp(-TURN_DAMP * delta);
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return;
      const target = ((stepsRef.current[index] ?? 0) + (dragRef.current[index] ?? 0)) * STEP_ANGLE;
      mesh.rotation.x += (target - mesh.rotation.x) * ease;
    });
  });

  const offset = ((steps.length - 1) * (LENGTH + GAP)) / 2;
  return (
    <>
      {steps.map((_, index) => (
        <group
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정 자리수 드럼
          key={index}
          position={[index * (LENGTH + GAP) - offset, 0, 0]}
        >
          {/* 축을 x로 눕힌다: 원통의 윗면이 왼쪽을 본다 */}
          <group
            ref={(group) => {
              meshes.current[index] = group;
            }}
          >
            <mesh material={materials} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[RADIUS, RADIUS, LENGTH, 48]} />
            </mesh>
          </group>
          {/* 고른 칸 아래의 눈금 표식. 맞추면 앰버로 */}
          <mesh position={[0, -RADIUS - 0.07, 0.2]}>
            <boxGeometry args={[LENGTH * 0.7, 0.025, 0.02]} />
            <meshStandardMaterial
              color={solved ? palette.memory : index === focus ? palette.coal : palette.trim}
              emissive={solved ? palette.memory : "#000000"}
              emissiveIntensity={solved ? 0.6 : 0}
            />
          </mesh>
        </group>
      ))}
      {/* 하부장 문의 판: 드럼이 박혀 있는 자리 */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[steps.length * (LENGTH + GAP) + 0.2, RADIUS * 2 + 0.34, 0.1]} />
        <meshStandardMaterial color={palette.wood} roughness={0.8} />
      </mesh>
    </>
  );
}

export default function DialDrums(props: {
  /** 칸마다 쌓인 눈금 (한 칸 = 숫자 하나). 숫자는 steps mod 10. */
  steps: readonly number[];
  /** 끄는 중인 칸의 덜 넘어간 몫. */
  dragRef: MutableRefObject<number[]>;
  focus: number;
  solved: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.1, 2.3], fov: 32 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.5} />
      <directionalLight position={[-2, -1, 2]} intensity={0.4} />
      <Drums {...props} />
    </Canvas>
  );
}
