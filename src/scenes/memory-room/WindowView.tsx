import type {} from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

/*
 * 창밖 풍경.
 *
 * 아이소메트릭 카메라는 창을 비스듬히 내려다보기 때문에, 풍경을 멀리 두면 창을 통해
 * 보이는 지점이 한참 왼쪽·아래로 밀린다 (시선 방향이 대략 (-0.64, -0.38, -0.67)).
 * 그래서 원경을 진짜로 멀리 두는 대신 벽 바로 뒤에 얕은 상자로 세운다 — 무대 배경막과
 * 같은 방식이다. 깊이가 얕아야 시차가 작아 여백을 조금만 둬도 가장자리가 안 보인다.
 *
 * 여백은 방향이 있다: 시선이 -x·-y로 밀리므로 왼쪽과 아래에 넉넉히 주고,
 * 위쪽은 조금만 준다. 위로 키우면 벽 윗면(y=4.7) 너머로 넘겨다보인다.
 *
 * 회전 범위를 ±0.32rad에서 ±0.75rad로 넓히면서 여백을 전부 키웠다. 시점을 옆으로
 * 돌릴수록 시차가 커져서, 예전 값(왼쪽 1.6/오른쪽 0.25)으로는 창 구석에 배경판
 * 가장자리가 드러났다. 왼쪽 끝(x≈-3.3)은 아직 뒷벽(x≥-6) 안쪽이라 옆으로 새지 않는다.
 */
const MARGIN = { left: 3.2, right: 1.3, top: 0.28, bottom: 1.5 } as const;

/**
 * 창 중심(z=-3.88) 기준 레이어 깊이. 가장 깊은 하늘판도 0.75까지만 물러난다 —
 * 더 뒤로 보내면 카메라를 최대(±0.32rad)로 돌렸을 때 판 왼쪽 끝이 창에 걸리고,
 * 벽 윗면(y=4.7) 너머로 판 꼭대기가 넘겨다보인다.
 */
const LAYER_Z = {
  sky: -0.75,
  moon: -0.7,
  stars: -0.66,
  farRidge: -0.5,
  skyline: -0.32,
  wreck: -0.24,
  shards: -0.2,
} as const;

interface WindowViewProps {
  palette: RoomPalette;
  /** 0=평범한 야경, 1=사태 이후. 되돌아가지 않는다 (visual-state의 outsideDecay). */
  decay: number;
  /** 창 개구부의 중심과 크기 — RoomShell이 벽에 뚫은 구멍과 같아야 한다. */
  center: Vec3Tuple;
  width: number;
  height: number;
}

/**
 * 밤하늘 그라디언트 텍스처.
 *
 * 정점 색(vertexColors)으로 만들려다 실패했다 — r3f가 프롭으로 넘긴 vertexColors는
 * 재질 속성만 바꾸고 셰이더를 다시 컴파일하지 않아서 USE_COLOR 디파인이 안 켜지고,
 * 결과적으로 판이 흰색으로 나온다. WindowLight가 쓰는 캔버스 텍스처 방식을 따른다.
 */
function useSkyTexture(top: string, horizon: string, glow: string): CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(0.58, horizon);
      // 지평선 근처만 도시 불빛으로 살짝 덥힌다
      gradient.addColorStop(1, glow);
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [top, horizon, glow]);
}

/**
 * 스카이라인. 값을 난수로 뽑으면 새로고침마다 도시가 바뀌어서, 인덱스로 결정되는
 * 해시를 쓴다 — 같은 자리에 같은 건물이 선다.
 */
function hash01(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

interface Building {
  x: number;
  width: number;
  height: number;
  /** 불 켜진 창의 로컬 좌표 (건물 밑면 기준). */
  lights: readonly { x: number; y: number }[];
}

function buildSkyline(span: number, count: number, salt: number, maxHeight: number): Building[] {
  const step = span / count;
  return Array.from({ length: count }, (_, index) => {
    const width = step * (0.52 + hash01(index, salt) * 0.36);
    const height = maxHeight * (0.28 + hash01(index, salt + 1) * 0.72);
    const rows = Math.max(1, Math.round(height / 0.24) - 1);
    const lights: { x: number; y: number }[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        if (hash01(index * 37 + row * 5 + column, salt + 2) > 0.62) continue;
        lights.push({
          x: (column - 0.5) * width * 0.42,
          y: 0.14 + row * 0.24,
        });
      }
    }
    return { x: -span / 2 + step * (index + 0.5), width, height, lights };
  });
}

const WINDOW_LIGHT_SIZE = 0.045;

function Skyline({
  buildings,
  z,
  color,
  lightColor,
  showLights,
  litRatio = 1,
}: {
  buildings: readonly Building[];
  z: number;
  color: string;
  lightColor: string;
  showLights: boolean;
  /** 켜져 있는 창의 비율. 사태가 번질수록 도시가 꺼진다. */
  litRatio?: number;
}) {
  return (
    <group position={[0, 0, z]}>
      {buildings.map((building) => (
        <group key={`${building.x}:${building.width}`} position={[building.x, 0, 0]}>
          <mesh position={[0, building.height / 2, 0]}>
            <planeGeometry args={[building.width, building.height]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {showLights
            ? building.lights.map((light) => (
                <mesh
                  key={`${light.x}:${light.y}`}
                  position={[light.x, light.y, 0.01]}
                  // 어느 창이 먼저 꺼질지는 좌표 해시로 고정 — 프레임마다 깜빡이면 안 된다
                  visible={hash01(Math.round((light.x + light.y) * 1000), 7) < litRatio}
                >
                  <planeGeometry args={[WINDOW_LIGHT_SIZE, WINDOW_LIGHT_SIZE]} />
                  <meshBasicMaterial color={lightColor} />
                </mesh>
              ))
            : null}
        </group>
      ))}
    </group>
  );
}

const STAR_COUNT = 42;

function Stars({ span, height, color }: { span: number; height: number; color: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => ({
        x: (hash01(index, 3) - 0.5) * span * 0.94,
        // 좌표는 판 중심 기준. 아래쪽은 스카이라인에 가려지므로 위쪽 절반에만 뿌린다.
        y: height * (0.05 + hash01(index, 4) * 0.4),
        size: 0.016 + hash01(index, 5) * 0.022,
      })),
    [span, height],
  );

  return (
    <group>
      {stars.map((star) => (
        <mesh key={`${star.x}:${star.y}`} position={[star.x, star.y, 0.01]}>
          <planeGeometry args={[star.size, star.size]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * 사태의 흔적. 길에 처박힌 차와 흩어진 유리조각.
 *
 * 유리에 튄 핏자국도 넣어봤는데 붉은 사각형이 피로 안 읽혀서 뺐다 — 어설픈
 * 자국보다 꺼진 도시와 처박힌 차 실루엣이 할 말을 더 한다.
 *
 * 전부 불투명이다. 불투명한 하늘판 앞에 놓이는 작은 조각들이라 정렬 문제가 없다.
 */
function Aftermath({
  decay,
  palette,
  width,
  height,
}: {
  decay: number;
  palette: RoomPalette;
  width: number;
  height: number;
}) {
  const wreck = decay > 0.35;
  const shards = decay > 0.6;

  return (
    <group>
      {/* 길에 처박힌 차 — 스카이라인 앞, 지평선 위에 실루엣으로만 */}
      {wreck ? (
        <group
          position={[-width * 0.14, -height / 2 + 0.06, LAYER_Z.wreck]}
          rotation={[0, 0, 0.15]}
        >
          <mesh position={[0, 0.17, 0]}>
            <planeGeometry args={[1.05, 0.34]} />
            <meshBasicMaterial color={palette.void} />
          </mesh>
          <mesh position={[-0.08, 0.42, 0]}>
            <planeGeometry args={[0.54, 0.26]} />
            <meshBasicMaterial color={palette.void} />
          </mesh>
        </group>
      ) : null}

      {/* 깨진 유리조각 — 지평선 근처에서 빛을 되쏜다 */}
      {shards
        ? SHARDS.map((shard) => (
            <mesh
              key={`${shard.x}:${shard.y}`}
              position={[shard.x * width, -height / 2 + shard.y, LAYER_Z.shards]}
              rotation={[0, 0, shard.tilt]}
            >
              <planeGeometry args={[shard.size, shard.size * 0.45]} />
              <meshBasicMaterial color={palette.linen} />
            </mesh>
          ))
        : null}
    </group>
  );
}

const SHARDS = Array.from({ length: 9 }, (_, index) => ({
  x: (hash01(index, 21) - 0.5) * 0.92,
  y: hash01(index, 22) * 0.14,
  size: 0.08 + hash01(index, 23) * 0.09,
  tilt: (hash01(index, 24) - 0.5) * 1.6,
}));

export function WindowView({ palette, decay, center, width, height }: WindowViewProps) {
  const viewWidth = width + MARGIN.left + MARGIN.right;
  const viewHeight = height + MARGIN.top + MARGIN.bottom;
  // 여백이 한쪽으로 치우쳤으니 판의 중심도 그만큼 옮긴다.
  const offsetX = (MARGIN.right - MARGIN.left) / 2;
  const offsetY = (MARGIN.top - MARGIN.bottom) / 2;

  const skyTexture = useSkyTexture(palette.void, palette.coal, palette.storm);
  // 직접 만든 텍스처라 r3f 자동 dispose에 기대지 않는다 (.claude/rules/r3f.md)
  useEffect(() => () => skyTexture.dispose(), [skyTexture]);

  const farRidge = useMemo(
    () => buildSkyline(viewWidth, 7, 11, viewHeight * 0.42),
    [viewWidth, viewHeight],
  );
  const skyline = useMemo(
    () => buildSkyline(viewWidth, 11, 29, viewHeight * 0.55),
    [viewWidth, viewHeight],
  );

  return (
    <group
      name="window-view"
      position={[center[0] + offsetX, center[1] + offsetY, center[2]]}
      // 조명을 받지 않는 배경막이라 meshBasicMaterial만 쓴다 — 방이 어두워져도 밤하늘은 그대로다.
    >
      <mesh position={[0, 0, LAYER_Z.sky]}>
        <planeGeometry args={[viewWidth, viewHeight]} />
        <meshBasicMaterial map={skyTexture} />
      </mesh>

      <group position={[0, 0, LAYER_Z.stars]}>
        <Stars span={viewWidth} height={viewHeight} color={palette.linen} />
      </group>

      <mesh position={[viewWidth * 0.26, viewHeight * 0.3, LAYER_Z.moon]}>
        <circleGeometry args={[0.26, 24]} />
        <meshBasicMaterial color={palette.linen} />
      </mesh>

      {/* 판 밑면이 원점에 오도록 내려 세운다 — 건물은 밑에서 위로 자란다. */}
      <group position={[0, -viewHeight / 2, 0]}>
        <Skyline
          buildings={farRidge}
          z={LAYER_Z.farRidge}
          color={palette.abyss}
          lightColor={palette.memory}
          showLights={false}
        />
        <Skyline
          buildings={skyline}
          z={LAYER_Z.skyline}
          color={palette.void}
          lightColor={palette.memory}
          showLights
          litRatio={1 - decay}
        />
      </group>

      <Aftermath decay={decay} palette={palette} width={viewWidth} height={viewHeight} />
    </group>
  );
}
