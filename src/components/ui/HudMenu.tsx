"use client";

import { Warning } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "./hover-sfx";
import { LanguageToggle } from "./LanguageToggle";
import { MenuGlyph } from "./MenuGlyph";
import {
  BACKDROP,
  BUTTON_DESTRUCTIVE,
  BUTTON_QUIET,
  CHIP_BASE,
  CHIP_IDLE,
  CHIP_SELECTED,
  FOCUS_RING,
  HUD_CHOICE_BASE,
  HUD_CHOICE_IDLE,
  HUD_CHOICE_SELECTED,
  HUD_ICON_BUTTON,
  MENU_ITEM,
  ON_SCENE_TEXT,
  PANEL_DARK,
  SECTION_LABEL,
} from "./ui-classes";

/** 한 줄에 둘이 나눠 앉는 항목: 폭만 반씩, 나머지는 MENU_ITEM과 같다. */
const PAIR_ITEM_CLASS = `${MENU_ITEM} flex-1 justify-center text-center`;

/** 펼친 줄의 무리 사이 가는 세로선 */
function InlineDivider() {
  return <span aria-hidden className="h-[1em] w-px flex-none bg-ivory/25" />;
}

/** 펼친 줄 아래 칸의 글자 항목 (만든 사람 · 피드백 · 리셋) */
const INLINE_LINK = `cursor-pointer rounded-sm px-[0.25em] py-[0.15em] font-medium transition-colors duration-150 ${FOCUS_RING}`;
const INLINE_LINK_TONE = "text-fog hover:text-ivory active:text-ivory";

/**
 * 오른쪽 위의 메뉴.
 *
 * `inline`이면 햄버거로 접지 않고 내용물을 장면 위에 한 줄로 펼친다. 폭이 넉넉한 데스크톱
 * 화면에서는 버튼 하나를 눌러 패널을 여는 것보다 언어·난이도·오토가 늘 보이는 편이 낫다.
 * 윗줄은 설정(바로 바뀌는 것), 아랫줄은 부속 화면으로 가는 글자 항목이다. 패널의 설명
 * 문구(난이도·오토 힌트)는 줄에 둘 자리가 없어 각 항목의 title로 옮겼다.
 * 어느 쪽을 쓸지는 MemoryRoom이 화면 폭으로 정한다.
 */
export function HudMenu({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const setContactOpen = useMemoryRoomStore((state) => state.setContactOpen);
  const setFeedbackOpen = useMemoryRoomStore((state) => state.setFeedbackOpen);
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  const setDifficulty = useMemoryRoomStore((state) => state.setDifficulty);
  const autoPlay = useMemoryRoomStore((state) => state.autoPlay);
  const setAutoPlay = useMemoryRoomStore((state) => state.setAutoPlay);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 펼친 줄은 떠 있는 패널이 아니라 방 입력을 막지 않는다. 막는 것은 리셋 확인창뿐이다
  const dropdownOpen = open && !inline;

  useEffect(() => {
    setUiLock("hud-menu", dropdownOpen || confirming);
    return () => setUiLock("hud-menu", false);
  }, [dropdownOpen, confirming, setUiLock]);

  // 리셋 확인창도 Esc로 닫힌다 (타이틀의 확인창과 같다)
  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  // 창을 넓혀 줄로 펼쳐지면 열려 있던 패널은 닫아 둔다. 다시 좁히면 닫힌 햄버거로 돌아온다
  useEffect(() => {
    if (inline) setOpen(false);
  }, [inline]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const confirmDialog = confirming && (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden p-4">
      <div aria-hidden className={BACKDROP} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        className={`relative w-full max-w-md animate-fade-rise p-6 ${PANEL_DARK}`}
      >
        <div className="flex items-start gap-3.5">
          {/* 되돌릴 수 없는 동작이라 아이콘으로 먼저 걸러준다. 텍스트가 이미 설명하므로 장식 */}
          <span
            aria-hidden
            className="grid size-9 flex-none place-items-center rounded-full bg-ember/20 text-ember"
          >
            <Warning size={19} weight="fill" />
          </span>
          <div className="min-w-0">
            <h2
              id="reset-dialog-title"
              className="break-ko text-base font-medium leading-snug text-ivory"
            >
              {t("reset.title")}
            </h2>
            <p className="mt-2 break-ko text-pretty text-sm leading-normal text-fog">
              {t("reset.body")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirming(false)} className={BUTTON_QUIET}>
            {t("reset.cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              playSound("close");
              reset();
              setConfirming(false);
            }}
            className={BUTTON_DESTRUCTIVE}
          >
            {t("reset.confirm")}
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        <div className={`${ON_SCENE_TEXT} flex flex-col items-end text-hud`}>
          {/* 윗줄은 옆의 소리 버튼(2.75em)과 같은 높이라 버튼과 가운데 줄이 맞는다 */}
          <div className="flex h-[2.75em] items-center">
            <div className="flex items-center gap-[0.9em] text-hud-caption">
              <LanguageToggle tone="hud" />
              <InlineDivider />
              <fieldset className="flex gap-[0.25em]">
                <legend className="sr-only">{t("difficulty.label")}</legend>
                {(["guided", "normal"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      playSound("select");
                      setDifficulty(mode);
                    }}
                    aria-pressed={difficulty === mode}
                    title={t(mode === "guided" ? "difficulty.guidedHint" : "difficulty.normalHint")}
                    className={`${HUD_CHOICE_BASE} ${difficulty === mode ? HUD_CHOICE_SELECTED : HUD_CHOICE_IDLE}`}
                  >
                    {t(`difficulty.${mode}`)}
                  </button>
                ))}
              </fieldset>
              <InlineDivider />
              {/* 켬/끔 칩 둘 대신 스위치 하나: 밑줄이 켜짐이다 */}
              <button
                type="button"
                onClick={() => {
                  playSound("select");
                  setAutoPlay(!autoPlay);
                }}
                aria-pressed={autoPlay}
                title={t("dialogue.autoHint")}
                className={`${HUD_CHOICE_BASE} ${autoPlay ? HUD_CHOICE_SELECTED : HUD_CHOICE_IDLE}`}
              >
                {t("dialogue.auto")}
              </button>
            </div>
          </div>
          {/* 부속 화면으로 가는 글자. 설정 줄보다 한 치수 작게 선다 */}
          <div className="text-hud-caption">
            <div className="flex items-center gap-[0.35em] text-[0.875em]">
              <button
                type="button"
                onClick={() => {
                  playSound("select");
                  setContactOpen(true);
                }}
                className={`${INLINE_LINK} ${INLINE_LINK_TONE}`}
              >
                {t("hud.contact")}
              </button>
              <span aria-hidden className="text-ash">
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  playSound("select");
                  setFeedbackOpen(true);
                }}
                className={`${INLINE_LINK} ${INLINE_LINK_TONE}`}
              >
                {t("feedback.title")}
              </button>
              <span aria-hidden className="text-ash">
                ·
              </span>
              {/* 되돌릴 수 없는 유일한 항목이라 한 톤 죽이고, 누르면 확인창부터 뜬다 */}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${INLINE_LINK} text-ash hover:text-ember active:text-ember`}
              >
                {t("hud.reset")}
              </button>
            </div>
          </div>
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          playSound(open ? "close" : "open");
          setOpen(!open);
        }}
        onPointerEnter={playHoverSound}
        aria-expanded={open}
        aria-label={open ? t("menu.close") : t("menu.open")}
        // 열려 있는 동안은 패널과 같은 표면으로 서서 "이 버튼이 저 패널의 것"임을 말한다
        className={`${HUD_ICON_BUTTON} ${open ? "border-line bg-surface text-ivory" : ""}`}
      >
        <MenuGlyph open={open} />
      </button>

      {open && (
        <div
          // 넓은 화면에서는 버튼(--text-hud)과 같은 배율로 통째로 커진다 (--hud-zoom)
          // 바탕은 PANEL_DARK의 반투명 surface가 아니라 불투명한 night다. 패널 뒤로 소리
          // 버튼·미니맵이 비쳐 보여 패널 위에 겹친 것처럼 읽혔다
          // 세로가 짧은 화면(가로 폰)에서는 패널이 화면 밖으로 나간다. 버튼 아래부터
          // 바닥 여백까지로 높이를 막고 안에서 스크롤시킨다. 6rem = 위 HUD 줄 + 아래 여백
          className="absolute right-0 top-full mt-2 max-h-[calc(100dvh-6rem)] w-68 animate-fade-rise overflow-y-auto overscroll-contain rounded-md border border-line bg-night p-4 text-ivory shadow-panel [zoom:var(--hud-zoom)]"
        >
          {/* 눈에 보이는 라벨. 읽히는 이름은 각 fieldset의 legend라 여기서는 소리를 끈다. 둘 다 읽으면 "언어 선택 언어 선택" */}
          <p aria-hidden className={`px-1 ${SECTION_LABEL}`}>
            {t("language.label")}
          </p>
          <div className="mt-2">
            <LanguageToggle tone="dark" />
          </div>
          <p aria-hidden className={`mt-4 px-1 ${SECTION_LABEL}`}>
            {t("difficulty.label")}
          </p>
          {/* 이지=다음 할 일 안내 + 스킵, 보통=스킵만. 안내는 next-step, 스킵은 useSkipEligible */}
          <fieldset className="mt-2 flex gap-1.5">
            <legend className="sr-only">{t("difficulty.label")}</legend>
            {(["guided", "normal"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  playSound("select");
                  setDifficulty(mode);
                }}
                aria-pressed={difficulty === mode}
                className={`${CHIP_BASE} ${difficulty === mode ? CHIP_SELECTED : CHIP_IDLE}`}
              >
                {t(`difficulty.${mode}`)}
              </button>
            ))}
          </fieldset>
          {/* 어느 쪽이 켜져 있는지 말로도 남긴다. 칩 두 개만으로는 뜻이 안 읽힌다 */}
          <p className="mt-1.5 break-ko px-1 text-xs leading-normal text-ash">
            {t(difficulty === "guided" ? "difficulty.guidedHint" : "difficulty.normalHint")}
          </p>
          {/*
            오토: 대사가 저절로 넘어간다. 난이도와 같은 성격의 설정이라 같은 칩 두 개로 둔다.
            min-w-0은 RoomInteractionPrompt와 같은 이유: fieldset이 안 줄어들면 화면이 밀린다
          */}
          <p className={`${SECTION_LABEL} mt-4`}>{t("dialogue.auto")}</p>
          <fieldset className="mt-2 flex min-w-0 gap-1.5">
            <legend className="sr-only">{t("dialogue.auto")}</legend>
            {([true, false] as const).map((mode) => (
              <button
                key={String(mode)}
                type="button"
                onClick={() => {
                  playSound("select");
                  setAutoPlay(mode);
                }}
                aria-pressed={autoPlay === mode}
                className={`${CHIP_BASE} ${autoPlay === mode ? CHIP_SELECTED : CHIP_IDLE}`}
              >
                {t(mode ? "dialogue.autoOn" : "dialogue.autoOff")}
              </button>
            ))}
          </fieldset>
          <p className="mt-1.5 break-ko px-1 text-xs leading-normal text-ash">
            {t("dialogue.autoHint")}
          </p>
          {/* 소리 on/off는 메뉴 밖으로 나갔다. SoundToggle 참고. */}
          {/* 수첩은 여기 없다. 오른쪽 가장자리 손잡이(NotebookTab)가 유일한 입구다. */}
          <div className="my-3 h-px bg-line" />
          {/* 만든 사람 · 피드백은 성격이 같은 부속 화면이라 한 줄에 나란히 둔다 */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                playSound("select");
                setOpen(false);
                setContactOpen(true);
              }}
              className={PAIR_ITEM_CLASS}
            >
              {t("hud.contact")}
            </button>
            <span aria-hidden className="mx-1 h-3.5 w-px flex-none bg-line" />
            <button
              type="button"
              onClick={() => {
                playSound("select");
                setOpen(false);
                setFeedbackOpen(true);
              }}
              className={PAIR_ITEM_CLASS}
            >
              {t("feedback.title")}
            </button>
          </div>
          {/* 리셋은 다른 항목과 갈라 세운다. 되돌릴 수 없는 유일한 항목이다 */}
          <div className="my-3 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className={`${MENU_ITEM} text-ash hover:text-ember`}
          >
            {t("hud.reset")}
          </button>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
