"use client";

import { useEffect, useState } from "react";
import type { Pose } from "./Fighter";

/**
 * 격투 게임 도트 캐릭터를 스프라이트 시트로 갈아끼우기 위한 계약.
 *
 * 에셋은 사용자가 직접 넣는다(.claude/rules/assets.md — 미니게임용 이미지).
 * 파일이 없으면 Fighter가 지금처럼 블록 캐릭터로 그리므로, 넣기 전에도 게임은 돈다.
 *
 * ## 넣는 법
 *
 * 1. 아래 두 파일을 `public/assets/images/`에 둔다.
 *    - `mg-fighter-duel-hero.webp`  — 플레이어(왼쪽)
 *    - `mg-fighter-duel-rival.webp` — 상대(오른쪽)
 * 2. 두 장 다 **가로로 이어붙인 5프레임 시트**여야 한다. 순서는 POSE_ORDER 그대로:
 *    `idle → strike → guard → throw → hurt`
 * 3. 프레임 하나는 224×320 px, 따라서 시트 전체는 **1120×320 px**.
 *    (화면에는 112×160으로 그려진다 — 2배로 만들어야 고해상도 화면에서 안 뭉갠다.)
 * 4. 캐릭터는 **오른쪽을 보게** 그린다. 상대는 코드가 좌우로 뒤집어 쓴다.
 * 5. 배경은 투명(알파). 프레임마다 발바닥이 같은 y에 오게 맞춘다 — 어긋나면
 *    자세가 바뀔 때마다 캐릭터가 위아래로 튄다.
 *
 * 무대 배경(선택): `mg-fighter-duel-stage.webp`, 960×256. 없으면 지금의 그라디언트가
 * 그대로 보인다 — 이쪽은 CSS가 알아서 떨어지므로 코드에서 존재 확인을 하지 않는다.
 *
 * 용량 한도는 이미지 1MB/장. 도트 그림이면 webp로 수십 KB면 충분하다.
 */
export const POSE_ORDER = ["idle", "strike", "guard", "throw", "hurt"] as const satisfies Pose[];

/** 시트 한 프레임의 원본 크기(px). 화면 표시 크기는 Fighter가 정한다. */
export const FRAME_SIZE = { width: 224, height: 320 } as const;

/**
 * 배경 이미지로 프레임을 잘라 쓸 때의 background-position.
 * 시트를 프레임 개수만큼 확대해 놓았으므로(background-size: 500% 100%),
 * 위치는 0%~100%를 프레임 개수-1로 나눈 눈금이 된다.
 */
export function framePosition(pose: Pose): string {
  const index = POSE_ORDER.indexOf(pose);
  const step = 100 / (POSE_ORDER.length - 1);
  return `${(index < 0 ? 0 : index) * step}% 50%`;
}

export const frameBackgroundSize = `${POSE_ORDER.length * 100}% 100%`;

type SheetState = "loading" | "ready" | "missing";

/** 한 번 확인한 시트는 다시 묻지 않는다 — 라운드마다 Image를 새로 만들 이유가 없다. */
const sheetCache = new Map<string, "ready" | "missing">();

/**
 * 시트가 있는지 미리 알아본다. 게임이 뜨기 전에 결론이 나 있어야
 * 블록 캐릭터가 한 프레임 비쳤다 바뀌는 걸 안 본다.
 */
export function preloadSpriteSheet(src: string): void {
  if (typeof window === "undefined" || sheetCache.has(src)) return;
  const image = new Image();
  image.onload = () => sheetCache.set(src, image.naturalWidth > 0 ? "ready" : "missing");
  image.onerror = () => sheetCache.set(src, "missing");
  image.src = src;
}

/**
 * 스프라이트 시트가 실제로 있는지 확인한다.
 *
 * 파일을 안 넣었으면 404가 나고, 그때는 블록 캐릭터로 돌아가야 한다.
 * <img onError>로는 안 되는 게, 시트는 background-image로 쓰기 때문에
 * 실패를 알려주는 이벤트가 없다.
 */
export function useSpriteSheet(src: string): SheetState {
  const [state, setState] = useState<SheetState>(() => sheetCache.get(src) ?? "loading");

  useEffect(() => {
    const cached = sheetCache.get(src);
    if (cached) {
      setState(cached);
      return;
    }

    let active = true;
    const settle = (result: "ready" | "missing") => {
      sheetCache.set(src, result);
      if (active) setState(result);
    };

    const image = new Image();
    image.onload = () => settle(image.naturalWidth > 0 ? "ready" : "missing");
    image.onerror = () => settle("missing");
    image.src = src;
    if (image.complete) settle(image.naturalWidth > 0 ? "ready" : "missing");

    return () => {
      active = false;
    };
  }, [src]);

  return state;
}
