import type {} from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, Color, SRGBColorSpace } from "three";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

/*
 * 창밖 풍경.
 *
 * 아이소메트릭 카메라는 창을 비스듬히 내려다보기 때문에, 풍경을 멀리 두면 창을 통해
 * 보이는 지점이 한참 왼쪽·아래로 밀린다 (시선 방향이 대략 (-0.64, -0.38, -0.67)).
 * 그래서 원경을 진짜로 멀리 두는 대신 벽 바로 뒤에 얕은 상자로 세운다. 무대 배경막과
 * 같은 방식이다. 깊이가 얕아야 시차가 작아 여백을 조금만 둬도 가장자리가 안 보인다.
 *
 * 여백은 방향이 있다: 시선이 -x·-y로 밀리므로 왼쪽과 아래에 넉넉히 주고,
 * 위쪽은 조금만 준다. 위로 키우면 벽 윗면(y=4.7) 너머로 넘겨다보인다.
 *
 * 회전 범위를 ±0.32rad에서 ±0.75rad로 넓히면서 여백을 전부 키웠다. 시점을 옆으로
 * 돌릴수록 시차가 커져서, 예전 값(왼쪽 1.6/오른쪽 0.25)으로는 창 구석에 배경판
 * 가장자리가 드러났다. 왼쪽 끝(x≈-3.3)은 아직 뒷벽(x≥-6) 안쪽이라 옆으로 새지 않는다.
 *
 * 노을은 색으로만 말한다. 도시 실루엣과 처박힌 차를 세워 봤는데 창 하나가 그림이
 * 되어 방의 색면들과 따로 놀았다. 남긴 것은 하늘 그라디언트와 별 몇 개다. 생존자 방송 뒤에
 * 켜지던 맞은편 창 하나도 창에 붙은 네모로 읽혀 뺐다 (2026-09-27).
 */
const MARGIN = { left: 3.2, right: 1.3, top: 0.28, bottom: 1.5 } as const;

/**
 * 창 중심(z=-3.88) 기준 레이어 깊이. 가장 깊은 하늘판도 0.75까지만 물러난다.
 * 더 뒤로 보내면 카메라를 최대(±0.32rad)로 돌렸을 때 판 왼쪽 끝이 창에 걸리고,
 * 벽 윗면(y=4.7) 너머로 판 꼭대기가 넘겨다보인다.
 */
const LAYER_Z = {
  sky: -0.75,
  stars: -0.66,
} as const;

interface WindowViewProps {
  palette: RoomPalette;
  /** 0=평범한 저녁, 1=사태 이후. 되돌아가지 않는다 (visual-state의 outsideDecay). */
  decay: number;
  /** 창 개구부의 중심과 크기: RoomShell이 벽에 뚫은 구멍과 같아야 한다. */
  center: Vec3Tuple;
  width: number;
  height: number;
}

/**
 * 해가 진 직후의 하늘. 세로 그라디언트 한 장이다.
 *
 * 정점 색(vertexColors)으로 만들려다 실패했다. r3f가 프롭으로 넘긴 vertexColors는
 * 재질 속성만 바꾸고 셰이더를 다시 컴파일하지 않아서 USE_COLOR 디파인이 안 켜지고,
 * 결과적으로 판이 흰색으로 나온다. WindowLight가 쓰는 캔버스 텍스처 방식을 따른다.
 *
 * 해는 그리지 않는다. 판에 동그란 해와 후광을 구워 넣어 봤더니 배경막이 아니라
 * 스티커가 됐다: 이 방의 다른 것들은 전부 색면인데 거기만 일러스트였다. 노을은
 * 색으로만 말한다: 위는 아직 밤에 가깝고, 지평선 가까이에서만 볕이 남는다.
 */
/** 하늘 띠의 색이 바뀌는 높이 (0 = 판 꼭대기, 1 = 판 밑). */
const SKY_STOPS = [0, 0.34, 0.62, 0.84, 1] as const;
/**
 * 사태가 번질수록 지평선의 볕이 식는 정도. 도시가 꺼지는 것을 건물 창 대신 색으로
 * 말한다. 1이면 한밤이 되는데, 그러면 창이 그냥 검은 구멍이라 여기서 멈춘다.
 */
const DECAY_DIM = 0.55;

function canBake(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return typeof ctx?.createLinearGradient === "function" && typeof ctx.fillRect === "function";
}

/** 붕괴도(0~1)에 따른 다섯 띠의 색. 밤에 가까운 위 두 띠는 그대로, 볕이 남은 아래만 식는다. */
export function skyColors(palette: RoomPalette, decay: number): string[] {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(decay) ? 0 : decay));
  const night = new Color(palette.storm);
  const cool = (hex: string) => new Color(hex).lerp(night, clamped * DECAY_DIM).getStyle();
  // 밤 → 저녁의 파랑 → 지평선에 남은 볕. 채도가 센 ember는 쓰지 않는다: 창 하나가
  // 방보다 붉으면 방이 배경이 된다
  return [palette.abyss, palette.storm, cool(palette.clay), cool(palette.amber), cool(palette.sun)];
}

function useSkyTexture(palette: RoomPalette, decay: number): CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    // 가로로는 변하지 않는 그림이라 4픽셀이면 된다
    canvas.width = 4;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (canBake(context)) {
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      const colors = skyColors(palette, decay);
      SKY_STOPS.forEach((stop, index) => {
        gradient.addColorStop(stop, colors[index]);
      });
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [palette, decay]);
}

/** 값을 난수로 뽑으면 새로고침마다 하늘이 바뀌어서, 인덱스로 결정되는 해시를 쓴다. */
function hash01(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * 아직 해가 걸려 있는 하늘이라 별은 몇 개뿐이다. 마흔둘을 뿌렸더니 창밖이 한밤중으로
 * 읽혀서, 하늘 꼭대기(아직 밤에 가까운 띠)에만 성글게 남긴다.
 */
const STAR_COUNT = 12;

function Stars({ span, height, color }: { span: number; height: number; color: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => ({
        x: (hash01(index, 3) - 0.5) * span * 0.94,
        // 좌표는 판 중심 기준. 노을이 타는 가운데 띠를 비우고 맨 위에만 뿌린다.
        y: height * (0.3 + hash01(index, 4) * 0.15),
        size: 0.012 + hash01(index, 5) * 0.014,
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

export function WindowView({ palette, decay, center, width, height }: WindowViewProps) {
  const viewWidth = width + MARGIN.left + MARGIN.right;
  const viewHeight = height + MARGIN.top + MARGIN.bottom;
  // 여백이 한쪽으로 치우쳤으니 판의 중심도 그만큼 옮긴다.
  const offsetX = (MARGIN.right - MARGIN.left) / 2;
  const offsetY = (MARGIN.top - MARGIN.bottom) / 2;

  const skyTexture = useSkyTexture(palette, decay);
  // 직접 만든 텍스처라 r3f 자동 dispose에 기대지 않는다 (.claude/rules/r3f.md)
  useEffect(() => () => skyTexture.dispose(), [skyTexture]);

  return (
    <group
      name="window-view"
      position={[center[0] + offsetX, center[1] + offsetY, center[2]]}
      // 조명을 받지 않는 배경막이라 meshBasicMaterial만 쓴다. 방이 어두워져도 하늘은 그대로다.
    >
      <mesh position={[0, 0, LAYER_Z.sky]}>
        <planeGeometry args={[viewWidth, viewHeight]} />
        <meshBasicMaterial map={skyTexture} />
      </mesh>

      <group position={[0, 0, LAYER_Z.stars]}>
        <Stars span={viewWidth} height={viewHeight} color={palette.trim} />
      </group>
    </group>
  );
}
