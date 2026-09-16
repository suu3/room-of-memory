import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CulledWall } from "./CulledWall";
import { FurnitureModel } from "./FurnitureModel";
import { ROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";
import { ShelfBookClue } from "./RoomClues";
import type { Vec3Tuple } from "./types";
import { useCoverTexture } from "./use-cover-texture";
import type { WallSide } from "./wall-culling";

useGLTF.preload(ASSETS.models.books, true, true);
useGLTF.preload(ASSETS.models.baseballJersey, true, true);
useGLTF.preload(ASSETS.models.teamPennant, true, true);

/**
 * 벽에 붙는 것들.
 *
 * 가구(RoomFurniture)는 바닥에 놓인 물건, 여기는 벽면 자체를 꾸미는 것들이다.
 * 벽이 통짜 단색이면 방이 아니라 상자로 읽힌다. 도현이 이 방에서 살았다는 증거는
 * 가구가 아니라 벽에 남는다: 붙였다 뗀 포스터 자국, 야구부 페넌트, 선반의 트로피.
 *
 * 색은 재질 팔레트(linen/sage/clay/fabric/trim)로만 짠다. memory(앰버 글로우)는
 * "만질 수 있는 기억"에만 쓰는 색이라 장식에 뿌리면 연출이 죽는다 (DESIGN.md).
 * 앰버 재질은 트로피 하나에만: 작은 소품에 제한적으로.
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
 * 뒷벽에 붙는 판. 겹쳐 붙일 때는 depth를 키운다. 두께가 같으면 앞면이 같은
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
 * 여기 붙는 것들은 반드시 해당 CulledWall 안에서 렌더해야 한다. 벽만 사라지고
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
 * 카메라가 직교라 이 방 전체가 화면에 들어온다. 포스터 하나가 100px 남짓이라
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
    backWall(x, y, width, height, "linen"),
    backWall(x, y, width - 0.12, height - 0.12, field, 0.06),
    backWall(x, y - height * 0.2, width - 0.34, height * 0.09, "linen", 0.08),
  ];
}

/**
 * 창 왼쪽·오른쪽 벽면. 창(x -0.27~2.57)과 선반(x 3.3~5.4)을 피해 배치한다.
 *
 * 색면은 벽(slate)보다 반드시 밝아야 한다. navy로 깔았더니 벽과 붙어버려서
 * 포스터가 아니라 "빈 액자 테두리"로 읽혔다. olive 한 장은 따뜻한 색이 하나쯤
 * 걸려 있어야 방이 차갑게만 안 보여서 넣었다. memory 금빛을 쓸 수 없는 자리의 대타다.
 */
const BACK_POSTERS = [...backPoster(-4.6, 3.3, 1.3, 1.7, "sage")] satisfies DecorBox[];

/**
 * 왼쪽 벽 책상 위에 붙은 고교야구대회 포스터 한 장.
 *
 * 방에서 유일하게 **그림이 실린** 벽면이다. 전에는 sage 색면 한 장이 문과 책상 사이에
 * 있었지만 이 거리에서 정체를 알 수 없는 초록 판으로만 읽혀서 뺐었다 (2026-09-15).
 * 색면 대신 진짜 인쇄물이 들어오면서 자리를 되찾았다: 도현이 이 방에서 무엇을 보고
 * 살았는지 말하는 물건이라, 야구부 유니폼·페넌트·트로피와 같은 편에 선다.
 *
 * 자리는 달력(z 0.9)과 전신거울(z 2.32~2.98) 사이의 빈 벽이고, 높이는 거울과 같은 띠다
 * (아래 0.38 ~ 위 1.78). 책상 위쪽 벽에 걸지 않은 이유가 있다: 이 방의 직교 카메라는
 * 벽의 윗부분을 화면 밖으로 밀어내서, 달력 높이(2.55)에 건 그림은 평소 구도에서 아랫단만
 * 보인다. 눈높이에 걸어야 그림이 그림으로 읽힌다. 거울과 윗변을 맞춰 둘이 한 벌로 선다.
 */
const WALL_POSTER = {
  z: 1.72,
  y: 1.08,
  /** [폭(z), 높이(y)]. 그림이 2:3이라 판도 2:3으로 잡아야 잘려 나가지 않는다. */
  width: 0.94,
  height: 1.41,
  /** 종이 두께. 옆에서 봤을 때 벽에 붙은 한 장으로 읽히는 최소한이다. */
  depth: 0.03,
} as const;

/**
 * 포스터. 색면 장식(DecorBox)과 달리 텍스처가 붙어서 별도 메쉬로 선다.
 *
 * 그림이 아직 안 왔거나 파일이 없으면 종이색 판이 그 자리를 지킨다 (useCoverTexture의
 * 계약). 색(linen)은 map에 곱해져 인쇄물 위에 옅은 종이 베일로 남는다: 액자 사진과
 * 같은 처리이고, 바랜 이 방의 톤에서 포스터만 쨍하게 뜨지 않게 한다.
 */
function WallPoster({ palette }: { palette: RoomPalette }) {
  const print = useCoverTexture(
    ASSETS.textures.roomPosterBaseball,
    WALL_POSTER.width / WALL_POSTER.height,
  );

  return (
    // 로컬 +z가 월드 +x(방 안쪽)를 보도록 세운다. 왼벽에 붙는 판들과 같은 규약이다
    <group
      position={[LEFT_WALL_FACE_X, WALL_POSTER.y, WALL_POSTER.z]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh position={[0, 0, WALL_POSTER.depth / 2]} receiveShadow>
        <boxGeometry args={[WALL_POSTER.width, WALL_POSTER.height, WALL_POSTER.depth]} />
        <meshStandardMaterial color={palette.linen} roughness={0.9} />
      </mesh>
      {/*
        인쇄면. 종이 판 앞으로 나와 있어야 둘이 같은 좌표에서 깜빡이지 않는다.

        그림이 **도착한 뒤에** 세운다. 빈 재질로 먼저 세워 두고 나중에 map만 끼우면
        판이 단색으로 남는다: three는 map이 생기고 없어질 때 셰이더를 다시 짜야 하는데
        (USE_MAP), 그건 needsUpdate를 직접 켜야 하는 일이라 재질을 처음부터 map과 함께
        만드는 쪽이 확실하다. 그 사이에는 아래 종이 판이 그대로 자리를 지킨다.
      */}
      {print && (
        <mesh position={[0, 0, WALL_POSTER.depth + 0.002]}>
          <planeGeometry args={[WALL_POSTER.width, WALL_POSTER.height]} />
          <meshStandardMaterial map={print} color={palette.linen} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

/**
 * 테이프로 붙인 사진 넉 장. 야구부 시절 사진이라는 설정이라 나란히 한 줄로 둔다.
 * 각도를 주지 않는 건 DESIGN.md가 패널 기울이기를 금지해서가 아니라(그건 UI 규칙),
 * 이 거리에서 기울인 사각형은 그냥 삐뚤어진 픽셀 덩어리로 보이기 때문이다.
 */
const PHOTO_STRIP = [-2.95, -2.55, -2.15, -1.75].flatMap((x) => [
  // paper(#EFE7D6)는 이 거리에서 조명까지 받아 흰 블록으로 튄다. 한 톤 낮춘다
  backWall(x, 3.42, 0.28, 0.28, "linen"),
  // 위쪽에 붙인 마스킹테이프 한 조각. 사진보다 어두워야 사진이 주인공으로 남는다
  backWall(x, 3.58, 0.13, 0.07, "trim", 0.07),
]) satisfies DecorBox[];

/**
 * 앞벽: 돌려야 보이는 면. 벽이 통째로 비면 "돌려봤자 아무것도 없네"가 되므로
 * 볼 것을 둔다. 침대 머리맡(x 3.1~6.2) 위가 가장 크게 비어 있다.
 */
const FRONT_WALL_DECOR = [
  frontWall(4.6, 3.2, 1.4, 1.8, "linen"),
  frontWall(4.6, 3.2, 1.28, 1.68, "sage", 0.06),
  frontWall(4.6, 2.84, 1.06, 0.16, "linen", 0.08),
  // 옷걸이 못 세 개와 걸린 옷 한 벌
  frontWall(-1.4, 2.4, 1.5, 0.12, "wood"),
  frontWall(-1.85, 2.32, 0.1, 0.14, "trim", 0.06),
  frontWall(-1.4, 2.32, 0.1, 0.14, "trim", 0.06),
  frontWall(-0.95, 2.32, 0.1, 0.14, "trim", 0.06),
  frontWall(-1.4, 1.72, 0.72, 1.06, "fabric", 0.09),
] as const satisfies readonly DecorBox[];

/**
 * 오른쪽 벽: 침대 머리 쪽. 야구 스코어보드를 흉내 낸 판.
 */
const RIGHT_WALL_DECOR = [
  rightWall(2.4, 3.05, 2.0, 1.15, "linen"),
  rightWall(2.4, 3.05, 1.86, 1.01, "frame", 0.06),
  rightWall(2.4, 3.28, 1.6, 0.14, "linen", 0.08),
  rightWall(2.4, 2.9, 1.6, 0.14, "linen", 0.08),
] as const satisfies readonly DecorBox[];

/**
 * 걸레받이 위 콘센트. 손 닿는 높이에 있어야 방처럼 보인다.
 *
 * 전등 스위치도 원래 여기 장식으로 있었지만, 실제로 눌리는 물건이 되면서
 * LightSwitch(RoomShell의 왼벽)로 옮겨갔다. 여기 두면 둘이 겹쳐 두 개가 된다.
 */
const WALL_FITTINGS = [
  leftWall(-3.05, 0.44, 0.22, 0.16, "trim", 0.05),
] as const satisfies readonly DecorBox[];

/** 뒷벽 선반(윗면 y=2.86) 위. 왼쪽 벽 선반은 윗면 y=3.01. */
const BACK_SHELF_TOP_Y = 2.86;
const LEFT_SHELF_TOP_Y = 3.01;

/** 선반에 세워 꽂은 책들. 높이를 조금씩 달리해야 책장처럼 읽힌다. */
const SHELF_BOOKS = [
  { x: 4.72, height: 0.42, color: "fabric" },
  { x: 4.86, height: 0.48, color: "linen" },
  { x: 4.99, height: 0.39, color: "clay" },
  { x: 5.12, height: 0.46, color: "sage" },
] as const satisfies readonly { x: number; height: number; color: keyof RoomPalette }[];

/**
 * 집어 들 수 있는 한 권. 밝은 색(linen)이라 네 권 중 눈에 먼저 걸리는 책이고,
 * 다가감 판정도 이 x를 기준으로 잡혀 있다 (layout의 CLUE_PROPS.shelfBook).
 */
const CLUE_BOOK_X = 4.86;

/** 선반에 꽂힌 책 한 권. 단서로 쓰는 한 권도 같은 도형을 쓴다. 겉으로는 구별되지 않는다. */
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
 * (RoomDecor.test.ts: 같은 벽에서 화면상 겹치는 판은 두께가 달라야 한다).
 */
export const DECOR_BY_WALL = {
  back: [...BACK_POSTERS, ...PHOTO_STRIP],
  left: WALL_FITTINGS,
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
 * 재질 팔레트의 앰버: 방에서 앰버를 받는 몇 안 되는 소품이다. 빛이 닿을 때만
 * 꿀빛으로 서고, 어둠 속에서는 바랜 놋쇠로 가라앉는다.
 */
function Trophy({ palette, position }: { palette: RoomPalette; position: Vec3Tuple }) {
  return (
    <group name="trophy" position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.24, 0.1, 0.24]} />
        <meshStandardMaterial color={palette.frame} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.13, 12]} />
        <meshStandardMaterial color={palette.amber} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.29, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.07, 0.17, 12]} />
        <meshStandardMaterial color={palette.amber} roughness={0.62} />
      </mesh>
    </group>
  );
}

export function RoomDecor({ palette }: { palette: RoomPalette }) {
  /*
   * 왼벽은 이제 걷힐 수 있다. 플레이어가 거실로 나가면 공유벽이 시야를 가려서
   * RoomShell이 강제로 걷는다 (v2). 벽에 붙은 장식은 벽과 함께 사라져야 한다.
   */
  const awayFromRoom = useMemoryRoomStore((state) => state.space !== "room");

  return (
    <group name="room-decor">
      {/*
        뒷벽은 회전 범위(±0.5rad) 안에서 절대 걷히지 않으므로 CulledWall 없이
        그대로 세운다. 회전을 더 열려면 이것도 CulledWall 안으로 옮겨야 한다.
      */}
      <DecorBoxes parts={DECOR_BY_WALL.back} palette={palette} />
      {/* 책장 위 포스터 자리에 실제 소매와 옷걸이가 있는 유니폼을 건다. */}
      <FurnitureModel
        path={ASSETS.models.baseballJersey}
        position={[6.4, 2.97, BACK_WALL_FACE_Z + 0.11]}
        scale={1}
      />
      <FurnitureModel
        path={ASSETS.models.teamPennant}
        position={[4.3, 3.82, BACK_WALL_FACE_Z + 0.026]}
        scale={1}
      />
      <CulledWall side="left" hidden={awayFromRoom}>
        <DecorBoxes parts={DECOR_BY_WALL.left} palette={palette} />
        <WallPoster palette={palette} />
      </CulledWall>

      {/* 돌려야 드러나는 두 면. 벽과 함께 스러져야 하므로 반드시 CulledWall 안이다 */}
      <CulledWall side="front">
        <DecorBoxes parts={DECOR_BY_WALL.front} palette={palette} />
      </CulledWall>
      <CulledWall side="right">
        <DecorBoxes parts={DECOR_BY_WALL.right} palette={palette} />
      </CulledWall>

      {/* 뒷벽 선반 위: 트로피와 꽂아둔 책 */}
      <Trophy palette={palette} position={[3.72, BACK_SHELF_TOP_Y, -3.66]} />
      {/* 한 권만 집을 수 있다. 네 권 다 열리면 어느 것을 봐도 같은 화면이 뜬다 */}
      {SHELF_BOOKS.map((book) =>
        book.x === CLUE_BOOK_X ? (
          <ShelfBookClue key={book.x}>
            <ShelfBook book={book} palette={palette} />
          </ShelfBookClue>
        ) : (
          <ShelfBook key={book.x} book={book} palette={palette} />
        ),
      )}

      {/* 왼쪽 벽 선반 위: 눕혀 쌓아둔 책 더미 */}
      <FurnitureModel
        path={ASSETS.models.books}
        position={[-5.64, LEFT_SHELF_TOP_Y, -1.85]}
        rotation={[0, Math.PI / 2, 0]}
        scale={2.6}
      />
    </group>
  );
}
