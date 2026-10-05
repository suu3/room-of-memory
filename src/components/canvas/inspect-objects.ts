/**
 * 3D 인스펙트로 집어 드는 물건들 (InspectTurntable, v4.1 2장).
 *
 * 물건마다 모양·면 그림과 **손이 하는 일**이 다르다: 문제집은 돌려서 뒤표지를, 쪽지는
 * 펼쳐서 안쪽을, 책은 장을 넘겨 귀 접힌 쪽을, 출입증은 기울여 홀로그램을 본다. 글자는
 * 언어를 따라야 하므로 부르는 쪽이 번역한 문자열을 넘기고, 여기서는 그리기만 한다.
 * 그림 파일(`image`)이 들어오면 코드 그림을 덮는다: 파일이 없어도 게임은 돈다
 * (docs/story/implementation-status.md의 에셋 표).
 *
 * 만든 객체는 부르는 쪽이 useMemo로 붙잡아야 한다. 면 그림이 바뀌면 텍스처를 다시 굽는다.
 */

import { ASSETS } from "@/lib/assets";
import type { RoomPalette } from "@/scenes/memory-room/world/palette";
import type { FacePainter, InspectFace, InspectObject } from "./InspectTurntable";

/** 방의 기억 색 대신 쓰는 손글씨 잉크. 팔레트의 가장 짙은 색. */
const ink = (palette: RoomPalette) => palette.frame;

/**
 * 라온생명과학연구소 로고: 둥근 테 안에 떠오르는 해 하나. 앰플 라벨·출입증 뒷면·
 * 컴퓨터 로고 매칭(computer-logo의 Logo)이 같은 모양이다. `half`면 왼쪽 반만 남는다.
 */
function paintRaonLogo(
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
  // 줄바꿈(\n)은 적은 사람이 끊은 자리다: 폭이 남아도 거기서 내려 쓴다
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > box.width && line) {
        lines.push(line);
        line = char.trimStart();
      } else {
        line += char;
      }
    }
    if (line) lines.push(line);
  }
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
}

/** 뒤표지 바코드의 막대 폭 패턴. 읽히는 코드가 아니라 인쇄물로 보이게 하는 무늬다. */
const BARCODE = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1] as const;

const paintWorkbookFront: FacePainter = (ctx, { width, height }, palette, font) => {
  ctx.fillStyle = palette.fabric;
  ctx.fillRect(0, 0, width, height);
  // 방의 모델(scripts/assets/create-student-props.mjs)과 같은 구성: 연도 · 시리즈 · 제목 · 부제
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
  // 수능 한 달 전에 붙여 둔 디데이 스티커. 게임이 "그날"을 수능 한 달 전으로 못박는 첫 사물이다
  ctx.save();
  ctx.translate(width - 108, 96);
  ctx.rotate(0.06);
  ctx.fillStyle = palette.linen;
  ctx.fillRect(-78, -40, 156, 80);
  ctx.restore();
  handwrite(ctx, "수능 D-30", width - 108, 96, 30, font, palette.clay, 0.06);
};

/** 이름표의 이름 글자(px). 테 안쪽 오른쪽 끝은 x = 178이다. */
const NAME_TAG_SIZE = 54;
/** 짧은 이름(한도해)이 서는 자리와 그 자리에 드는 폭. */
const NAME_TAG_SHORT_X = -40;
const NAME_TAG_SHORT_WIDTH = 200;
/** 긴 이름이 서는 자리와 폭: 라벨 오른쪽에서 테 안쪽 끝 앞까지. */
const NAME_TAG_LONG_X = -96;
const NAME_TAG_LONG_WIDTH = 256;

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
    ctx.font = `italic 700 ${NAME_TAG_SIZE}px ${font}`;
    // 긴 이름(Han Do-hae · ハン・ドヘ)은 테 밖으로 삐져나간다: 왼쪽으로 당기고, 그래도 넘치면 글자를 줄인다
    const measured = ctx.measureText(labels.name).width;
    const long = measured > NAME_TAG_SHORT_WIDTH;
    if (measured > NAME_TAG_LONG_WIDTH) {
      ctx.font = `italic 700 ${(NAME_TAG_SIZE * NAME_TAG_LONG_WIDTH) / measured}px ${font}`;
    }
    ctx.fillText(labels.name, long ? NAME_TAG_LONG_X : NAME_TAG_SHORT_X, 34);
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

/* ── 식탁 위 쪽지 (2페이즈, 안쪽에 엄마 메모) ─────────────────────────── */

/** 메모장에서 뜯은 노란 종이: 줄 친 바탕, 위쪽 뜯긴 자리, 가운데 접힌 자국. 방의 쪽지와 같은 색. */
function paintNotePaper(
  ctx: CanvasRenderingContext2D,
  { width, height }: { width: number; height: number },
  palette: RoomPalette,
  crease: "down" | "across" = "down",
) {
  ctx.fillStyle = palette.sun;
  ctx.fillRect(0, 0, width, height);
  // 줄
  ctx.strokeStyle = palette.trim;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  for (let y = height * 0.28; y < height - 20; y += height * 0.14) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
  }
  // 뜯긴 자리: 위쪽에 스프링 구멍이 찢겨 나간 자국
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = palette.trim;
  for (let x = 30; x < width - 20; x += 36) {
    ctx.beginPath();
    ctx.arc(x, 12, 6, 0, Math.PI);
    ctx.fill();
  }
  // 반으로 접었다 편 자국
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = palette.frame;
  ctx.beginPath();
  if (crease === "across") {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
  } else {
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * 식탁 위에 반으로 접어 둔 쪽지. 겉은 빈 종이이고, 위로 끌어 펼치면 안쪽에 엄마가
 * 볼펜으로 적은 메모다. 접힌 자국은 가로(윗반이 아랫반 위로 엎어진다)라 메모는
 * 위아래 반쪽에 나뉘어 붙는다: 글줄은 접힌 선을 피해 윗반과 아랫반에 따로 앉힌다.
 */
export function tableNoteObject(memo: string): InspectObject {
  const paintMemo: FacePainter = (ctx, size, palette, font) => {
    paintNotePaper(ctx, size, palette, "across");
    handwriteLines(
      ctx,
      memo,
      { x: size.width / 2, y: size.height * 0.3, width: size.width * 0.8 },
      46,
      font,
      ink(palette),
    );
  };
  return {
    shape: "folded-note",
    size: [0.74, 0.52, 0.006],
    paper: (ctx, size, palette) => paintNotePaper(ctx, size, palette, "across"),
    memo: paintMemo,
    tilt: 0.3,
  };
}

/* ── 거꾸로 꽂힌 책 (3페이즈, 귀 접힌 쪽에 "11") ───────────────────────────── */

/** 책의 낱장 수. 앞표지 한 장 + 본문 넉 장. 찾을 쪽은 세 장 넘긴 오른쪽이다. */
const SHELF_BOOK_SHEETS = 5;
/** 찾을 쪽의 `pages` 인덱스: 낱장 3의 앞면. */
const SHELF_BOOK_TARGET = 6;

/** 인쇄된 본문 흉내: 글줄을 회색 막대로 놓는다. 읽을 글이 아니라 "글이 있다"는 결이다. */
function paintPrintedPage(pageNumber: number, onRight: boolean): FacePainter {
  return (ctx, { width, height }, palette, font) => {
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    // 책등 쪽 그늘: 오른쪽 쪽은 왼쪽 가장자리가, 왼쪽 쪽은 오른쪽 가장자리가 어둡다
    const shade = ctx.createLinearGradient(
      onRight ? 0 : width,
      0,
      onRight ? width * 0.18 : width * 0.82,
      0,
    );
    shade.addColorStop(0, "rgba(0, 0, 0, 0.16)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    const left = width * (onRight ? 0.16 : 0.1);
    const right = width * (onRight ? 0.9 : 0.84);
    ctx.fillStyle = palette.trim;
    ctx.globalAlpha = 0.75;
    // 소제목 한 줄과 문단 셋. 줄 길이는 쪽 번호에서 정해져 늘 같다 (리렌더에 흔들리지 않는다)
    ctx.fillRect(left, height * 0.1, (right - left) * 0.42, height * 0.022);
    let y = height * 0.16;
    for (let line = 0; line < 22; line++) {
      const seed = Math.sin(pageNumber * 7.1 + line * 3.3) * 0.5 + 0.5;
      const endOfParagraph = line % 8 === 7;
      const length = endOfParagraph ? 0.35 + seed * 0.4 : 0.92 + seed * 0.08;
      ctx.fillRect(left, y, (right - left) * length, height * 0.013);
      y += height * (endOfParagraph ? 0.05 : 0.033);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.frame;
    ctx.font = `500 ${Math.round(height * 0.028)}px ${font}`;
    ctx.textAlign = onRight ? "right" : "left";
    ctx.fillText(String(pageNumber), onRight ? right : left, height * 0.95);
  };
}

/** 귀 접힌 쪽: 오른쪽 위 귀퉁이가 안으로 접혀 있다. 그림 파일이 덮인 뒤에도 위에 남는다. */
const paintDogEar: FacePainter = (ctx, { width }, palette) => {
  const size = width * 0.2;
  // 접혀서 드러난 자리: 뒤 쪽(다음 장)이 비친다
  ctx.fillStyle = palette.trim;
  ctx.beginPath();
  ctx.moveTo(width - size, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, size);
  ctx.closePath();
  ctx.fill();
  // 접힌 귀 자체: 종이 뒷면이 위로 올라와 조금 밝다
  ctx.fillStyle = palette.daylight;
  ctx.beginPath();
  ctx.moveTo(width - size, 0);
  ctx.lineTo(width, size);
  ctx.lineTo(width - size, size);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = palette.frame;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

/**
 * 책장 사이에 끼워 둔 쪽지. 인쇄된 본문 위에 비스듬히 얹힌 작은 종이에 손글씨로
 * 번호 세 자리. 쪽에 바로 적힌 글씨가 아니라 끼워 둔 종이라야 "남기고 간 것"으로 읽힌다.
 */
function paintTuckedSlip(
  ctx: CanvasRenderingContext2D,
  { width, height }: { width: number; height: number },
  palette: RoomPalette,
  font: string,
  number: string,
) {
  const slipWidth = width * 0.64;
  const slipHeight = height * 0.3;
  ctx.save();
  ctx.translate(width * 0.52, height * 0.46);
  ctx.rotate(-0.06);
  // 종이 그림자: 본문 위에 떠 있는 한 장
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(-slipWidth / 2 + 8, -slipHeight / 2 + 10, slipWidth, slipHeight);
  ctx.fillStyle = palette.daylight;
  ctx.fillRect(-slipWidth / 2, -slipHeight / 2, slipWidth, slipHeight);
  ctx.strokeStyle = palette.trim;
  ctx.lineWidth = 2;
  ctx.strokeRect(-slipWidth / 2, -slipHeight / 2, slipWidth, slipHeight);
  // 번호 밑에 한 번 그은 줄: 적고 나서 확인하듯
  ctx.strokeStyle = ink(palette);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-slipWidth * 0.3, slipHeight * 0.3);
  ctx.quadraticCurveTo(0, slipHeight * 0.36, slipWidth * 0.32, slipHeight * 0.26);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  // 세 자리가 쪽지 폭 안에 넉넉히 들어오는 크기 (면 해상도에 맞춰 비례)
  handwrite(ctx, number, width * 0.52, height * 0.45, width * 0.2, font, ink(palette), -0.1);
}

/**
 * 선반의 책: 앞표지는 야구 규칙 해설서. 장을 넘기면 세 장째 오른쪽, 귀 접힌 쪽에
 * 쪽지가 끼워져 있고 손으로 쓴 번호가 적혀 있다. 거꾸로 꽂아 둔 건 이 쪽을 찾으라는 표시였다.
 */
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
  const paintEndpaper: FacePainter = (ctx, { width, height }, palette) => {
    // 표지 안쪽의 면지: 누렇게 바랜 종이
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = palette.sage;
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, width, height);
  };
  const paintMarked: FacePainter = (ctx, { width, height }, palette, font) => {
    paintPrintedPage(SHELF_BOOK_TARGET - 1, true)(ctx, { width, height }, palette, font);
    paintTuckedSlip(ctx, { width, height }, palette, font, number);
  };
  const pages: InspectFace[] = [];
  for (let sheet = 0; sheet < SHELF_BOOK_SHEETS; sheet++) {
    const frontIndex = sheet * 2;
    const backIndex = sheet * 2 + 1;
    pages.push(
      sheet === 0
        ? { paint: paintCover }
        : frontIndex === SHELF_BOOK_TARGET
          ? { paint: paintMarked, overlay: paintDogEar }
          : { paint: paintPrintedPage(frontIndex - 1, true) },
    );
    pages.push(
      sheet === 0 ? { paint: paintEndpaper } : { paint: paintPrintedPage(backIndex - 1, false) },
    );
  }
  return {
    shape: "book",
    size: [0.46, 0.66, 0.03],
    cover: "sage",
    pages,
    target: SHELF_BOOK_TARGET,
    tilt: 0.5,
  };
}

/* ── 출입증 (4페이즈, 사진 위 홀로그램에 라온 로고) ────────────────────────── */

/**
 * 홀로그램 씰이 앉는 자리: 아빠 사진 위 (mg-id-card-front.webp 1024×640의 548~738 ×
 * 190~435). 신분증의 위조 방지 씰이 사진을 덮는 것과 같다.
 */
const ID_CARD_SEAL = { x: 0.535, y: 0.297, width: 0.186, height: 0.383 };
/** 씰의 로고가 떠오르는 각도: 윗변을 살짝 뒤로 눕히고(빛을 받게) 조금 돌린 자리. */
export const ID_CARD_SPOT = { pitch: -0.45, yaw: 0.35 };

export interface IdCardLabels {
  org: string;
  mom: { department: string; name: string; role: string };
  dad: { department: string; name: string; role: string };
}

/**
 * 출입증 두 장 중 위의 한 장. 앞면에 이름, 사진 위에 홀로그램 씰. 뒷면은 그냥 뒷면이다.
 * 씰은 어느 각도에서나 무지갯빛 결이 비쳐 "여기 뭔가 있다"고 말하지만, 로고는 빛을 받는
 * 각도(ID_CARD_SPOT) 근처에서만 떠오른다.
 */
export function idCardObject(labels: IdCardLabels): InspectObject {
  // 원화의 1024×640 좌표를 사용한다. 실제 텍스처 해상도에 맞춰 함께 축소한다.
  const printLine = (
    ctx: CanvasRenderingContext2D,
    font: string,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    weight: number,
  ) => {
    ctx.font = `${weight} ${size}px ${font}`;
    const measured = ctx.measureText(text).width;
    if (measured > maxWidth) {
      ctx.font = `${weight} ${(size * maxWidth) / measured}px ${font}`;
    }
    ctx.fillText(text, x, y, maxWidth);
  };
  const overlayFront: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.save();
    ctx.scale(width / 1024, height / 640);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = palette.linen;
    printLine(ctx, font, labels.org, 126, 60, 820, 32, 700);
    // 밝은 머리글은 일반 합성, 종이 위 잉크만 multiply로 재질에 섞는다.
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = palette.frame;
    for (const [person, x] of [
      [labels.mom, 278],
      [labels.dad, 759],
    ] as const) {
      ctx.globalAlpha = 0.94;
      printLine(ctx, font, person.department, x, 250, 210, 26, 500);
      printLine(ctx, font, person.name, x, 309, 210, 40, 700);
      ctx.globalAlpha = 0.8;
      printLine(ctx, font, person.role, x, 351, 210, 24, 400);
    }
    ctx.restore();
  };
  const overlayBack: FacePainter = (ctx, { width, height }, palette, font) => {
    ctx.save();
    ctx.scale(width / 1024, height / 640);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = palette.linen;
    printLine(ctx, font, labels.org, 512, 475, 760, 36, 700);
    ctx.restore();
  };
  const paintFront: FacePainter = (ctx, { width, height }, palette) => {
    ctx.save();
    ctx.scale(width / 1024, height / 640);
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = palette.coal;
    ctx.fillRect(0, 0, 1024, 117);
    paintRaonLogo(ctx, 73, 60, 32, palette.memory);
    // 이미지 로딩 전에도 같은 배치를 쓴다. 글자는 overlay에서 한 번만 그린다.
    ctx.fillStyle = palette.trim;
    ctx.fillRect(66, 191, 186, 244);
    ctx.fillRect(548, 191, 186, 244);
    ctx.restore();
  };
  const paintBack: FacePainter = (ctx, { width, height }, palette) => {
    ctx.fillStyle = palette.coal;
    ctx.fillRect(0, 0, width, height);
    paintRaonLogo(ctx, width / 2, height * 0.438, height * 0.214, palette.memory);
  };
  // 씰의 로고: 투명 바탕에 금빛 선. 씰 크기에 맞춰 세로의 6할
  const paintSeal: FacePainter = (ctx, { width, height }, palette) => {
    ctx.clearRect(0, 0, width, height);
    paintRaonLogo(ctx, width / 2, height / 2, Math.min(width, height) * 0.36, palette.memory);
  };
  return {
    shape: "box",
    size: [0.86, 0.54, 0.012],
    front: { paint: paintFront, image: ASSETS.images.mgIdCardFront, overlay: overlayFront },
    back: { paint: paintBack, image: ASSETS.images.mgIdCardBack, overlay: overlayBack },
    edge: "linen",
    // 찾는 것은 면이 아니라 각도다 (hologram). 이 값은 안 쓴다
    foundYaw: 0,
    tilt: 0.25,
    // 그림(1024×640)의 귀는 반지름 약 32px다: 판을 같은 둥글기로 잘라 바깥 픽셀을 가린다
    cornerRadius: 0.027,
    hologram: { paint: paintSeal, rect: ID_CARD_SEAL, spot: ID_CARD_SPOT },
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

/** 케이스에서 꺼낸 앰플. 서랍에서 집는 것과 같은 GLB의 훼손된 라벨을 돌려 본다. */
export function ampouleObject(): InspectObject {
  return {
    shape: "model",
    model: "ampoule",
    size: [0.28, 0.78, 0.28],
    // 라벨의 왼쪽 15%에 남은 로고가 카메라를 향하는 각도.
    foundYaw: Math.PI * 0.525,
    tilt: 0.1,
  };
}
