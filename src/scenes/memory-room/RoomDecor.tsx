import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { CulledWall } from "./CulledWall";
import { FurnitureModel } from "./FurnitureModel";
import { ROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";
import { ShelfBookClue } from "./RoomClues";
import type { Vec3Tuple } from "./types";
import type { WallSide } from "./wall-culling";

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
const FRONT_WALL_FACE_Z = ROOM_SHELL_BOUNDS.maxZ - 0.09;
const RIGHT_WALL_FACE_X = ROOM_SHELL_BOUNDS.maxX - 0.09;

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

/*
 * 앞·오른쪽 벽. 기본 구도에서는 카메라를 향하고 있어 걷혀 있고, 시점을 돌려야 드러난다.
 * 여기 붙는 것들은 반드시 해당 CulledWall 안에서 렌더해야 한다 — 벽만 사라지고
 * 포스터가 남으면 액자가 허공에 뜬다.
 */
function frontWall(
  x: number,
  y: number,
  width: number,
  height: number,
  color: keyof RoomPalette,
  depth = PLAQUE_DEPTH,
): DecorBox {
  return { size: [width, height, depth], position: [x, y, FRONT_WALL_FACE_Z - depth / 2], color };
}

function rightWall(
  z: number,
  y: number,
  width: number,
  height: number,
  color: keyof RoomPalette,
  depth = PLAQUE_DEPTH,
): DecorBox {
  return { size: [depth, height, width], position: [RIGHT_WALL_FACE_X - depth / 2, y, z], color };
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
const BACK_FADED_MARKS = [
  backWall(-1.15, 2.45, 0.92, 1.2, "dusk"),
  backWall(6.5, 1.65, 1.05, 1.35, "dusk"),
] as const satisfies readonly DecorBox[];

/**
 * 왼쪽 벽 자국. 예전에는 z=1.95에 있었는데 그 자리가 포스터(z 1.9~3.4)와 겹쳤다.
 * 둘 다 벽면에서 같은 두께(0.04)로 튀어나와 앞면이 정확히 같은 평면에 놓이는 바람에
 * 프레임마다 어느 쪽이 앞인지 뒤집히며 깜빡였다. 포스터 왼쪽 빈자리로 물린다.
 */
const LEFT_FADED_MARKS = [
  leftWall(0.35, 1.5, 1.15, 1.45, "dusk"),
] as const satisfies readonly DecorBox[];

/**
 * 창 왼쪽·오른쪽 벽면. 창(x -0.27~2.57)과 선반(x 3.3~5.4)을 피해 배치한다.
 *
 * 색면은 벽(slate)보다 반드시 밝아야 한다. navy로 깔았더니 벽과 붙어버려서
 * 포스터가 아니라 "빈 액자 테두리"로 읽혔다. olive 한 장은 따뜻한 색이 하나쯤
 * 걸려 있어야 방이 차갑게만 안 보여서 넣었다 — memory 금빛을 쓸 수 없는 자리의 대타다.
 */
const BACK_POSTERS = [
  ...backPoster(-4.6, 3.3, 1.3, 1.7, "storm"),
  ...backPoster(6.5, 3.35, 1.25, 1.65, "olive"),
] satisfies DecorBox[];

const LEFT_POSTERS = [...leftPoster(2.65, 2.9, 1.5, 1.9, "storm")] satisfies DecorBox[];

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

/**
 * 앞벽 — 돌려야 보이는 면. 벽이 통째로 비면 "돌려봤자 아무것도 없네"가 되므로
 * 볼 것을 둔다. 침대 머리맡(x 3.1~6.2) 위가 가장 크게 비어 있다.
 */
const FRONT_WALL_DECOR = [
  frontWall(4.6, 3.2, 1.4, 1.8, "bone"),
  frontWall(4.6, 3.2, 1.28, 1.68, "storm", 0.06),
  frontWall(4.6, 2.84, 1.06, 0.16, "bone", 0.08),
  // 옷걸이 못 세 개와 걸린 옷 한 벌
  frontWall(-1.4, 2.4, 1.5, 0.12, "dusk"),
  frontWall(-1.85, 2.32, 0.1, 0.14, "bone", 0.06),
  frontWall(-1.4, 2.32, 0.1, 0.14, "bone", 0.06),
  frontWall(-0.95, 2.32, 0.1, 0.14, "bone", 0.06),
  frontWall(-1.4, 1.72, 0.72, 1.06, "navy", 0.09),
  frontWall(1.6, 1.9, 0.85, 1.1, "dusk"),
] as const satisfies readonly DecorBox[];

/**
 * 오른쪽 벽 — 침대 머리 쪽. 야구 스코어보드를 흉내 낸 판과 빛바랜 자국.
 */
const RIGHT_WALL_DECOR = [
  rightWall(2.4, 3.05, 2.0, 1.15, "bone"),
  rightWall(2.4, 3.05, 1.86, 1.01, "navy", 0.06),
  rightWall(2.4, 3.28, 1.6, 0.14, "bone", 0.08),
  rightWall(2.4, 2.9, 1.6, 0.14, "bone", 0.08),
  rightWall(-1.5, 2.5, 1.0, 1.3, "dusk"),
] as const satisfies readonly DecorBox[];

/**
 * 걸레받이 위 콘센트. 손 닿는 높이에 있어야 방처럼 보인다.
 *
 * 전등 스위치도 원래 여기 장식으로 있었지만, 실제로 눌리는 물건이 되면서
 * LightSwitch(RoomShell의 왼벽)로 옮겨갔다 — 여기 두면 둘이 겹쳐 두 개가 된다.
 */
const WALL_FITTINGS = [
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

/**
 * 집어 들 수 있는 한 권. 밝은 색(bone)이라 네 권 중 눈에 먼저 걸리는 책이고,
 * 다가감 판정도 이 x를 기준으로 잡혀 있다 (layout의 CLUE_PROPS.shelfBook).
 */
const CLUE_BOOK_X = 4.86;

/** 선반에 꽂힌 책 한 권. 단서로 쓰는 한 권도 같은 도형을 쓴다 — 겉으로는 구별되지 않는다. */
function ShelfBook({
  book,
  palette,
}: {
  book: (typeof SHELF_BOOKS)[number];
  palette: RoomPalette;
}) {
  return (
    <mesh position={[book.x, BACK_SHELF_TOP_Y + book.height / 2, -3.66]} castShadow receiveShadow>
      <boxGeometry args={[0.11, book.height, 0.3]} />
      <meshStandardMaterial color={palette[book.color]} roughness={0.85} />
    </mesh>
  );
}

/**
 * 벽면별 장식 목록. 테스트가 겹침을 검사할 수 있도록 내보낸다
 * (RoomDecor.test.ts — 같은 벽에서 화면상 겹치는 판은 두께가 달라야 한다).
 */
export const DECOR_BY_WALL = {
  back: [...BACK_FADED_MARKS, ...BACK_POSTERS, ...PHOTO_STRIP, ...PENNANT],
  left: [...LEFT_FADED_MARKS, ...LEFT_POSTERS, ...WALL_FITTINGS],
  front: FRONT_WALL_DECOR,
  right: RIGHT_WALL_DECOR,
} as const satisfies Record<WallSide, readonly DecorBox[]>;

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
      {/*
        뒷벽·왼쪽 벽은 회전 범위(±0.5rad) 안에서 절대 걷히지 않으므로 CulledWall 없이
        그대로 세운다. 회전을 더 열려면 이것들도 CulledWall 안으로 옮겨야 한다.
      */}
      <DecorBoxes parts={DECOR_BY_WALL.back} palette={palette} />
      <DecorBoxes parts={DECOR_BY_WALL.left} palette={palette} />

      {/* 돌려야 드러나는 두 면. 벽과 함께 스러져야 하므로 반드시 CulledWall 안이다 */}
      <CulledWall side="front">
        <DecorBoxes parts={DECOR_BY_WALL.front} palette={palette} />
      </CulledWall>
      <CulledWall side="right">
        <DecorBoxes parts={DECOR_BY_WALL.right} palette={palette} />
      </CulledWall>

      {/* 뒷벽 선반 위 — 트로피와 꽂아둔 책 */}
      <Trophy palette={palette} position={[3.72, BACK_SHELF_TOP_Y, -3.66]} />
      {/* 한 권만 집을 수 있다 — 네 권 다 열리면 어느 것을 봐도 같은 화면이 뜬다 */}
      {SHELF_BOOKS.map((book) =>
        book.x === CLUE_BOOK_X ? (
          <ShelfBookClue key={book.x}>
            <ShelfBook book={book} palette={palette} />
          </ShelfBookClue>
        ) : (
          <ShelfBook key={book.x} book={book} palette={palette} />
        ),
      )}

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
