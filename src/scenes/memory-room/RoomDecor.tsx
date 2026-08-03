import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import { ROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

useGLTF.preload(ASSETS.models.books, true, true);

/**
 * 벽에 붙는 것들.
 *
 * 가구(RoomFurniture)는 바닥에 놓인 물건, 여기는 벽면 자체를 꾸미는 것들이다.
 * 벽이 통짜 단색이면 방이 아니라 상자로 읽힌다 — 도현이 이 방에서 살았다는 증거는
 * 가구가 아니라 벽에 남는다: 붙였다 뗀 포스터 자국, 야구부 페넌트, 선반의 트로피.
 *
 * 색은 바랜 톤(bone/paper/navy/dusk/slate)으로만 짠다. memory(금빛)는
 * "만질 수 있는 기억"에만 쓰는 색이라 장식에 뿌리면 연출이 죽고(DESIGN.md),
 * ember는 이미 문 손잡이가 쓰고 있다.
 */

/** 벽 안쪽 면. 벽 두께 0.18의 절반만큼 중심에서 안으로 들어온 자리다. */
const BACK_WALL_FACE_Z = ROOM_SHELL_BOUNDS.minZ + 0.09;
const LEFT_WALL_FACE_X = ROOM_SHELL_BOUNDS.minX + 0.09;

/** 벽에 붙는 납작한 판의 기본 두께. */
const PLAQUE_DEPTH = 0.04;

interface DecorBox {
  size: Vec3Tuple;
  position: Vec3Tuple;
  color: keyof RoomPalette;
}

/**
 * 뒷벽에 붙는 판. 겹쳐 붙일 때는 depth를 키운다 — 두께가 같으면 앞면이 같은
 * 좌표에 놓여 z-fighting으로 깜빡인다 (RoomFurniture의 겹침 원칙과 같다).
 */
function backWall(
  x: number,
  y: number,
  width: number,
  height: number,
  color: keyof RoomPalette,
  depth = PLAQUE_DEPTH,
): DecorBox {
  return { size: [width, height, depth], position: [x, y, BACK_WALL_FACE_Z + depth / 2], color };
}

/** 왼쪽 벽에 붙는 판. 벽이 x축을 보고 서 있으므로 두께가 x, 폭이 z로 간다. */
function leftWall(
  z: number,
  y: number,
  width: number,
  height: number,
  color: keyof RoomPalette,
  depth = PLAQUE_DEPTH,
): DecorBox {
  return { size: [depth, height, width], position: [LEFT_WALL_FACE_X + depth / 2, y, z], color };
}

/**
 * 포스터 한 장 = 종이 바탕 + 안쪽 색면 + 가로 띠.
 * 카메라가 직교라 이 방 전체가 화면에 들어온다 — 포스터 하나가 100px 남짓이라
 * 요소를 더 넣어봐야 뭉개진다. 세 겹이 이 거리에서 읽히는 한계다.
 */
function backPoster(
  x: number,
  y: number,
  width: number,
  height: number,
  field: keyof RoomPalette,
): DecorBox[] {
  return [
    backWall(x, y, width, height, "bone"),
    backWall(x, y, width - 0.12, height - 0.12, field, 0.06),
    backWall(x, y - height * 0.2, width - 0.34, height * 0.09, "bone", 0.08),
  ];
}

function leftPoster(
  z: number,
  y: number,
  width: number,
  height: number,
  field: keyof RoomPalette,
): DecorBox[] {
  return [
    leftWall(z, y, width, height, "bone"),
    leftWall(z, y, width - 0.12, height - 0.12, field, 0.06),
    leftWall(z - width * 0.16, y, width * 0.09, height - 0.34, "bone", 0.08),
  ];
}

/**
 * 포스터를 떼어낸 자리. 볕에 바래지 않아 벽(slate)보다 한 톤 밝게 남는다.
 * 이 방에서 시간이 흘렀다는 걸 말없이 알리는 장치라 일부러 비워 둔다.
 * mist(#16212C)로 잡았다가 되돌렸다 — 벽보다 어두워서 자국이 아니라 그늘로 보였다.
 */
const FADED_MARKS = [
  backWall(-1.15, 2.45, 0.92, 1.2, "dusk"),
  backWall(6.5, 1.65, 1.05, 1.35, "dusk"),
  leftWall(1.95, 1.5, 1.15, 1.45, "dusk"),
] as const satisfies readonly DecorBox[];

/**
 * 창 왼쪽·오른쪽 벽면. 창(x -0.27~2.57)과 선반(x 3.3~5.4)을 피해 배치한다.
 *
 * 색면은 벽(slate)보다 반드시 밝아야 한다. navy로 깔았더니 벽과 붙어버려서
 * 포스터가 아니라 "빈 액자 테두리"로 읽혔다. olive 한 장은 따뜻한 색이 하나쯤
 * 걸려 있어야 방이 차갑게만 안 보여서 넣었다 — memory 금빛을 쓸 수 없는 자리의 대타다.
 */
const POSTERS = [
  ...backPoster(-4.6, 3.3, 1.3, 1.7, "storm"),
  ...backPoster(6.5, 3.35, 1.25, 1.65, "olive"),
  ...leftPoster(2.65, 2.9, 1.5, 1.9, "storm"),
] as const satisfies readonly DecorBox[];

/**
 * 테이프로 붙인 사진 넉 장. 야구부 시절 사진이라는 설정이라 나란히 한 줄로 둔다.
 * 각도를 주지 않는 건 DESIGN.md가 패널 기울이기를 금지해서가 아니라(그건 UI 규칙),
 * 이 거리에서 기울인 사각형은 그냥 삐뚤어진 픽셀 덩어리로 보이기 때문이다.
 */
const PHOTO_STRIP = [-2.95, -2.55, -2.15, -1.75].flatMap((x) => [
  // paper(#EFE7D6)는 이 거리에서 조명까지 받아 흰 블록으로 튄다 — 한 톤 낮춘다
  backWall(x, 3.42, 0.28, 0.28, "bone"),
  // 위쪽에 붙인 마스킹테이프 한 조각. 사진보다 어두워야 사진이 주인공으로 남는다
  backWall(x, 3.58, 0.13, 0.07, "dusk", 0.07),
]) satisfies DecorBox[];

/**
 * 야구부 페넌트. 삼각 깃발을 박스로 흉내 낼 수는 없어서 가로로 긴 배너로 짰다.
 * 바탕을 navy로 뒀더니 벽에 묻혀 흰 줄 하나만 공중에 떠 보였다 — 크림 바탕에
 * 어두운 줄을 넣는 쪽으로 뒤집는다.
 */
const PENNANT = [
  backWall(4.3, 4.05, 1.9, 0.46, "bone"),
  backWall(4.3, 4.05, 1.7, 0.12, "navy", 0.06),
] as const satisfies readonly DecorBox[];

/** 문 옆 전등 스위치와 걸레받이 위 콘센트. 손 닿는 높이에 있어야 방처럼 보인다. */
const WALL_FITTINGS = [
  leftWall(4.15, 1.72, 0.2, 0.3, "bone", 0.05),
  leftWall(4.15, 1.72, 0.1, 0.14, "paper", 0.07),
  leftWall(-3.05, 0.44, 0.22, 0.16, "bone", 0.05),
] as const satisfies readonly DecorBox[];

/** 뒷벽 선반(윗면 y=2.86) 위. 왼쪽 벽 선반은 윗면 y=3.01. */
const BACK_SHELF_TOP_Y = 2.86;
const LEFT_SHELF_TOP_Y = 3.01;

/** 선반에 세워 꽂은 책들. 높이를 조금씩 달리해야 책장처럼 읽힌다. */
const SHELF_BOOKS = [
  { x: 4.72, height: 0.42, color: "navy" },
  { x: 4.86, height: 0.48, color: "bone" },
  { x: 4.99, height: 0.39, color: "dusk" },
  { x: 5.12, height: 0.46, color: "slate" },
] as const satisfies readonly { x: number; height: number; color: keyof RoomPalette }[];

function DecorBoxMesh({ part, palette }: { part: DecorBox; palette: RoomPalette }) {
  return (
    <mesh position={part.position} receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={palette[part.color]} roughness={0.85} />
    </mesh>
  );
}

function DecorBoxes({ parts, palette }: { parts: readonly DecorBox[]; palette: RoomPalette }) {
  return parts.map((part) => (
    <DecorBoxMesh
      key={`${part.position.join(":")}:${part.size.join(":")}`}
      part={part}
      palette={palette}
    />
  ));
}

/**
 * 야구부 트로피. 받침 → 기둥 → 컵 순으로 쌓는다.
 * 금빛(memory)을 쓰고 싶은 자리지만 그 색은 기억 오브젝트 전용이라, 바랜 크림으로 둔다 —
 * 우승컵도 이 방에서는 빛을 잃은 지 오래라는 편이 이야기에도 맞는다.
 */
function Trophy({ palette, position }: { palette: RoomPalette; position: Vec3Tuple }) {
  return (
    <group name="trophy" position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.24, 0.1, 0.24]} />
        <meshStandardMaterial color={palette.dusk} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.13, 12]} />
        <meshStandardMaterial color={palette.bone} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.29, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.07, 0.17, 12]} />
        <meshStandardMaterial color={palette.bone} roughness={0.62} />
      </mesh>
    </group>
  );
}

export function RoomDecor({ palette }: { palette: RoomPalette }) {
  return (
    <group name="room-decor">
      <DecorBoxes parts={FADED_MARKS} palette={palette} />
      <DecorBoxes parts={POSTERS} palette={palette} />
      <DecorBoxes parts={PHOTO_STRIP} palette={palette} />
      <DecorBoxes parts={PENNANT} palette={palette} />
      <DecorBoxes parts={WALL_FITTINGS} palette={palette} />

      {/* 뒷벽 선반 위 — 트로피와 꽂아둔 책 */}
      <Trophy palette={palette} position={[3.72, BACK_SHELF_TOP_Y, -3.66]} />
      {SHELF_BOOKS.map((book) => (
        <mesh
          key={book.x}
          position={[book.x, BACK_SHELF_TOP_Y + book.height / 2, -3.66]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.11, book.height, 0.3]} />
          <meshStandardMaterial color={palette[book.color]} roughness={0.85} />
        </mesh>
      ))}

      {/* 왼쪽 벽 선반 위 — 눕혀 쌓아둔 책 더미 */}
      <FurnitureModel
        path={ASSETS.models.books}
        position={[-5.64, LEFT_SHELF_TOP_Y, -1.85]}
        rotation={[0, Math.PI / 2, 0]}
        scale={2.6}
      />
    </group>
  );
}
