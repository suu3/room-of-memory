"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isInteractiveTarget } from "@/components/canvas/room-canvas-runtime";
import { SCRIPTS } from "@/data/memory-room";
import { useTypewriterState } from "@/lib/use-typewriter";
import {
  selectActiveInteraction,
  selectActivePlayback,
  selectHeroNameKnown,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { CharacterPortrait } from "./CharacterPortrait";
import { hasPortrait } from "./character-portrait";
import { PANEL_DIALOGUE } from "./ui-classes";

/**
 * 화면 전체를 덮는 넘기기 버튼의 표식. Enter 핸들러가 "이건 내 버튼"이라고
 * 알아보는 데 쓴다. 클래스나 aria-label로 찾으면 문구를 손볼 때 조용히 깨진다.
 */
const ADVANCE_ATTR = "data-dialogue-advance";

/**
 * 대사창은 대사가 재생 중일 때만 뜬다. 평상시 화면에는 없다.
 *
 * 대사가 들어오는 문은 둘이다: 오브젝트 인터랙션과 재생(전환 컷씬·다시보기).
 * 재생이 자기 창을 따로 갖지 않는 건 기획의 요구다("텍스트는 전부 기존 대사창"):
 * 일러스트에 말풍선을 얹지 않으려면 글은 늘 같은 자리에 있어야 한다.
 */
export function DialogueBox() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const active = useMemoryRoomStore(selectActiveInteraction);
  const heroNameKnown = useMemoryRoomStore(selectHeroNameKnown);
  const playback = useMemoryRoomStore(selectActivePlayback);
  const advanceDialogue = useMemoryRoomStore((state) => state.advanceDialogue);
  const advancePlayback = useMemoryRoomStore((state) => state.advancePlayback);

  // 도입(라디오가 꺼지는 비트)과 정적 구간에는 창이 뜨지 않는다. 침묵도 연출이다
  const playbackLine =
    playback && !playback.intro && !playback.holding
      ? playback.cuts[playback.cutIndex]?.lines[playback.lineIndex]
      : undefined;

  // 인트로 대사와 미니게임 결과 대사가 같은 창을 쓴다. 어느 쪽인지는 스토어가 들고 있다
  const script =
    active?.phase === "dialogue" && active.scriptId ? SCRIPTS[active.scriptId] : undefined;
  const interactionLine = active ? script?.lines[active.lineIndex] : undefined;

  // 재생은 인터랙션이 닫힌 뒤에 열리므로 둘이 겹치지 않는다. 겹쳐도 재생이 이긴다.
  const scriptLine = playbackLine ?? interactionLine;
  // 훅은 조건부로 호출할 수 없으므로 대사가 없을 때도 빈 문자열로 돌린다
  const text = scriptLine ? tRoom(scriptLine.textKey) : "";
  const { typed, done, skip } = useTypewriterState(text);
  const open = scriptLine !== undefined;
  const advanceLine = playbackLine ? advancePlayback : advanceDialogue;
  /** 줄이 바뀔 때마다 본문을 다시 마운트시키는 키: 어느 문에서 온 대사든 하나로. */
  const lineKey = playbackLine
    ? `${playback?.cutsceneId ?? playback?.memoryId}-${playback?.cutIndex}-${playback?.lineIndex}`
    : `${active?.memoryId}-${active?.lineIndex}`;

  /** 지금 Enter가 해야 할 일. 타자 연출 중이면 먼저 다 채우고, 다 찼으면 다음 줄로. */
  const advanceRef = useRef(() => {});
  advanceRef.current = done ? advanceLine : skip;

  /*
   * 화면 아무 데나 클릭하는 것 말고 Enter와 Space로도 넘어간다. VN의 관례라 셋 중
   * 무엇을 눌러도 같은 일이 일어나야 한다. 우하단 화살표는 표식이지 버튼이 아니다.
   *
   * 창 전역에서 캡처 단계로 받는다. 결과 대사 단계에서는 미니게임이 대사창 아래
   * 그대로 살아 있어서(MinigameHost의 resultStage), 버블 단계까지 흘려보내면 같은
   * Enter가 대사와 미니게임을 동시에 움직인다.
   *
   * 다만 캡처는 화면의 모든 Enter를 먼저 가져가므로, 포커스가 잡힌 컨트롤이 있으면
   * 비켜 줘야 한다. 안 그러면 대사 중에 HUD 메뉴로 탭해 둔 사람이 Enter를 눌렀을 때
   * 메뉴는 안 열리고 대사만 넘어간다. 아무 일도 안 일어나는 것보다 나쁘다.
   * 예외는 대사창 자신의 넘기기 버튼이다. 클릭으로 한 번 넘기면 거기 포커스가 남는
   * 탓에, 비켜 주면 "클릭한 뒤부터 Enter가 안 먹는" 꼴이 된다.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Enter" && event.code !== "Space") || event.repeat) return;
      const target = event.target;
      const isOwnButton = target instanceof Element && target.closest(`[${ADVANCE_ATTR}]`) !== null;
      if (!isOwnButton && isInteractiveTarget(target)) return;
      event.preventDefault();
      event.stopPropagation();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open || !scriptLine) return null;

  // 이름을 알기 전의 주인공은 "나"다. 문제집 뒤표지를 보기 전까지 수첩에도 이름이 없다
  const speakerName =
    scriptLine.speaker === "hero" && !heroNameKnown
      ? t("speaker.unknownHero")
      : tRoom(`characters.${scriptLine.speaker}.name` as ParseKeys<"memoryRoom">);

  return (
    // z-50: 미니게임 결과 대사일 때 미니게임 오버레이(z-40) 위로 올라와야 한다.
    // 세로가 짧은 화면(가로 폰)에서는 초상이 창 위로 올라갈 자리가 없다. 창을 뷰포트 안에
    // 붙들어 두는 것이 우선이라, 넘치는 초상 쪽을 잘라 낸다 (overflow-hidden).
    <div className="absolute inset-0 z-50 overflow-hidden">
      {/*
        화면 전체가 "다음" 버튼이다. 대사창 안만 눌리면 어디를 눌러야 하는지
        매번 겨냥해야 한다. 조작 대상이 하나뿐이라 컨트롤도 이 버튼 하나로 둔다.
      */}
      <button
        type="button"
        {...{ [ADVANCE_ATTR]: "" }}
        // 타자 연출 중 클릭은 대사를 건너뛰지 않고 먼저 다 채운다 (VN 관례)
        onClick={done ? advanceLine : skip}
        aria-label={done ? t("dialogue.advance") : t("dialogue.skipTyping")}
        className="absolute inset-0 cursor-pointer"
      />

      {/*
        창 자체는 보여주기만 한다. 클릭은 뒤의 전체 화면 버튼이 받는다.
        아래쪽은 기기의 safe-area만큼 더 띄운다. 홈 바 뒤로 창이 밀려 들어가면
        마지막 줄이 잘린다. 위쪽 여백(pt)은 초상의 자리다: 창 위로 온전히 올라와야 한다.
      */}
      <div className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 w-full max-w-[clamp(840px,66vw,1040px)] -translate-x-1/2 animate-fade-rise px-4 sm:bottom-[max(2rem,env(safe-area-inset-bottom))] lg:bottom-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="relative">
          {/*
            얼굴 없는 화자(라디오 너머의 목소리)는 초상 없이 이름만 남는다.
            컷씬·다시보기도 마찬가지다. 그림이 이미 인물을 보여주는 자리라,
            초상까지 세우면 같은 화면에 도해가 둘이 된다.
          */}
          {!playbackLine && hasPortrait(scriptLine.speaker) && (
            <CharacterPortrait expression={scriptLine.expression ?? "neutral"} talking={!done} />
          )}
          {/*
            공간에 깔리는 어두운 자막 패널 (.dialogue-panel). 사방 테두리·긴 가로선·큰 라운드는
            없다. 조립된 카드가 아니라 화면 아래에 깔린 자막이어야 한다.
          */}
          <div className={`relative text-left text-dialogue ${PANEL_DIALOGUE}`}>
            {/* 화자 이름은 작은 앰버 라벨 하나: 초상이 있어 별도 칩이나 소개 문구는 군더더기다 */}
            {/* 화자가 바뀌면 라벨이 왼쪽에서 미끄러져 들어온다. key가 다시 마운트시킨다 */}
            <span
              key={speakerName}
              className="block animate-speaker-swap text-[0.8125em] font-medium leading-none text-memory"
            >
              {speakerName}
            </span>
            {/*
              두 줄 높이를 늘 확보한다. 한 줄 대사에서 창이 줄었다 다음 줄에서 늘면 글이
              아니라 창이 움직이는 것으로 읽힌다. 그 이상은 문장이 길 때만 자란다.
              글자는 폭 따라 16→24px(--text-dialogue, 패널에 걸려 있다). 넓은 화면에서
              16px 창은 장면에 비해 작아 자막이 아니라 각주로 읽힌다. 여백·최소 높이는
              em이라 글자와 같이 자란다 (3.5em = 행간 1.75의 두 줄).
            */}
            <p
              key={lineKey}
              className="mt-[0.625em] min-h-[3.5em] break-ko text-pretty text-[1em] leading-dialogue text-ivory"
            >
              {typed}
            </p>
            <div className="flex justify-end">
              <div
                aria-hidden
                className={`animate-bob-arrow text-memory transition-opacity ${
                  done ? "opacity-100" : "opacity-0"
                }`}
              >
                <CaretDown size={16} weight="fill" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
