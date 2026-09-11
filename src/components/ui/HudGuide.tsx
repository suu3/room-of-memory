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
 * 지금 뭘 하면 되는지 한 줄. 화면 위 가운데, 혼잣말 바로 위에 알약으로 선다.
 *
 * 왼쪽 위 진행 바 밑에 두면 넓은 화면에서 구석에 묻혀 눈에 안 띄고, 폰에서는
 * 헤더가 길어져 혼잣말과 포개진다. 가운데 기둥(MemoryRoom)에 혼잣말과 함께 세운다.
 *
 * 혼잣말(Monologue)이 감정을 말한다면 이 줄은 조작을 말한다. 막의 경계마다
 * 문구가 바뀐다: 조사 → 방문 → 재조사 → 배트 → 현관. 어느 물건인지는 짚지 않는다.
 * 그건 물건 쪽 비콘과 글로우가 맡고, 여기는 "무엇을 하는 화면인가"만 말한다.
 * 터치 기기에서는 클릭이 탭으로 바뀐다 (useControlHint의 `_touch` 변형).
 *
 * 대사창·미니게임·컷씬이 떠 있는 동안은 혼잣말과 함께 물러난다(`hidden`). 대사가
 * 흐르는 중에 "물건을 조사하세요"가 서 있으면 지금 할 수 없는 일을 시키는 셈이다.
 * 언마운트가 아니라 투명이라 돌아올 때 자리가 튀지 않는다.
 */
export function HudGuide({ hidden = false }: { hidden?: boolean }) {
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
      aria-hidden={hidden}
      className={`pointer-events-none inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-fog shadow-chip transition-opacity duration-300 sm:px-4 sm:py-2 sm:text-sm ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <Icon
        size={16}
        weight="bold"
        className="size-3.5 shrink-0 text-memory sm:size-4"
        aria-hidden
      />
      <span className="break-ko">{hint(key)}</span>
    </p>
  );
}
