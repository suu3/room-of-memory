"use client";

import { CursorClick, HandTap } from "@phosphor-icons/react";
import { useControlHint, usePointerKind } from "@/i18n/control-hint";
import {
  selectBatReady,
  selectBatTaken,
  selectDoorOpened,
  selectDoorReady,
  useMemoryRoomStore,
} from "@/store/memory-room";

/**
 * 지금 뭘 하면 되는지 한 줄. 진행 바 밑에 알약으로 얹는다.
 *
 * 혼잣말(Monologue)이 감정을 말한다면 이 줄은 조작을 말한다. 막의 경계마다
 * 문구가 바뀐다: 조사 → 방문 → 재조사 → 배트 → 현관. 어느 물건인지는 짚지 않는다.
 * 그건 물건 쪽 비콘과 글로우가 맡고, 여기는 "무엇을 하는 화면인가"만 말한다.
 * 터치 기기에서는 클릭이 탭으로 바뀐다 (useControlHint의 `_touch` 변형).
 */
export function HudGuide() {
  const hint = useControlHint();
  const pointer = usePointerKind();
  const doorReady = useMemoryRoomStore(selectDoorReady);
  const doorOpened = useMemoryRoomStore(selectDoorOpened);
  const batReady = useMemoryRoomStore(selectBatReady);
  const batTaken = useMemoryRoomStore(selectBatTaken);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);

  if (endingStarted) return null;

  const key = batTaken
    ? "hud.guide.exit"
    : batReady
      ? "hud.guide.bat"
      : doorOpened
        ? "hud.guide.revisit"
        : doorReady
          ? "hud.guide.door"
          : "hud.guide.examine";
  const Icon = pointer === "touch" ? HandTap : CursorClick;

  return (
    <p
      role="status"
      className="pointer-events-none mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fog shadow-chip"
    >
      <Icon size={14} weight="bold" className="shrink-0 text-memory" aria-hidden />
      <span className="break-ko">{hint(key)}</span>
    </p>
  );
}
