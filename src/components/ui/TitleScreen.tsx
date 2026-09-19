"use client";

import { Warning } from "@phosphor-icons/react";
import {
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "./hover-sfx";
import { LanguageToggle } from "./LanguageToggle";
import { RisingDust } from "./RisingDust";
import { STAGGER_CLASS, staggerStyle } from "./stagger";
import { BACKDROP, BUTTON_DESTRUCTIVE, BUTTON_QUIET, PANEL_DARK } from "./ui-classes";

/**
 * 시작 버튼을 누르고 방이 드러나기까지 로딩 화면을 보여주는 시간.
 *
 * 900ms였는데, 그 사이에 카메라가 방 안으로 내려앉기 시작하는 걸 로딩 화면이
 * 통째로 가렸다. 연출을 넣어 놓고 그 앞을 막고 있던 셈이다. 씬은 타이틀 뒤에서
 * 이미 돌고 있으니 실제로 기다릴 것도 없다. 버튼이 눌렸다는 감각만 남기고 줄인다.
 */
const ENTER_DELAY_MS = 260;

/**
 * 메뉴 항목의 공통 옷. 인디게임 타이틀 메뉴의 관례를 따른다. 항목들은 세로 목록이고,
 * 지금 고른 것 하나만 금빛(hover/focus 색 + ▶ 표식)으로 켜진다.
 * 금빛 글로우는 globals.css의 .title-menu-item이 얹는다.
 *
 * 다만 항목이 전부 같은 크기면 "게임을 시작한다"와 "만든 사람을 본다"가 같은 무게로
 * 선다. 크기만으로 위계를 만들지 않는다 (DESIGN.md > Typography): 게임으로 들어가는
 * 항목은 픽셀 서체 큰 글자, 게임 바깥의 항목은 본문 서체 작은 글자로 갈라 **서체와
 * 색까지** 다르게 준다.
 */
const MENU_ITEM_BASE =
  "title-menu-item group relative w-full cursor-pointer rounded-sm text-left transition-colors duration-150 focus-visible:outline-none";
/** 게임으로 들어가는 항목 (이어하기 · 새 게임) */
const MENU_ITEM_PRIMARY = `${MENU_ITEM_BASE} py-2.5 pl-9 pr-4 font-pixel text-xl tracking-[0.06em]`;
/** 게임 바깥의 항목 (만든 사람). 한 단계 물러난 서체·크기·색 */
const MENU_ITEM_META = `${MENU_ITEM_BASE} py-2 pl-9 pr-4 text-sm font-medium tracking-[0.02em] text-fog hover:text-ivory focus-visible:text-ivory active:text-ivory`;

/** 구역 라벨(조작). 본문 서체 작은 글자 + ash: 메뉴와 같은 크기로 읽히지 않게 */
const LABEL_CLASS = "text-xs font-medium tracking-[0.1em] text-ash";
/**
 * 조작의 이름("이동"·"조사"). 값과 나란히 서므로 **값과 같은 14px**이어야 한다.
 * 픽셀 서체(Galmuri14)는 글리프가 em 박스를 꽉 채워서, 같은 px의 본문 서체보다 크게
 * 보인다. 라벨만 12px로 내리면 서체 차이 위에 크기 차이까지 겹쳐 값이 붕 뜬다.
 * 크기는 맞추고 색(ash/ivory)과 서체로만 가른다.
 */
const CONTROL_LABEL_CLASS = "text-sm font-medium tracking-[0.02em] text-ash";
/** 라벨 양옆의 헤어라인. 글자 하나가 홀로 떠 있지 않게 선 사이에 앉힌다 */
const RULE_CLASS = "h-px w-8 bg-line";

/**
 * 화면 네 귀의 모서리 선. 한 귀가 가로획·세로획 두 개다.
 *
 * 한 덩어리로 두면 "틀이 켜졌다"가 되고, 획을 나눠 각자 제 모서리에서 자라 나오게
 * 하면 "누가 틀을 그었다"가 된다. 자라는 방향(origin)은 항상 모서리 쪽이다.
 */
const FRAME_CORNERS = [
  { key: "tl", box: "left-0 top-0", h: "left-0 top-0 origin-left", v: "left-0 top-0 origin-top" },
  {
    key: "tr",
    box: "right-0 top-0",
    h: "right-0 top-0 origin-right",
    v: "right-0 top-0 origin-top",
  },
  {
    key: "bl",
    box: "bottom-0 left-0",
    h: "bottom-0 left-0 origin-left",
    v: "bottom-0 left-0 origin-bottom",
  },
  {
    key: "br",
    box: "bottom-0 right-0",
    h: "bottom-0 right-0 origin-right",
    v: "bottom-0 right-0 origin-bottom",
  },
] as const;

/**
 * 선택 표식. 라벨은 가운데 그대로 두고 왼쪽에 얹는다. 기본 선택(첫 항목)에는 늘 붙어
 * 있고, 나머지는 hover·키보드 선택에서 왼쪽에서 4px 미끄러져 들어온다. 금빛은 고른 것
 * 하나의 자리다. 밝기만 오가면 "켜졌다"이고, 자리를 옮겨 오면 "다가왔다"다.
 */
function MenuMarker({ always }: { always: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm text-memory transition-[opacity,translate] duration-150 ease-out ${
        always
          ? "opacity-100"
          : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100"
      }`}
    >
      ▶
    </span>
  );
}

/**
 * 항목 아래의 헤어라인. 왼쪽에서 자라 나온다 (DESIGN.md > Motion: 테두리를 새로 그려
 * 레이아웃을 움직이지 않는다. 선은 늘 있고 scale만 바뀐다).
 *
 * 글자를 감싼 span 안에 들어가므로 길이가 메뉴 칸이 아니라 **글자 폭**을 따른다.
 * 왼쪽 정렬 메뉴에서 칸 끝까지 그으면 짧은 라벨 아래로 선만 길게 남는다.
 */
function MenuHairline() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-memory/60 transition-transform duration-150 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
    />
  );
}

/**
 * 게임 시작 화면. 방을 새로 마운트하지 않고 그 위에 덮는다.
 * 뒤에서 3D 씬이 이미 돌고 있어야 메뉴를 고른 순간 지연 없이 들어간다.
 *
 * 화면의 짜임은 인디게임 메인 메뉴다: 큰 타이틀 로고 아래 세로 메뉴
 * (이어하기 · 새 게임 · 만든 사람)가 서고, ↑/↓로 오가며 Enter로 고른다.
 * 저장이 있는 판의 "새 게임"은 진행을 지우므로 확인을 한 번 거친다.
 *
 * 에셋을 받는 동안의 로딩 표시는 여기 없다. 부팅 커튼(BootCurtain)이 이 화면째로
 * 덮고 있다가 다 받으면 걷히므로, 이 화면이 보일 때는 이미 다 받은 뒤다.
 */
export function TitleScreen() {
  const { t } = useTranslation();
  const hint = useControlHint();
  const started = useMemoryRoomStore((state) => state.started);
  const startGame = useMemoryRoomStore((state) => state.startGame);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const setContactOpen = useMemoryRoomStore((state) => state.setContactOpen);
  const reset = useMemoryRoomStore((state) => state.reset);
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  /**
   * 저장된 진행. localStorage에서 되살아나므로 서버 렌더에는 없고, 첫 클라이언트
   * 렌더에서 채워진다. 그래서 "0개면 아무것도 안 보여준다"가 곧 hydration 안전판이다.
   */
  const collectedCount = useMemoryRoomStore((state) => state.collected.length);
  const hasSave = collectedCount > 0;
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  // 눌린 순간 바로 방이 드러나면 전환이 뚝 끊긴다. 로딩 화면을 한 박자 끼워 넣는다.
  // 리셋으로 타이틀에 돌아오면 다시 메뉴가 보여야 하므로 리비전에 묶어 둔다.
  // 단순 boolean이면 리셋 후에도 true로 남아 로딩 화면에서 빠져나오지 못한다.
  const [enteringAtRevision, setEnteringAtRevision] = useState<number | null>(null);
  const entering = enteringAtRevision === resetRevision;
  /** 저장이 있는 판에서 "새 게임"을 골랐다. 지우기 전에 한 번 묻는다. */
  const [confirming, setConfirming] = useState(false);
  /** 부팅 커튼이 걷혔는가. 걷히기 전에는 이 화면이 커튼 뒤에 가려 있다. */
  const booted = useMemoryRoomStore((state) => state.booted);
  /** 커튼이 걷히기 시작했는가. 놓이는 계단(reveal)은 booted보다 이걸 본다. */
  const revealed = useMemoryRoomStore((state) => state.bootRising || state.booted);

  useEffect(() => {
    setUiLock("title", !started);
    return () => setUiLock("title", false);
  }, [started, setUiLock]);

  useEffect(
    () => () => {
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    },
    [],
  );

  // 커튼이 다 걷힌 뒤에 포커스를 준다. 커튼 뒤의 안 보이는 메뉴에 포커스를 박아
  // 두면 키보드로 눌러 보고 아무 일도 안 일어나는 걸 겪은 뒤에야 기다려야 한다는
  // 걸 알게 된다. 첫 항목이 곧 기본 선택이다 (저장이 있으면 이어하기).
  useEffect(() => {
    if (!started && booted) itemsRef.current[0]?.focus();
  }, [started, booted]);

  // 확인 대화상자가 뜨면 포커스도 따라 들어간다. 기본은 취소: 지우는 쪽이
  // Enter 연타에 걸리면 안 된다.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  // Escape로 확인을 물린다. HudMenu처럼 문서 리스너로 받는다. 대화상자 안 어디에
  // 포커스가 있어도 닿아야 한다.
  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      playSound("close");
      setConfirming(false);
      // 물러난 자리로 포커스를 돌려준다. 새 게임은 저장이 있는 판에서 두 번째 항목이다
      itemsRef.current[1]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  if (started) return null;

  /** 방으로 들어간다. reset() 직후에도 맞는 리비전을 읽도록 스토어에서 바로 꺼낸다. */
  const enterGame = () => {
    playSound("open");
    setEnteringAtRevision(useMemoryRoomStore.getState().resetRevision);
    enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
  };

  const closeConfirm = () => {
    playSound("close");
    setConfirming(false);
    // 물러난 자리로 포커스를 돌려준다. 새 게임은 저장이 있는 판에서 두 번째 항목이다
    itemsRef.current[1]?.focus();
  };

  /** 메뉴 항목. `meta`는 게임 바깥으로 나가는 항목(만든 사람)을 가리킨다 */
  const items: { key: string; label: string; meta?: boolean; onSelect: () => void }[] = [
    ...(hasSave ? [{ key: "resume", label: t("titleScreen.resume"), onSelect: enterGame }] : []),
    {
      key: "new-game",
      label: t("titleScreen.start"),
      onSelect: hasSave
        ? () => {
            playSound("select");
            setConfirming(true);
          }
        : enterGame,
    },
    {
      key: "contact",
      label: t("hud.contact"),
      // 게임 바깥의 항목. 서체·크기·색이 한 단계 물러난다
      meta: true,
      onSelect: () => {
        playSound("select");
        setContactOpen(true);
      },
    },
  ];

  /** ↑/↓로 메뉴를 오간다 (끝에서 반대편으로 감긴다). Enter/Space는 버튼 기본 동작. */
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const focusable = itemsRef.current.filter((item): item is HTMLButtonElement => item !== null);
    if (focusable.length === 0) return;
    const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) {
      focusable[0].focus();
      return;
    }
    const delta = event.key === "ArrowDown" ? 1 : -1;
    focusable[(index + delta + focusable.length) % focusable.length].focus();
    // 키보드로 옮겨 다니는 것도 커서를 얹는 것과 같은 몸짓이다
    playSound("hover");
  };

  /*
   * 커튼이 걷히는 동안 로고 → 메뉴 → 안내 → 언어 순으로 한 단씩 놓인다. 커튼 뒤에서
   * 미리 올라와 있으면 걷힌 자리에 이미 다 서 있어서 놓이는 순간이 없다. 걷히기
   * 전에는 숨겨 두었다가(어차피 커튼이 덮고 있다) 커튼이 올라가기 시작하는 프레임
   * (bootRising)에 출발시킨다. 리셋으로 돌아올 때는 이 화면이 다시 마운트되므로
   * 같은 계단을 다시 밟는다.
   */
  /*
   * 시작을 누르면(entering) 올라온 순서 그대로 물러난다. 예전에는 로딩 화면이 한 박자
   * 덮었는데, 씬은 이미 뒤에서 돌고 있어 가릴 것이 없다. 메뉴가 물러나는 동안 카메라가
   * 방 안으로 내려앉기 시작하는 편이 "들어간다"로 읽힌다.
   */
  const reveal = (index: number) =>
    entering
      ? { className: "animate-title-retreat stagger-item", style: staggerStyle(index) }
      : revealed
        ? { className: STAGGER_CLASS, style: staggerStyle(index) }
        : { className: "opacity-0", style: undefined };
  /**
   * 선이 그어지는 등장. 글자(reveal)와 같은 계단에 올라타되, 떠오르는 대신 제 끝에서
   * 자라 나온다. 시작을 누르면 글자와 같이 물러난다.
   */
  const drawn = (index: number, axis: "x" | "y") =>
    entering
      ? { className: "animate-title-retreat stagger-item", style: staggerStyle(index) }
      : revealed
        ? {
            className: `${axis === "x" ? "animate-rule-draw" : "animate-rule-draw-y"} stagger-item`,
            style: staggerStyle(index),
          }
        : { className: "scale-0 opacity-0", style: undefined };
  const menuStart = 1;
  const afterMenu = menuStart + items.length;

  return (
    /*
     * 바깥은 스크롤 그릇, 안쪽이 실제 레이아웃이다.
     *
     * 방(MemoryRoom)이 overflow-hidden이라, 화면이 낮으면 넘친 부분이 스크롤되는 게
     * 아니라 잘려 나갔다. 가로로 눕힌 폰(667×375)에서 제목이 화면 위로 42px 잘리고
     * 조작 안내가 연락처를 덮었다. min-h-full + justify-center면 들어갈 때는 가운데
     * 정렬 그대로고, 안 들어갈 때만 안쪽이 늘어나며 스크롤이 생긴다.
     * (justify-center에 직접 overflow를 걸면 넘친 위쪽에 손이 닿지 않는다.)
     */
    <div
      /*
       * 커튼 뒤에 있는 동안에는 없는 셈 친다. 걷히는 걸 보여주려면 미리 그려 둬야
       * 하는데, 그려 두기만 하고 두면 스크린 리더가 아직 덮여 있는 제목·메뉴를
       * 읽고 Tab이 그리로 들어간다.
       */
      inert={!booted || entering}
      className="absolute inset-0 z-40 overflow-y-auto overscroll-contain"
    >
      {/* 물러나는 동안의 상태 안내. 눈에는 메뉴가 사라지는 것으로 충분하다 */}
      {entering && (
        <p role="status" aria-live="polite" className="sr-only">
          {t("scene.loading")}
        </p>
      )}
      <div className="relative flex min-h-full flex-col gap-7 px-6 py-7 sm:gap-10 sm:px-10 sm:py-10 md:px-16 md:py-14">
        {/* 글자 뒤 가운데만 은은하게 눌러 주는 어둠. 방은 흐리지 않고 윤곽 그대로 둔다.
            방이 배경의 얼룩이 아니라 이 화면의 공간이어야 한다. 가로로 넓은 타원이 아니라
            글자 기둥을 따라 세로로 선 타원인 이유는, 눌러야 하는 것이 방의 가운데가 아니라
            제목부터 언어 토글까지 이어지는 글자의 기둥이기 때문이다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, color-mix(in srgb, var(--color-scene-void) 84%, transparent) 0%, color-mix(in srgb, var(--color-scene-void) 58%, transparent) 34%, transparent 72%), linear-gradient(to top, color-mix(in srgb, var(--color-scene-void) 72%, transparent) 0%, transparent 28%)",
          }}
        />

        {/* 밑에서 떠오르는 먼지: 부팅 커튼과 같은 공기가 타이틀까지 이어진다 */}
        <RisingDust count={22} />

        {/*
          화면 네 귀의 모서리 선. 가운데에 글자 한 덩어리만 떠 있으면 화면이 "비었다"가
          아니라 "덜 놓였다"로 읽힌다. 상자를 하나 더 세우는 대신 귀퉁이만 1px로 집어
          화면에 틀을 준다 (DESIGN.md: 헤어라인 1px 실선만, 점선·2px 금지).
          좁은 화면에서는 여백을 잡아먹으므로 걷는다.
        */}
        <div aria-hidden className="pointer-events-none absolute inset-5 hidden sm:block">
          {FRAME_CORNERS.map((corner) => (
            <span key={corner.key} className={`absolute size-5 ${corner.box}`}>
              <span
                className={`absolute h-px w-full bg-line ${corner.h} ${drawn(0, "x").className}`}
                style={drawn(0, "x").style}
              />
              <span
                className={`absolute h-full w-px bg-line ${corner.v} ${drawn(1, "y").className}`}
                style={drawn(1, "y").style}
              />
            </span>
          ))}
        </div>

        {/*
          로고 블록. 제목은 게임 픽셀 서체(Galmuri14)로 세워 인디게임 로고처럼 읽히고,
          그 위아래로 두 단이 더 선다. 세 줄이 크기만 다르면 "큰 글자 · 중간 글자 ·
          작은 글자"로만 읽힌다. 서체(픽셀/본문)와 색(ivory/fog/ash), 자간까지 갈라야
          제목 · 소개 · 꼬리표가 서로 다른 종류의 글자로 읽힌다 (DESIGN.md > Typography).
          앰버는 여기 쓰지 않는다. 선택(▶)의 자리로만 남긴다.
        */}
        <div className="relative flex flex-1 flex-col justify-center gap-9">
          <div
            className={`flex max-w-lg flex-col items-start gap-3 text-left ${reveal(0).className}`}
            style={reveal(0).style}
          >
            <h1 className="title-logo break-ko font-pixel leading-tight text-ivory">
              {t("title")}
            </h1>
            <p className="max-w-md break-ko text-pretty text-sm leading-relaxed text-fog">
              {t("titleScreen.tagline")}
            </p>
          </div>

          {/*
          메뉴. 이 화면의 유일한 조작부라 설명 문단 없이 목록만 세운다.
          인디게임 메뉴의 문법(같은 크기 세로 목록, 고른 항목만 켜짐)이 곧 설명이다.
        */}
          <nav
            aria-label={t("titleScreen.menu")}
            onKeyDown={onMenuKeyDown}
            className="flex w-64 flex-col items-stretch gap-1"
          >
            {items.map((item, index) => (
              <Fragment key={item.key}>
                {/* 게임 안과 밖을 가르는 선. 만든 사람은 메뉴의 꼬리가 아니라 다른 묶음이다 */}
                {item.meta && index > 0 ? (
                  <span
                    aria-hidden
                    className={`my-2 ml-9 origin-left ${RULE_CLASS} ${drawn(menuStart + index, "x").className}`}
                    style={drawn(menuStart + index, "x").style}
                  />
                ) : null}
                <button
                  ref={(el) => {
                    itemsRef.current[index] = el;
                  }}
                  type="button"
                  onClick={item.onSelect}
                  onPointerEnter={playHoverSound}
                  // 첫 항목이 기본 선택이다. 아이보리에 앰버 표식이 늘 붙고, 나머지는 한 단계 낮다
                  className={`${
                    item.meta
                      ? MENU_ITEM_META
                      : `${MENU_ITEM_PRIMARY} ${index === 0 ? "text-ivory" : "text-ivory/55 hover:text-ivory focus-visible:text-ivory active:text-ivory"}`
                  } ${reveal(menuStart + index).className}`}
                  style={reveal(menuStart + index).style}
                >
                  <MenuMarker always={index === 0} />
                  <span className="relative inline-block">
                    {item.label}
                    {/* 금빛 밑줄은 게임으로 들어가는 항목에만. 꼬리 항목까지 그으면 같은 무게가 된다 */}
                    {item.meta ? null : <MenuHairline />}
                  </span>
                </button>
                {/* 이어하는 판이면 어디까지 왔는지 이어하기 바로 아래에: 무엇의 설명인지 붙어 있어야 한다 */}
                {hasSave && index === 0 ? (
                  <p className="-mt-1 mb-1 pl-9 break-ko text-xs leading-normal text-ash">
                    {t("titleScreen.saved", { count: collectedCount })}
                  </p>
                ) : null}
              </Fragment>
            ))}
          </nav>
        </div>

        {/*
          조작 안내. 예전에는 "이동 클릭 · WASD" 같은 문장 두 개가 같은 크기·같은 색으로
          나란히 놓여 있어, 어디까지가 무엇의 이름이고 어디부터가 누를 것인지 글자만
          봐서는 안 갈렸다. 무엇(이동·조사)은 라벨(본문 서체 · ash), 어떻게(클릭 · WASD)는
          값(픽셀 서체 · ivory)으로 갈라 둘이 다른 종류의 글자로 서게 한다.
          덩어리째 줄바꿈되도록 flex로 나눈다. 좁은 화면에서 아무 데서나 끊기면
          어느 쪽 설명인지 안 읽힌다. 문구는 기기를 따라간다. 폰에서 WASD를 읽어 봐야
          누를 키가 없다.
        */}
        <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pt-5">
          {/* 아래 띠를 여는 선. 왼쪽에서 오른쪽으로 그어지고, 그 위를 금빛 한 점이 한 번 지나간다 */}
          <span
            aria-hidden
            className={`absolute inset-x-0 top-0 h-px origin-left bg-line ${drawn(afterMenu, "x").className}`}
            style={drawn(afterMenu, "x").style}
          >
            {revealed && !entering ? (
              <span className="absolute inset-y-0 left-0 block w-32 animate-rule-sweep bg-gradient-to-r from-transparent via-memory to-transparent" />
            ) : null}
          </span>
          <section
            className={`flex max-w-md flex-col items-start gap-2 ${reveal(afterMenu).className}`}
            style={reveal(afterMenu).style}
          >
            <h2 className={`break-ko ${LABEL_CLASS}`}>{t("titleScreen.controls")}</h2>
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {[
                {
                  key: "move",
                  label: t("titleScreen.moveLabel"),
                  value: hint("titleScreen.howToMove"),
                },
                {
                  key: "examine",
                  label: t("titleScreen.examineLabel"),
                  value: hint("titleScreen.howToExamine"),
                },
              ].map((control) => (
                <div key={control.key} className="flex items-baseline gap-2">
                  <dt className={`break-ko ${CONTROL_LABEL_CLASS}`}>{control.label}</dt>
                  <dd className="break-ko font-pixel text-sm leading-normal text-ivory/85">
                    {control.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 게임 바깥의 것(언어)은 메뉴와 떼어 흐름의 마지막에 둔다. 선 하나로 더 떼어 놓는다 */}
          <footer
            className={`flex flex-col items-start gap-2 ${reveal(afterMenu + 1).className}`}
            style={reveal(afterMenu + 1).style}
          >
            <LanguageToggle tone="bare" />
          </footer>
        </div>
      </div>

      {/* 새 게임 확인: 저장을 지우는 되돌릴 수 없는 동작이라 경고색(ember)이 선다 */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4">
          <div aria-hidden className={BACKDROP} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="new-game-dialog-title"
            className={`relative w-full max-w-md animate-fade-rise p-6 ${PANEL_DARK}`}
          >
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="grid size-9 flex-none place-items-center rounded-full bg-ember/20 text-ember"
              >
                <Warning size={19} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2
                  id="new-game-dialog-title"
                  className="break-ko text-base font-medium leading-snug text-ivory"
                >
                  {t("titleScreen.newGameTitle")}
                </h2>
                <p className="mt-2 break-ko text-pretty text-sm leading-normal text-fog">
                  {t("titleScreen.newGameBody", { count: collectedCount })}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={closeConfirm} className={BUTTON_QUIET}>
                {t("titleScreen.newGameCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  reset();
                  enterGame();
                }}
                className={BUTTON_DESTRUCTIVE}
              >
                {t("titleScreen.newGameConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
