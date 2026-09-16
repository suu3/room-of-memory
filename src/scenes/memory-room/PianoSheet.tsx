"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import { KEYBOARD_CENTER_X } from "@/minigames/piano-melody/keys";
import { barVisible, MELODY_BARS, SOLFEGE, type Solfege } from "@/minigames/piano-melody/melody";
import type { RoomPalette } from "./palette";

/**
 * 보면대에 펼쳐진 악보의 크기(로컬)와 자리. 피아노 부품과 같은 좌표계다.
 *
 * 두 번 가렸던 자리다. 윗판(y 1.31부터, z 5.97~6.43) 안에 넣으면 종이의 위쪽이 판
 * 속에 묻히고, 젖혀진 뚜껑 뒤에 두면(z 6.0 언저리, y 1.11까지 선다) 오선지가 통째로
 * 가려진다. 그래서 뚜껑보다 앞(z 5.90)·위(y 1.29)다.
 */
const SHEET = {
  width: 0.95,
  height: 0.3,
  position: [KEYBOARD_CENTER_X, 1.29, 5.9] as const,
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

/**
 * 악보 한 장을 그림으로 굽는다: 오선지 · 음표 · 그 아래 계이름.
 *
 * 3D 안에 글자를 세우는 자리라 DOM을 못 쓴다. 계이름은 언어를 타므로(도/Do/ド)
 * i18n에서 읽어 캔버스에 찍고, 언어가 바뀌면 다시 굽는다.
 *
 * 지워진 마디에는 음표도 글자도 없다. 물에 번진 자국만 남는다: 그 마디는 안방
 * 책상의 찢어진 조각이 들고 있다 (melody의 barVisible).
 */
function useSheetTexture(hasScrap: boolean, paper: string, ink: string): CanvasTexture {
  // 언어가 바뀌면 t가 새 것으로 오고(useTranslation이 다시 그린다) 그림도 다시 굽는다
  const { t } = useTranslation();

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE.width;
    canvas.height = TEXTURE.height;
    const ctx = canvas.getContext("2d");
    if (canDraw(ctx)) {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 오선 다섯 줄
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.5;
      for (let line = 0; line < 5; line += 1) {
        ctx.fillRect(STAFF.left, STAFF.top + STAFF.gap * line, STAFF.right - STAFF.left, 1.6);
      }
      ctx.globalAlpha = 1;

      const notes = MELODY_BARS.flatMap((bar, barIndex) =>
        bar.map((note) => ({ note, bar: barIndex, shown: barVisible(barIndex, hasScrap) })),
      );
      const step = (STAFF.right - STAFF.left) / notes.length;
      ctx.font = "600 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      notes.forEach(({ note, bar, shown }, index) => {
        const x = STAFF.left + step * (index + 0.5);
        // 마디를 가르는 세로줄. 마디가 안 보여도 줄은 남는다: 몇 음이 지워졌는지 세라고
        if (index > 0 && notes[index - 1].bar !== bar) {
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x - step / 2, STAFF.top, 1.6, STAFF.gap * 4);
          ctx.globalAlpha = 1;
        }
        if (!shown) return;

        const y = staffY(note);
        ctx.beginPath();
        ctx.ellipse(x, y, HEAD.rx, HEAD.ry, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + HEAD.rx - 1.6, y - HEAD.stem, 1.8, HEAD.stem);
        ctx.fillText(t(`minigame.pianoMelody.notes.${note}`), x, NAME_Y);
      });

      // 물에 번진 자국: 지워진 마디를 통째로 덮는다
      const blot = notes.filter((entry) => !entry.shown);
      if (blot.length > 0) {
        const from = STAFF.left + step * notes.indexOf(blot[0]);
        const width = step * blot.length;
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.ellipse(from + width / 2, 84, width / 2, 58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    made.anisotropy = 4;
    return made;
  }, [hasScrap, paper, ink, t]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/**
 * 피아노 보면대에 펼쳐진 악보. 판이 돌 때만이 아니라 **늘** 여기 서 있다.
 *
 * 문제를 말하는 것은 화면의 지시가 아니라 이 종이다. 거실을 걷다 피아노 앞에
 * 서면 오선지와 그 아래 계이름이 보이고, 건반에는 같은 글자가 붙어 있다. 무엇을
 * 하라고 적어 주는 대신 물건 둘을 나란히 두고 사람이 잇게 한다.
 */
export function PianoSheet({ palette, hasScrap }: { palette: RoomPalette; hasScrap: boolean }) {
  const texture = useSheetTexture(hasScrap, palette.linen, palette.frame);
  return (
    // 앞면(-z)을 보도록 반 바퀴 돌린 뒤 그 안에서 눕힌다: 안 돌리면 글자가 벽을 보고 뒤집힌다
    <group position={SHEET.position} rotation={[0, Math.PI, 0]}>
      <mesh rotation={[SHEET.tilt, 0, 0]}>
        <planeGeometry args={[SHEET.width, SHEET.height]} />
        <meshStandardMaterial map={texture} roughness={0.9} side={DoubleSide} />
      </mesh>
    </group>
  );
}
