/**
 * 3D 인스펙트로 돌려 보는 물건들 (InspectTurntable, v4.1 2장).
 *
 * 물건마다 모양·면 그림·찾을 면만 다르다. 글자는 언어를 따라야 하므로 부르는 쪽이
 * 번역한 문자열을 넘기고, 여기서는 그리기만 한다. 그림 파일(`image`)이 들어오면
 * 코드 그림을 덮는다: 파일이 없어도 게임은 돈다 (docs/v4.md의 에셋 표).
 *
 * 만든 객체는 부르는 쪽이 useMemo로 붙잡아야 한다. 면 그림이 바뀌면 텍스처를 다시 굽는다.
 */

import { ASSETS } from "@/lib/assets";
import type { RoomPalette } from "@/scenes/memory-room/palette";
import type { FacePainter, InspectObject } from "./InspectTurntable";

/** 방의 기억 색 대신 쓰는 손글씨 잉크. 팔레트의 가장 짙은 색. */
const ink = (palette: RoomPalette) => palette.frame;

/**
 * 라온생명과학연구소 로고: 둥근 테 안에 떠오르는 해 하나. 앰플 라벨·출입증 뒷면·
 * 컴퓨터 로고 매칭(computer-logo의 Logo)이 같은 모양이다. `half`면 왼쪽 반만 남는다.
 */
export function paintRaonLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  half = false,
) {
  ctx.save();
  if (half) {
    ctx.beginPath();
    ctx.rect(cx - radius * 1.3, cy - radius * 1.3, radius * 1.3, radius * 2.6);
    ctx.clip();
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  // ui-raon-logo.svg와 같은 도형: 둥근 테, 수평선, 떠오르는 해, 빛살 셋 (테 반지름 96 기준 비율)
  const u = radius / 96;
  ctx.lineWidth = 12 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 60 * u, cy + 23 * u);
  ctx.lineTo(cx + 60 * u, cy + 23 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + 23 * u, 37 * u, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 52 * u);
  ctx.lineTo(cx, cy - 32 * u);
  ctx.moveTo(cx - 40 * u, cy - 34 * u);
  ctx.lineTo(cx - 25 * u, cy - 18 * u);
  ctx.moveTo(cx + 40 * u, cy - 34 * u);
  ctx.lineTo(cx + 25 * u, cy - 18 * u);
  ctx.stroke();
  ctx.restore();
}

/** 손으로 적은 줄: 기울이고 이탤릭으로. 인쇄와 갈린다. */
function handwrite(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  font: string,
  color: string,
  tilt = -0.04,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  ctx.font = `italic 700 ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** 여러 줄 손글씨. 폭을 넘으면 글자 단위로 접는다 (한국어·일본어는 띄어쓰기가 없을 수 있다). */
function handwriteLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; width: number },
  size: number,
  font: string,
  color: string,
) {
  ctx.font = `italic 700 ${size}px ${font}`;
  const lines: string[] = [];
  let line = "";
  for (const char of Array.from(text)) {
    if (ctx.measureText(line + char).width > box.width && line) {
      lines.push(line);
      line = char.trimStart();
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  lines.forEach((each, index) => {
    handwrite(ctx, each, box.x, box.y + index * size * 1.35, size, font, color);
  });
}

/* ── 문제집 (1페이즈, 뒤표지에 이름) ───────────────────────────────────────── */

export interface WorkbookLabels {
  /** 뒤표지 이름표에 적힌 이름 (characters.hero.name). */
  name: string;
  /** 이름표의 작은 제목 ("이름"). */
  tagLabel: string;
  /** 이름 옆의 학년 ("고3"). */
  tagGrade: string;
}

/** 뒤표지 바코드의 막대 폭 패턴. 읽히는 코드가 아니라 인쇄물로 보이게 하는 무늬다. */
const BARCODE = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1] as const;

const paintWorkbookFront: FacePainter = (ctx, { width, height }, palette, font) => {
  ctx.fillStyle = palette.fabric;
  ctx.fillRect(0, 0, width, height);
  // 방의 모델(scripts/create-student-props.mjs)과 같은 구성: 연도 · 시리즈 · 제목 · 부제
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
};

function paintWorkbookBack(labels: WorkbookLabels): FacePainter {
  return (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.fabric;
    ctx.fillRect(0, 0, width, height);
    // 이름표: 누가 가져갈까 봐 붙여 둔 종이 한 장. 표지에 조금 비뚤게 붙어 있다
    ctx.save();
    ctx.translate(width / 2, 150);
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
    ctx.font = `italic 700 54px ${font}`;
    ctx.fillText(labels.name, -40, 34);
    ctx.restore();

    ctx.fillStyle = palette.linen;
    ctx.font = `500 21px ${font}`;
    ctx.fillText("정답과 풀이는 별책", 46, 470);
    ctx.fillText("ISBN 979-11-0000-000-0", 46, 508);
    ctx.fillRect(44, 560, 236, 96);
    ctx.fillStyle = palette.frame;
    let x = 58;
    for (const [index, bar] of BARCODE.entries()) {
      if (index % 2 === 0) ctx.fillRect(x, 572, bar * 2.5, 68);
      x += bar * 3.6;
    }
  };
}

/** 책상 위 문제집: 뒤표지 이름표에 이름. */
export function workbookObject(labels: WorkbookLabels): InspectObject {
  return {
    shape: "box",
    size: [0.62, 0.86, 0.07],
    front: { paint: paintWorkbookFront },
    back: { paint: paintWorkbookBack(labels) },
    edge: "linen",
    foundYaw: Math.PI,
  };
}

/* ── 식탁 카드 (2페이즈, 뒷면에 엄마 메모) ─────────────────────────────────── */

/** 판 위에 엎어 둔 카드의 등: 트럼프 뒷무늬. 뒤집기 전에는 이것만 보인다. */
const paintCardPattern: FacePainter = (ctx, { width, height }, palette) => {
  ctx.fillStyle = palette.linen;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.clay;
  ctx.fillRect(24, 24, width - 48, height - 48);
  ctx.strokeStyle = palette.linen;
  ctx.lineWidth = 3;
  for (let offset = -height; offset < width + height; offset += 28) {
    ctx.beginPath();
    ctx.moveTo(offset, 24);
    ctx.lineTo(offset + height, height - 24);
    ctx.stroke();
  }
};

/** 카드 한 장. 뒷면(찾을 면)이 엄마가 볼펜으로 적은 메모. */
export function cardObject(memo: string, signature: string): InspectObject {
  const paintMemo: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    // 원래 카드 앞면의 무늬가 구석에 남아 있고, 빈 데에 메모를 적었다
    ctx.fillStyle = palette.clay;
    ctx.font = `700 64px ${font}`;
    ctx.fillText("♥", 30, 86);
    handwriteLines(
      ctx,
      memo,
      { x: width / 2, y: height * 0.4, width: width * 0.78 },
      46,
      font,
      ink(palette),
    );
    handwrite(ctx, signature, width * 0.66, height * 0.78, 40, font, ink(palette));
  };
  return {
    shape: "box",
    size: [0.5, 0.7, 0.012],
    front: { paint: paintCardPattern },
    back: { paint: paintMemo, image: ASSETS.images.mgCardFlipBack },
    edge: "linen",
    foundYaw: Math.PI,
    tilt: 0.3,
  };
}

/* ── 거꾸로 꽂힌 책 (3페이즈, 뒤표지 안쪽에 "11") ────────────────────────────── */

/** 선반의 책: 앞표지는 야구 규칙 해설서, 뒤표지 안쪽에 아빠 손글씨 번호. */
export function shelfBookObject(title: string, number: string): InspectObject {
  const paintCover: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.sage;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.linen;
    ctx.font = `700 52px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(title, width / 2, height * 0.32);
    ctx.fillRect(width * 0.2, height * 0.38, width * 0.6, 3);
  };
  const paintInside: FacePainter = (ctx, { width, height }, palette, font) => {
    // 표지를 열면 나오는 면지: 누렇게 바랜 종이
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = palette.sage;
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, width, height);
    handwrite(ctx, number, width / 2, height * 0.46, 220, font, ink(palette), -0.08);
  };
  return {
    shape: "box",
    size: [0.46, 0.66, 0.06],
    front: { paint: paintCover },
    back: { paint: paintInside, image: ASSETS.images.mgShelfBookInside },
    edge: "linen",
    foundYaw: Math.PI,
  };
}

/* ── 출입증 (4페이즈, 뒷면에 라온 로고) ─────────────────────────────────────── */

export interface IdCardLabels {
  org: string;
  role: string;
  names: readonly [string, string];
}

/** 출입증 두 장 중 위의 한 장. 앞면에 이름, 뒷면에 연구소 로고. */
export function idCardObject(labels: IdCardLabels): InspectObject {
  const paintFront: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.sage;
    ctx.fillRect(0, 0, width, height * 0.2);
    ctx.fillStyle = palette.linen;
    ctx.font = `700 38px ${font}`;
    ctx.fillText(labels.org, 28, height * 0.13);
    // 사진 자리: 얼굴은 비워 둔다
    ctx.fillStyle = palette.trim;
    ctx.fillRect(28, height * 0.28, width * 0.26, height * 0.6);
    ctx.fillStyle = palette.frame;
    ctx.font = `500 30px ${font}`;
    ctx.fillText(labels.role, width * 0.36, height * 0.4);
    ctx.font = `700 44px ${font}`;
    ctx.fillText(labels.names[0], width * 0.36, height * 0.56);
    ctx.fillText(labels.names[1], width * 0.36, height * 0.72);
  };
  const paintBack: FacePainter = (ctx, { width, height }, palette) => {
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    paintRaonLogo(ctx, width / 2, height / 2, height * 0.3, palette.sage);
  };
  return {
    shape: "box",
    size: [0.86, 0.54, 0.012],
    front: { paint: paintFront, image: ASSETS.images.mgIdCardFront },
    back: { paint: paintBack, image: ASSETS.images.mgIdCardBack },
    edge: "linen",
    foundYaw: Math.PI,
    tilt: 0.25,
  };
}

/* ── 앰플 보냉 케이스와 앰플 (3페이즈) ───────────────────────────────────────── */

/** 보냉 케이스. 오른쪽 옆면의 창으로 들여다보면 두 칸 중 한 칸이 비어 있다. */
export function ampouleCaseObject(caution: string): InspectObject {
  const paintLid: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.daylight;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.frame;
    ctx.font = `700 44px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(caution, width / 2, height / 2 + 14);
  };
  const paintWindow: FacePainter = (ctx, { width, height }, palette) => {
    ctx.fillStyle = palette.daylight;
    ctx.fillRect(0, 0, width, height);
    // 창 안: 두 칸. 왼쪽 칸에만 앰플이 누워 있다
    ctx.fillStyle = palette.deep;
    ctx.fillRect(width * 0.12, height * 0.2, width * 0.76, height * 0.6);
    ctx.fillStyle = palette.leaf;
    ctx.fillRect(width * 0.2, height * 0.3, width * 0.22, height * 0.4);
    ctx.strokeStyle = palette.linen;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(width * 0.56, height * 0.3, width * 0.22, height * 0.4);
  };
  return {
    shape: "box",
    size: [0.9, 0.46, 0.5],
    front: { paint: paintLid },
    back: { paint: paintLid },
    side: { paint: paintWindow },
    edge: "daylight",
    foundYaw: -Math.PI / 2,
    tilt: 0.28,
  };
}

/**
 * 케이스에서 꺼낸 앰플. 라벨은 반쯤 지워졌고, 남은 조각에 로고의 왼쪽 반이 있다.
 * 띠의 한가운데가 로고 자리라 π만큼 돌려야 보인다 (InspectObject.foundYaw).
 */
/*
 * 앰플 라벨은 옆면을 한 바퀴 다 덮지 않고 앞쪽 60%에 띠로 감긴다. 그림 파일
 * (mg-ampoule-label.webp)은 4:1 가로 띠라 높이는 폭에서 나온다:
 * 폭 = 둘레(π × 0.2) × 0.6, 높이 = 폭 / 4 → 옆면 높이(0.78)의 약 12%.
 */
const AMPOULE_DIAMETER = 0.2;
const AMPOULE_HEIGHT = 0.78;
const LABEL_U = { from: 0.2, to: 0.8 };
const LABEL_ASPECT = 4;
const LABEL_HEIGHT =
  (Math.PI * AMPOULE_DIAMETER * (LABEL_U.to - LABEL_U.from)) / LABEL_ASPECT / AMPOULE_HEIGHT;
/** 라벨 그림 안에서 로고가 선 가로 위치 (0~1). 반쯤 가려진 로고가 찾을 면이다. */
const LABEL_LOGO_X = 0.15;
const LOGO_U = LABEL_U.from + (LABEL_U.to - LABEL_U.from) * LABEL_LOGO_X;

export function ampouleObject(): InspectObject {
  const labelRect = {
    x: LABEL_U.from,
    y: 0.5 - LABEL_HEIGHT / 2,
    width: LABEL_U.to - LABEL_U.from,
    height: LABEL_HEIGHT,
  };
  const paintLabel: FacePainter = (ctx, { width, height }, palette) => {
    ctx.fillStyle = palette.daylight;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.linen;
    ctx.fillRect(
      width * labelRect.x,
      height * labelRect.y,
      width * labelRect.width,
      height * labelRect.height,
    );
    const logoX = width * LOGO_U;
    paintRaonLogo(ctx, logoX, height / 2, height * labelRect.height * 0.35, palette.sage, true);
    // 지워진 자리: 긁힌 자국 몇 줄
    ctx.strokeStyle = palette.daylight;
    ctx.lineWidth = 4;
    for (let index = 0; index < 4; index++) {
      const y = height * (labelRect.y + labelRect.height * (0.2 + index * 0.2));
      ctx.beginPath();
      ctx.moveTo(logoX, y);
      ctx.lineTo(logoX + width * 0.06, y - 3);
      ctx.stroke();
    }
  };
  return {
    shape: "cylinder",
    size: [AMPOULE_DIAMETER, AMPOULE_HEIGHT, AMPOULE_DIAMETER],
    front: {
      paint: paintLabel,
      image: ASSETS.images.mgAmpouleLabel,
      imageRect: labelRect,
      imageBase: "daylight",
    },
    edge: "leaf",
    // 옆면의 u는 θ = 2πu 자리에 있고, 물건을 -θ만큼 돌리면 그 자리가 카메라를 본다
    foundYaw: -2 * Math.PI * LOGO_U,
    tilt: 0.1,
  };
}
