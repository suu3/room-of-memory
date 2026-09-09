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
import { LanguageToggle } from "./LanguageToggle";
import { LoadingOverlay } from "./LoadingOverlay";
import { RisingDust } from "./RisingDust";
import { BACKDROP, BUTTON_DESTRUCTIVE, BUTTON_QUIET, PANEL_DARK } from "./ui-classes";

/**
 * 시작 버튼을 누르고 방이 드러나기까지 로딩 화면을 보여주는 시간.
 *
 * 900ms였는데, 그 사이에 카메라가 방 안으로 내려앉기 시작하는 걸 로딩 화면이
 * 통째로 가렸다 — 연출을 넣어 놓고 그 앞을 막고 있던 셈이다. 씬은 타이틀 뒤에서
 * 이미 돌고 있으니 실제로 기다릴 것도 없다. 버튼이 눌렸다는 감각만 남기고 줄인다.
 */
const ENTER_DELAY_MS = 260;

/**
 * 메뉴 항목의 공통 옷. 인디게임 타이틀 메뉴의 관례를 따른다 — 항목들은 같은 크기의
 * 세로 목록이고, 지금 고른 것 하나만 금빛(hover/focus 색 + ▶ 표식)으로 켜진다.
 * 금빛 글로우는 globals.css의 .title-menu-item이 얹는다.
 */
const MENU_ITEM_CLASS =
  "title-menu-item group relative w-full cursor-pointer rounded-sm px-10 py-2.5 text-center font-pixel text-xl tracking-[0.06em] transition-colors duration-150 focus-visible:outline-none";

/**
 * 선택 표식. 라벨은 가운데 그대로 두고 왼쪽에 얹는다. 기본 선택(첫 항목)에는 늘 붙어
 * 있고, 나머지는 hover·키보드 선택에서만 떠오른다 — 금빛은 고른 것 하나의 자리다.
 */
function MenuMarker({ always }: { always: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-memory transition-opacity ${
        always
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
      }`}
    >
      ▶
    </span>
  );
}

/**
 * 게임 시작 화면. 방을 새로 마운트하지 않고 그 위에 덮는다 —
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
   * 렌더에서 채워진다 — 그래서 "0개면 아무것도 안 보여준다"가 곧 hydration 안전판이다.
   */
  const collectedCount = useMemoryRoomStore((state) => state.collected.length);
  const hasSave = collectedCount > 0;
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  // 눌린 순간 바로 방이 드러나면 전환이 뚝 끊긴다. 로딩 화면을 한 박자 끼워 넣는다.
  // 리셋으로 타이틀에 돌아오면 다시 메뉴가 보여야 하므로 리비전에 묶어 둔다 —
  // 단순 boolean이면 리셋 후에도 true로 남아 로딩 화면에서 빠져나오지 못한다.
  const [enteringAtRevision, setEnteringAtRevision] = useState<number | null>(null);
  const entering = enteringAtRevision === resetRevision;
  /** 저장이 있는 판에서 "새 게임"을 골랐다 — 지우기 전에 한 번 묻는다. */
  const [confirming, setConfirming] = useState(false);
  /** 부팅 커튼이 걷혔는가. 걷히기 전에는 이 화면이 커튼 뒤에 가려 있다. */
  const booted = useMemoryRoomStore((state) => state.booted);

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

  // 커튼이 다 걷힌 뒤에 포커스를 준다 — 커튼 뒤의 안 보이는 메뉴에 포커스를 박아
  // 두면 키보드로 눌러 보고 아무 일도 안 일어나는 걸 겪은 뒤에야 기다려야 한다는
  // 걸 알게 된다. 첫 항목이 곧 기본 선택이다 (저장이 있으면 이어하기).
  useEffect(() => {
    if (!started && booted) itemsRef.current[0]?.focus();
  }, [started, booted]);

  // 확인 대화상자가 뜨면 포커스도 따라 들어간다. 기본은 취소 — 지우는 쪽이
  // Enter 연타에 걸리면 안 된다.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  // Escape로 확인을 물린다. HudMenu처럼 문서 리스너로 받는다 — 대화상자 안 어디에
  // 포커스가 있어도 닿아야 한다.
  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      playSound("close");
      setConfirming(false);
      // 물러난 자리로 포커스를 돌려준다 — 새 게임은 저장이 있는 판에서 두 번째 항목이다
      itemsRef.current[1]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  if (started) return null;

  if (entering) return <LoadingOverlay label={t("scene.loading")} />;

  /** 방으로 들어간다. reset() 직후에도 맞는 리비전을 읽도록 스토어에서 바로 꺼낸다. */
  const enterGame = () => {
    playSound("open");
    setEnteringAtRevision(useMemoryRoomStore.getState().resetRevision);
    enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
  };

  const closeConfirm = () => {
    playSound("close");
    setConfirming(false);
    // 물러난 자리로 포커스를 돌려준다 — 새 게임은 저장이 있는 판에서 두 번째 항목이다
    itemsRef.current[1]?.focus();
  };

  const items = [
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
  };

  return (
    /*
     * 바깥은 스크롤 그릇, 안쪽이 실제 레이아웃이다.
     *
     * 방(MemoryRoom)이 overflow-hidden이라, 화면이 낮으면 넘친 부분이 스크롤되는 게
     * 아니라 잘려 나갔다 — 가로로 눕힌 폰(667×375)에서 제목이 화면 위로 42px 잘리고
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
      inert={!booted}
      className="absolute inset-0 z-40 overflow-y-auto overscroll-contain"
    >
      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
        {/* 글자 뒤 가운데만 은은하게 눌러 주는 어둠. 방은 흐리지 않고 윤곽 그대로 둔다 —
            방이 배경의 얼룩이 아니라 이 화면의 공간이어야 한다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(46% 42% at 50% 46%, color-mix(in srgb, var(--color-scene-void) 70%, transparent) 0%, color-mix(in srgb, var(--color-scene-void) 42%, transparent) 55%, transparent 100%)",
          }}
        />

        {/* 밑에서 떠오르는 먼지 — 부팅 커튼과 같은 공기가 타이틀까지 이어진다 */}
        <RisingDust count={22} />

        {/* 로고 블록. 눈썹 문구는 제목에 붙은 라벨이지 따로 하는 말이 아니고,
            타이틀은 게임 픽셀 서체(Galmuri14)로 세워 인디게임 로고처럼 읽힌다 */}
        <div className="relative flex flex-col items-center gap-3 text-center">
          <p className="font-pixel text-sm tracking-[0.45em] text-memory/80">
            {t("titleScreen.eyebrow")}
          </p>
          <h1 className="title-logo break-ko font-pixel text-5xl leading-tight text-ivory md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-md break-ko text-pretty text-sm leading-normal text-fog">
            {t("titleScreen.tagline")}
          </p>
        </div>

        {/*
          메뉴. 이 화면의 유일한 조작부라 설명 문단 없이 목록만 세운다 —
          인디게임 메뉴의 문법(같은 크기 세로 목록, 고른 항목만 켜짐)이 곧 설명이다.
        */}
        <nav
          aria-label={t("titleScreen.menu")}
          onKeyDown={onMenuKeyDown}
          className="relative flex w-56 flex-col items-stretch gap-1"
        >
          {items.map((item, index) => (
            <Fragment key={item.key}>
              <button
                ref={(el) => {
                  itemsRef.current[index] = el;
                }}
                type="button"
                onClick={item.onSelect}
                // 첫 항목이 기본 선택이다 — 아이보리에 앰버 표식이 늘 붙고, 나머지는 한 단계 낮다
                className={`${MENU_ITEM_CLASS} ${index === 0 ? "text-ivory" : "text-ivory/55 hover:text-ivory focus-visible:text-ivory active:text-ivory"}`}
              >
                <MenuMarker always={index === 0} />
                {item.label}
              </button>
              {/* 이어하는 판이면 어디까지 왔는지 이어하기 바로 아래에 — 무엇의 설명인지 붙어 있어야 한다 */}
              {hasSave && index === 0 ? (
                <p className="-mt-1 mb-1 text-center text-xs text-fog">
                  {t("titleScreen.saved", { count: collectedCount })}
                </p>
              ) : null}
            </Fragment>
          ))}
        </nav>

        {/*
          조작 안내는 "이동"과 "조사" 두 덩어리다. 한 문장으로 이어 두면 좁은 화면에서
          아무 데서나 끊겨 어느 쪽 설명인지 안 읽힌다 — 덩어리째 줄바꿈되도록 flex로
          나눈다. 문구는 기기를 따라간다 — 폰에서 WASD를 읽어 봐야 누를 키가 없다.
        */}
        <div className="relative flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs leading-normal text-fog/90">
          <span className="break-ko text-pretty">{hint("titleScreen.howToMove")}</span>
          <span className="break-ko text-pretty">{hint("titleScreen.howToExamine")}</span>
        </div>

        {/* 게임 바깥의 것(언어)은 메뉴와 떼어 흐름의 마지막에 둔다 */}
        <footer className="relative mt-4 flex flex-col items-center gap-2">
          <LanguageToggle tone="bare" />
        </footer>
      </div>

      {/* 새 게임 확인 — 저장을 지우는 되돌릴 수 없는 동작이라 경고색(ember)이 선다 */}
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
