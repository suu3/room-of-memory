"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { KEYBOARD_CENTER_X } from "@/minigames/piano-melody/keys";
import { barVisible, MELODY_BARS, SOLFEGE, type Solfege } from "@/minigames/piano-melody/melody";
import { useMemoryRoomStore } from "@/store/memory-room";
import { InteriorBox } from "./InteriorPrimitives";
import type { RoomPalette } from "./palette";
import { blotAlpha, GATHER_DURATION_S, gatherProgress, noteBlurPx } from "./sheet-ink";

/**
 * 보면대에 펼쳐진 악보의 크기(로컬)와 자리. 피아노 부품과 같은 좌표계다.
 *
 * 윗판 앞에 기대 선 나무 보면대. 종이의 아래 끝도 열린 덮개보다 높아야
 * 덮개가 올라오는 도중에 악보를 뚫거나 오선지를 가리지 않는다.
 */
const SHEET = {
  width: 0.95,
  height: 0.3,
  position: [KEYBOARD_CENTER_X, 1.47, 5.95] as const,
  /** 뒤로 살짝 눕혀 세운다: 보면대에 기대 놓은 각. */
  tilt: 0.24,
};

/** 악보 그림의 해상도. 종이의 가로세로(약 3.2:1)를 따른다: 안 맞으면 글자가 늘어난다. */
const TEXTURE = { width: 512, height: 160 };

/** 오선: 맨 윗줄의 y와 줄 간격(px). 음표는 이 간격의 절반씩 내려앉는다. */
const STAFF = { top: 30, gap: 14, left: 34, right: 478 };
/** 계이름 글자가 앉는 줄(px). 오선 아래 한 칸. */
const NAME_Y = 132;
/** 음표 머리의 크기(px)와 기둥 길이. */
const HEAD = { rx: 7, ry: 5, stem: 26 };

/** 계이름이 오선의 어느 높이에 앉는가 (도가 맨 아래). */
function staffY(note: Solfege): number {
  const bottom = STAFF.top + STAFF.gap * 4 + STAFF.gap / 2;
  return bottom - SOLFEGE.indexOf(note) * (STAFF.gap / 2);
}

function canDraw(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return (
    typeof ctx?.fillRect === "function" &&
    typeof ctx.fillText === "function" &&
    typeof ctx.ellipse === "function"
  );
}

interface SheetPaint {
  canvas: HTMLCanvasElement;
  texture: CanvasTexture;
  /** 지금 그림에 굽힌 모임 정도. 같은 값이면 다시 굽지 않는다. */
  gather: number;
}

/**
 * 악보 한 장을 그림으로 굽는다: 오선지 · 음표 · 그 아래 계이름.
 *
 * 3D 안에 글자를 세우는 자리라 DOM을 못 쓴다. 계이름은 언어를 타므로(도/Do/ド)
 * i18n에서 읽어 캔버스에 찍고, 언어가 바뀌면 다시 굽는다.
 *
 * 지워진 마디에는 음표도 글자도 없다. 물에 번진 자국만 남는다: 그 마디는 안방
 * 책상의 찢어진 조각이 들고 있다 (melody의 barVisible).
 *
 * `gather`(0~1)는 그 마디가 **번진 잉크에서 다시 모이는** 정도다 (sheet-ink.ts). 0이면
 * 얼룩만, 1이면 또렷한 음표. 조각을 들고 피아노 앞에 서는 순간 0에서 1로 간다.
 */
function paintSheet(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  paper: string,
  ink: string,
  noteName: (note: Solfege) => string,
  gather: number,
) {
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size.width, size.height);

  // 오선 다섯 줄
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.5;
  for (let line = 0; line < 5; line += 1) {
    ctx.fillRect(STAFF.left, STAFF.top + STAFF.gap * line, STAFF.right - STAFF.left, 1.6);
  }
  ctx.globalAlpha = 1;

  // 모임이 0이면 지워진 마디는 아예 없는 것으로 그린다 (조각 없이 보는 악보)
  const notes = MELODY_BARS.flatMap((bar, barIndex) =>
    bar.map((note) => ({ note, bar: barIndex, hidden: !barVisible(barIndex, false) })),
  );
  const step = (STAFF.right - STAFF.left) / notes.length;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  notes.forEach(({ note, bar, hidden }, index) => {
    const x = STAFF.left + step * (index + 0.5);
    // 마디를 가르는 세로줄. 마디가 안 보여도 줄은 남는다: 몇 음이 지워졌는지 세라고
    if (index > 0 && notes[index - 1].bar !== bar) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x - step / 2, STAFF.top, 1.6, STAFF.gap * 4);
      ctx.globalAlpha = 1;
    }
    if (hidden) {
      if (gather <= 0) return;
      // 모이는 중인 음표: 번짐(blur)이 걷히며 진해진다. 잉크가 거꾸로 모이는 그림
      ctx.filter = `blur(${noteBlurPx(gather).toFixed(2)}px)`;
      ctx.globalAlpha = gather;
    }
    const y = staffY(note);
    ctx.beginPath();
    ctx.ellipse(x, y, HEAD.rx, HEAD.ry, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + HEAD.rx - 1.6, y - HEAD.stem, 1.8, HEAD.stem);
    ctx.fillText(noteName(note), x, NAME_Y);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  });

  // 물에 번진 자국: 지워진 마디를 통째로 덮는다. 잉크가 모일수록 옅어진다
  const blot = notes.filter((entry) => entry.hidden);
  const alpha = blotAlpha(gather);
  if (blot.length > 0 && alpha > 0.002) {
    const from = STAFF.left + step * notes.indexOf(blot[0]);
    const width = step * blot.length;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(from + width / 2, 84, width / 2, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function useSheetPaint(paper: string, ink: string): SheetPaint {
  const paint = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE.width;
    canvas.height = TEXTURE.height;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture, gather: -1 };
  }, []);
  useEffect(() => () => paint.texture.dispose(), [paint]);
  // 색은 팔레트가 정하고 여기서는 다시 굽게만 표시한다. 다음 프레임이 새 색으로 굽는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 색이 바뀌면 굽은 그림을 버려야 한다. 값은 안 쓰고 변화만 듣는다.
  useEffect(() => {
    paint.gather = -1;
  }, [paint, paper, ink]);
  return paint;
}

/**
 * 피아노 보면대에 펼쳐진 악보. 판이 돌 때만이 아니라 **늘** 여기 서 있다.
 *
 * 문제를 말하는 것은 화면의 지시가 아니라 이 종이다. 거실을 걷다 피아노 앞에
 * 서면 오선지와 그 아래 계이름이 보이고, 건반에는 같은 글자가 붙어 있다. 무엇을
 * 하라고 적어 주는 대신 물건 둘을 나란히 두고 사람이 잇게 한다.
 */
export function PianoSheet({ palette, hasScrap }: { palette: RoomPalette; hasScrap: boolean }) {
  const { t } = useTranslation();
  const paint = useSheetPaint(palette.linen, palette.frame);
  const animate = useEffectEnabled("cheap");
  /*
   * 잉크가 모이는 순간 (docs/visual-experiments.md 11장): 조각을 들고 이 악보가 서 있는
   * 거실에 들어서면 번진 마디가 1.5초에 걸쳐 음표로 돌아온다. 조각이 없거나 모션을 끈
   * 판에서는 곧장 끝 상태다. 시작 시각은 ref에 두고 useFrame이 굴린다.
   */
  const inLiving = useMemoryRoomStore((state) => state.space === "living");
  const gatherStart = useRef<number | null>(null);
  const gathered = hasScrap && inLiving;

  useFrame((state) => {
    let gather: number;
    if (!gathered) {
      gatherStart.current = null;
      gather = 0;
    } else if (!animate) {
      gather = 1;
    } else {
      if (gatherStart.current === null) gatherStart.current = state.clock.elapsedTime;
      gather = gatherProgress(state.clock.elapsedTime - gatherStart.current, GATHER_DURATION_S);
    }
    if (gather === paint.gather) return;
    const ctx = paint.canvas.getContext("2d");
    if (!canDraw(ctx)) return;
    paintSheet(
      ctx,
      TEXTURE,
      palette.linen,
      palette.frame,
      (note) => t(`minigame.pianoMelody.notes.${note}`),
      gather,
    );
    paint.texture.needsUpdate = true;
    paint.gather = gather;
  });

  const texture = paint.texture;
  return (
    // 앞면(-z)을 보도록 반 바퀴 돌린 뒤 그 안에서 눕힌다: 안 돌리면 글자가 벽을 보고 뒤집힌다
    <group position={SHEET.position} rotation={[SHEET.tilt, Math.PI, 0]}>
      <InteriorBox
        position={[0, 0, -0.018]}
        size={[1.01, 0.35, 0.03]}
        color={palette.wood}
        radius={0.008}
        roughness={0.48}
      />
      <InteriorBox
        position={[0, -0.164, 0.018]}
        size={[1.04, 0.026, 0.08]}
        color={palette.wood}
        radius={0.006}
        roughness={0.48}
      />
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[SHEET.width, SHEET.height]} />
        <meshStandardMaterial map={texture} roughness={0.9} side={DoubleSide} />
      </mesh>
    </group>
  );
}
