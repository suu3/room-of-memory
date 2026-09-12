"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, MeshStandardMaterial, SRGBColorSpace } from "three";
import { type RoomPalette, resolveRoomPalette } from "@/scenes/memory-room/palette";

/**
 * 집어 든 문제집 (ClueOverlay의 WorkbookClue 안에서만 쓴다).
 *
 * 책상 위 더미의 그 문제집을 세워 들고 돌려본다. 방의 glb를 다시 쓰지 않고 상자 하나에
 * 표지를 그려 붙인다: 뒤표지의 이름은 언어를 따라야 하는데(ko/en/ja) glb에 구운 글자는
 * 한 언어로 박제되기 때문이다. 표지 인쇄는 방의 모델(scripts/create-student-props.mjs)과
 * 같은 문구·색이라 같은 책으로 읽힌다.
 *
 * 앞면만 보면 아무것도 없다. **뒤집어야** 뒤표지의 이름표가 나오고, 그걸 잠깐 마주 보면
 * 읽은 것으로 쳐서 `onBackSeen`을 한 번 부른다. 저 혼자 돌지 않는다: 돌리는 손이 있어야
 * 나오는 단서라서.
 */

/** 세워 든 책의 치수 (x 폭, y 높이, z 두께). 세로 화각 30°·카메라 2.3에서 높이가 다 들어온다. */
const BOOK_SIZE: [number, number, number] = [0.62, 0.86, 0.07];
/** 뒤표지가 카메라를 향한 것으로 치는 기준: cos(yaw)가 이보다 작으면 (π에서 ±37° 안). */
const BACK_FACING_COS = -0.8;
/** 뒤표지를 이만큼 마주 보고 있어야 읽은 것으로 친다(초). 휙 지나간 건 못 읽은 것이다. */
const READ_SECONDS = 0.35;
/** 표지 그림의 해상도. 이름 글자가 또렷하려면 폭 512는 있어야 한다. */
const COVER_W = 512;
const COVER_H = 704;

/** 뒤표지 바코드의 막대 폭 패턴. 읽히는 코드가 아니라 인쇄물로 보이게 하는 무늬다. */
const BARCODE = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1] as const;

export interface WorkbookLabels {
  /** 뒤표지 이름표에 적힌 이름 (characters.hero.name). */
  name: string;
  /** 이름표의 작은 제목 ("이름"). */
  tagLabel: string;
  /** 이름 옆의 학년 ("고3"). */
  tagGrade: string;
}

/** 페이지의 글꼴을 그대로 쓴다: 방의 UI와 같은 Pretendard가 next/font로 이미 실려 있다. */
function bodyFont(): string {
  try {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

function paintFront(ctx: CanvasRenderingContext2D, palette: RoomPalette, font: string) {
  ctx.fillStyle = palette.fabric;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  // 방의 모델과 같은 구성 (연도 · 시리즈 · 제목 · 부제)
  ctx.fillStyle = palette.linen;
  ctx.font = `500 26px ${font}`;
  ctx.fillText("2026", 44, 78);
  ctx.font = `500 28px ${font}`;
  ctx.fillText("수능 기출 문제집", 44, 156);
  ctx.font = `700 92px ${font}`;
  ctx.fillText("수학Ⅰ", 40, 276);
  ctx.fillRect(44, 312, 160, 3);
  ctx.font = `500 25px ${font}`;
  ctx.fillText("개념 정리 + 유형별 연습", 46, 430);
  ctx.font = `500 21px ${font}`;
  ctx.fillText("오답까지, 한 번 더", 46, 586);
}

function paintBack(
  ctx: CanvasRenderingContext2D,
  palette: RoomPalette,
  font: string,
  labels: WorkbookLabels,
) {
  ctx.fillStyle = palette.fabric;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // 이름표: 누가 가져갈까 봐 붙여 둔 종이 한 장. 표지에 조금 비뚤게 붙어 있다
  ctx.save();
  ctx.translate(COVER_W / 2, 150);
  ctx.rotate(-0.035);
  ctx.fillStyle = palette.linen;
  ctx.fillRect(-190, -68, 380, 136);
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(-178, -56, 356, 112);
  ctx.fillStyle = palette.clay;
  ctx.font = `500 22px ${font}`;
  ctx.fillText(labels.tagLabel, -158, -18);
  ctx.fillStyle = palette.frame;
  ctx.font = `500 24px ${font}`;
  ctx.fillText(labels.tagGrade, -158, 30);
  // 손으로 적은 이름. 기울여 쓰면 인쇄와 갈린다
  ctx.font = `italic 700 54px ${font}`;
  ctx.fillText(labels.name, -40, 34);
  ctx.restore();

  ctx.fillStyle = palette.linen;
  ctx.font = `500 21px ${font}`;
  ctx.fillText("정답과 풀이는 별책", 46, 470);
  ctx.fillText("ISBN 979-11-0000-000-0", 46, 508);

  // 바코드: 흰 판 위 검은 막대
  ctx.fillRect(44, 560, 236, 96);
  ctx.fillStyle = palette.frame;
  let x = 58;
  for (const [index, width] of BARCODE.entries()) {
    if (index % 2 === 0) ctx.fillRect(x, 572, width * 2.5, 68);
    x += width * 3.6;
  }
}

/** 표지 한 장을 캔버스에 그려 텍스처로 만든다. 언마운트 때 내려놓는다. */
function useCoverTexture(paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = COVER_W;
    canvas.height = COVER_H;
    const ctx = canvas.getContext("2d");
    if (ctx) paint(ctx);
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    made.anisotropy = 4;
    return made;
  }, [paint]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Book({
  yawRef,
  labels,
  onBackSeen,
}: {
  yawRef: MutableRefObject<number>;
  labels: WorkbookLabels;
  onBackSeen: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const readRef = useRef(0);
  const seenRef = useRef(false);
  const palette = useMemo(resolveRoomPalette, []);
  const font = useMemo(bodyFont, []);
  const paintFrontCover = useMemo(
    () => (ctx: CanvasRenderingContext2D) => paintFront(ctx, palette, font),
    [palette, font],
  );
  const paintBackCover = useMemo(
    () => (ctx: CanvasRenderingContext2D) => paintBack(ctx, palette, font, labels),
    [palette, font, labels],
  );
  const front = useCoverTexture(paintFrontCover);
  const back = useCoverTexture(paintBackCover);

  // BoxGeometry의 면 순서: +x, -x, +y, -y, +z(앞), -z(뒤). 옆·위·아래는 종이 단면이다
  const materials = useMemo(() => {
    const pages = new MeshStandardMaterial({ color: palette.linen, roughness: 0.92 });
    const spine = new MeshStandardMaterial({ color: palette.fabric, roughness: 0.82 });
    const frontCover = new MeshStandardMaterial({ map: front, roughness: 0.72 });
    const backCover = new MeshStandardMaterial({ map: back, roughness: 0.72 });
    return [pages, spine, pages, pages, frontCover, backCover];
  }, [palette, front, back]);
  useEffect(
    () => () => {
      for (const material of new Set(materials)) material.dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y = yawRef.current;
    if (seenRef.current) return;
    if (Math.cos(yawRef.current) < BACK_FACING_COS) {
      readRef.current += delta;
      if (readRef.current >= READ_SECONDS) {
        seenRef.current = true;
        onBackSeen();
      }
    } else {
      readRef.current = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh material={materials}>
        <boxGeometry args={BOOK_SIZE} />
      </mesh>
    </group>
  );
}

export default function WorkbookTurntable({
  yawRef,
  labels,
  onBackSeen,
}: {
  /** 바깥(드래그·키보드)이 쥐고 있는 각도. 0이 앞표지, π가 뒤표지. */
  yawRef: MutableRefObject<number>;
  labels: WorkbookLabels;
  /** 뒤표지를 읽었을 때 한 번. */
  onBackSeen: () => void;
}) {
  return (
    <Canvas
      // 종이 위에 놓인 물건이라 방의 밤 조명이 아니라 밝은 실내 광으로 세운다
      camera={{ position: [0, 0, 2.3], fov: 30 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} />
      {/* 살짝 위에서 내려다본다. 정면에서 보면 상자가 아니라 그림으로 읽힌다 */}
      <group rotation={[0.16, 0, 0]}>
        <Book yawRef={yawRef} labels={labels} onBackSeen={onBackSeen} />
      </group>
    </Canvas>
  );
}
