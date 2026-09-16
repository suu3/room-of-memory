"use client";

import { CursorClick, HandTap, MapPin } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint, usePointerKind } from "@/i18n/control-hint";
import {
  selectBatReady,
  selectBatTaken,
  selectDoorOpened,
  selectDoorReady,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";

/**
 * 새 목표가 화면 가운데에 머무는 시간(ms). 읽고 넘길 만큼만. 그 뒤 왼쪽 위 진행 바
 * 밑으로 물러난다.
 */
const BANNER_MS = 4000;

type GuideKey =
  | "hud.guide.lights"
  | "hud.guide.doorway"
  | "hud.guide.examine"
  | "hud.guide.door"
  | "hud.guide.revisit"
  | "hud.guide.bat"
  | "hud.guide.exit";

/**
 * 지금 뭘 하면 되는지 한 줄. 게임의 퀘스트 트래커처럼 군다.
 *
 * 막의 경계에서 목표가 바뀌면(조사 → 방문 → 재조사 → 배트 → 현관) 새 줄이 화면 가운데,
 * 혼잣말 바로 아래에 잠깐 떴다가(`HudGuideBanner`), 왼쪽 위 진행 바 밑의 제자리로
 * 물러나 작은 줄로 남는다(`HudGuideDock`). 가운데에 계속 두면 혼잣말보다 먼저 읽히고,
 * 처음부터 구석에만 두면 넓은 화면에서 목표가 바뀐 줄을 모른다.
 *
 * 둘은 같은 상태(useHudGuide)를 보는 두 개의 자리다. 옮겨 가는 연출은 배너가 구석
 * 쪽으로 밀리며 사라지고 구석 줄이 같은 방향에서 들어오는 것으로 대신한다. 실제로
 * 한 요소를 두 자리 사이에서 움직이려면 자리를 재고 있어야 해서 값에 비해 무겁다.
 *
 * 혼잣말(Monologue)이 감정을 말한다면 이 줄은 조작을 말한다. 어느 물건인지는 짚지
 * 않는다. 그건 물건 쪽 비콘과 글로우가 맡고, 여기는 "무엇을 하는 화면인가"만 말한다.
 * 터치 기기에서는 클릭이 탭으로 바뀐다 (useControlHint의 `_touch` 변형).
 *
 * 대사창·미니게임·컷씬이 떠 있는 동안은 둘 다 물러난다(`hidden`). 대사가 흐르는 중에
 * "물건을 조사하세요"가 서 있으면 지금 할 수 없는 일을 시키는 셈이다. 언마운트가
 * 아니라 투명이라 돌아올 때 자리가 튀지 않는다.
 */
function useHudGuide() {
  const hint = useControlHint();
  const pointer = usePointerKind();
  const doorReady = useMemoryRoomStore(selectDoorReady);
  const doorOpened = useMemoryRoomStore(selectDoorOpened);
  const batReady = useMemoryRoomStore(selectBatReady);
  const batTaken = useMemoryRoomStore(selectBatTaken);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  // 1인칭 구간에는 할 일이 하나뿐이다: 스위치, 또는 문. 나머지 목표는 그 뒤에 온다
  const viewpoint = useMemoryRoomStore(selectViewpoint);

  const key: GuideKey =
    viewpoint === "intro"
      ? "hud.guide.lights"
      : viewpoint === "doorway"
        ? "hud.guide.doorway"
        : batTaken
          ? "hud.guide.exit"
          : batReady
            ? "hud.guide.bat"
            : doorOpened
              ? "hud.guide.revisit"
              : doorReady
                ? "hud.guide.door"
                : "hud.guide.examine";

  /** 가운데 배너에 떠 있는 목표. key와 다르면 새 목표가 막 들어온 것이다. */
  const [bannerKey, setBannerKey] = useState<GuideKey | null>(key);
  useEffect(() => {
    setBannerKey(key);
    const timer = window.setTimeout(() => setBannerKey(null), BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  return {
    text: hint(key),
    /** 1인칭에서만 붙는 조작 한 줄. 둘러보는 법은 이 구간에서 처음 필요해진다. */
    control: viewpoint !== null ? hint("scene.lookHint") : null,
    Icon: pointer === "touch" ? HandTap : CursorClick,
    banner: bannerKey === key,
    gone: endingStarted,
  };
}

/** 화면 가운데(혼잣말 아래)에 잠깐 뜨는 새 목표. 자리는 부모의 가운데 기둥이 정한다. */
export function HudGuideBanner({ hidden = false }: { hidden?: boolean }) {
  const { text, control, Icon, banner, gone } = useHudGuide();
  if (gone) return null;
  const shown = banner && !hidden;

  return (
    <div
      aria-hidden
      className={`monologue-text pointer-events-none flex max-w-full flex-col items-center gap-1 transition-[opacity,transform] duration-300 ease-out ${
        shown ? "opacity-100" : "-translate-x-6 -translate-y-3 opacity-0"
      }`}
    >
      <p className="inline-flex max-w-full items-center gap-[0.4em] text-hud-caption font-medium text-ivory/90">
        <Icon size="1.15em" weight="bold" className="shrink-0 text-memory" aria-hidden />
        <span className="break-ko">{text}</span>
      </p>
      {control && <p className="break-ko text-xs text-fog">{control}</p>}
    </div>
  );
}

/**
 * 왼쪽 위 진행 바 밑의 제자리. 배너가 떠 있는 동안은 비워 두고(투명), 배너가 물러나면
 * 같은 방향에서 들어온다. 늘 렌더되어 헤더 높이가 흔들리지 않는다. 스크린리더에는
 * 이쪽 하나만 들린다 (role="status").
 */
export function HudGuideDock({ hidden = false }: { hidden?: boolean }) {
  const { text, Icon, banner, gone } = useHudGuide();
  if (gone) return null;
  const shown = !banner && !hidden;

  /*
   * 조작 한 줄(control)은 여기 싣지 않는다. 헤더가 한 줄 높아지면 폰에서 그 아래
   * 가운데 기둥(혼잣말)과 겹친다. 조작법은 가운데 배너가 처음 4초 보여주고, 손가락
   * 기기에서는 버튼의 캡션(이동·둘러보기)이 그 뒤로도 말한다.
   */
  return (
    <p
      role="status"
      className={`pointer-events-none inline-flex max-w-full items-center gap-[0.4em] text-[0.75em] font-medium text-fog transition-[opacity,transform] delay-150 duration-300 ease-out ${
        shown ? "opacity-100" : "translate-x-3 translate-y-2 opacity-0"
      }`}
    >
      <Icon size="1.15em" weight="bold" className="shrink-0" aria-hidden />
      <span className="break-ko">{text}</span>
    </p>
  );
}

/**
 * 지금 서 있는 공간의 이름. 진행 줄("2바퀴 · 기억 1/11") 앞에 붙는 한 조각이다.
 *
 * 줄을 새로 만들지 않고 있던 줄에 얹는 이유: 폰에서 헤더가 한 줄 자랄 때마다 그 아래
 * 화면 가운데의 혼잣말과 겹친다. 조작 한 줄을 이 헤더에서 뺀 것과 같은 이유다
 * (HudGuideDock의 주석). 장소는 진행과 같은 성격의 상태라 같은 줄에 앉아도 어색하지 않다.
 *
 * 방문이 열리기 전에는 안 뜬다. 갈 수 있는 데가 방 하나뿐인 동안 "내 방"이라고 적어 봐야
 * 아무것도 말해주지 않는다. 2막부터 공간이 하나씩 열리면서 비로소 "여기가 어디인가"가
 * 정보가 된다 (docs/content-design.md 3-1).
 *
 * 평면도(수첩의 세 번째 페이지)와 같은 이름을 쓴다. 한쪽이 "안방", 다른 쪽이 "부모님 방"이면
 * 둘이 다른 곳으로 읽힌다: 이름은 i18n의 `space.*` 한 군데에 있다.
 */
export function HudSpaceLine() {
  const { t } = useTranslation();
  const space = useMemoryRoomStore((state) => state.space);
  const doorOpened = useMemoryRoomStore(selectDoorOpened);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);

  if (!doorOpened || endingStarted) return null;
  const name = t(`space.${space}` as const);

  return (
    <span className="inline-flex items-center gap-[0.3em] text-[0.75em] font-medium text-fog">
      <MapPin size="1.15em" weight="fill" className="shrink-0" aria-hidden />
      <span className="sr-only">{t("hud.here", { value: name })}</span>
      <span aria-hidden className="break-ko">
        {name}
      </span>
      <span aria-hidden>·</span>
    </span>
  );
}
