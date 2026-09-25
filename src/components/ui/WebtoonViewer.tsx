"use client";

import type { ParseKeys } from "i18next";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { isInteractiveTarget } from "@/components/canvas/room-canvas-runtime";
import { playSound } from "@/lib/audio";
import { useTypewriterState } from "@/lib/use-typewriter";
import { type ActivePlayback, useMemoryRoomStore } from "@/store/memory-room";
import type { CutsceneCut } from "@/types/interaction";
import { typeTick } from "./dialogue-sfx";
import {
  buildWebtoonPages,
  pageGap,
  pagePosition,
  pageWidth,
  type WebtoonRow,
} from "./webtoon-layout";

/** 칸이 떠오르는 시간(ms). 말풍선은 칸이 다 선 뒤에 찍기 시작한다 (globals의 webtoon-panel-in). */
const PANEL_IN_MS = 400;
/** 페이지가 밀려 넘어가는 시간(ms) (globals의 webtoon-page-in/out). */
const PAGE_TURN_MS = 500;
/** 말풍선이 다 찍힌 뒤 다음 칸까지. */
const AFTER_LINE_MS = 600;
/** 웹툰이 걷히는 시간(ms). */
const FADE_OUT_MS = 500;

/**
 * 생존자 방송 웹툰 (CutsceneCut.page). 페이지 단위로 넘기는 뷰어다.
 *
 * 흐름 자체는 다른 컷씬과 같은 재생 스토어(cutIndex·lineIndex·holding)를 탄다. 여기가
 * 맡는 것은 보여주는 방식뿐이다: 페이지 안에서 칸이 번호순으로 떠오르고, 방송 대사는
 * 대사창이 아니라 칸 안의 라디오 말풍선으로 찍힌다. 앞 칸의 말풍선은 제 칸에 남는다.
 * 페이지가 바뀌면 옛 페이지가 왼쪽으로 밀려 나가고 새 페이지가 오른쪽에서 들어온다.
 *
 * 대사 없는 칸은 PlaybackScene의 정적 타이머(holdMs)가 넘기고, 말풍선 칸은 다 찍힌 뒤
 * 0.6초에 여기서 넘긴다. 누르면 찍는 중인 말풍선을 채우고, 한 번 더 누르면 다음 칸.
 *
 * 페이지 없는 컷(웹툰 뒤의 한마디)에 들어서면 웹툰은 걷히고 방이 드러난다. 그 줄은
 * 대사창(DialogueBox)이 받는다.
 */
export function WebtoonViewer({ active }: { active: ActivePlayback }) {
  const { t } = useTranslation();
  const advancePlayback = useMemoryRoomStore((state) => state.advancePlayback);
  const endPlayback = useMemoryRoomStore((state) => state.endPlayback);

  const pages = buildWebtoonPages(active.cuts);
  const cut = active.cuts[active.cutIndex];
  const ended = cut?.page === undefined;
  /** 지금 세운 페이지. 웹툰이 걷히는 동안에는 마지막 페이지가 그대로 남는다. */
  const livePage = cut?.page ?? pages.at(-1)?.page ?? 1;

  // 페이지 넘김: 옛 페이지를 잠깐 붙들고 밀어낸다
  const [shownPage, setShownPage] = useState(livePage);
  const [leavingPage, setLeavingPage] = useState<number | null>(null);
  useEffect(() => {
    if (livePage === shownPage) return;
    setLeavingPage(shownPage);
    setShownPage(livePage);
    const timer = window.setTimeout(() => setLeavingPage(null), PAGE_TURN_MS);
    return () => window.clearTimeout(timer);
  }, [livePage, shownPage]);

  // 걷힌 뒤에는 자리를 비운다. 방 위의 투명한 판이 클릭을 먹지 않게
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ended) return;
    const timer = window.setTimeout(() => setGone(true), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [ended]);

  /*
   * 지금 칸의 말풍선이 찍기 시작해도 되는가. 칸이 다 떠오른 뒤(페이지가 넘어가는 중이면
   * 그것까지 끝난 뒤)에 찍는다. 칸마다 다시 센다.
   */
  const cutKey = `${active.cutsceneId}:${active.cutIndex}:${active.lineIndex}`;
  const turning = leavingPage !== null;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  useEffect(() => {
    const delay = PANEL_IN_MS + (turning ? PAGE_TURN_MS : 0);
    const timer = window.setTimeout(() => setReadyKey(cutKey), delay);
    return () => window.clearTimeout(timer);
  }, [cutKey, turning]);
  const ready = readyKey === cutKey;

  const line = !ended && !active.holding ? cut?.lines[active.lineIndex] : undefined;
  const { t: tRoom } = useTranslation("memoryRoom");
  const lineText = line ? tRoom(line.textKey) : "";
  const { typed, count, done, skip } = useTypewriterState(ready ? lineText : "");
  const typing = line !== undefined && ready;
  const lineDone = typing && done && typed.length === lineText.length;

  // 글자마다의 틱: 대사창과 같은 라디오 음색 (dialogue-sfx)
  const tickedCount = useRef(0);
  useEffect(() => {
    const previous = tickedCount.current;
    tickedCount.current = count;
    if (!line || count !== previous + 1) return;
    const char = Array.from(typed).at(-1);
    if (!char) return;
    const tick = typeTick(line.speaker, char, count);
    if (tick) playSound(tick.id, tick.options);
  }, [count, typed, line]);

  // 지나간 대사에 남긴다. 말풍선으로 흘렀어도 로그에서 되짚을 수 있어야 한다
  const logDialogue = useMemoryRoomStore((state) => state.logDialogue);
  useEffect(() => {
    if (!typing || !line) return;
    logDialogue({ speaker: line.speaker, textKey: line.textKey });
  }, [typing, line, logDialogue]);

  // 다 찍힌 말풍선은 0.6초 붙들었다 다음 칸으로
  useEffect(() => {
    if (!lineDone) return;
    const timer = window.setTimeout(advancePlayback, AFTER_LINE_MS);
    return () => window.clearTimeout(timer);
  }, [lineDone, advancePlayback]);

  /** 누르면: 찍는 중이면 다 채우고, 다 찼거나 말 없는 칸이면 다음 칸. 페이지째 건너뛰지는 않는다. */
  const press = useCallback(() => {
    if (ended || turning) return;
    if (typing && !done) {
      playSound("typeSkip");
      skip();
      return;
    }
    if (line && !ready) {
      setReadyKey(cutKey);
      return;
    }
    playSound("advance");
    advancePlayback();
  }, [ended, turning, typing, done, skip, line, ready, cutKey, advancePlayback]);
  const pressRef = useRef(press);
  pressRef.current = press;

  // Enter·Space도 누르기다 (대사창과 같은 관례). 포커스가 잡힌 컨트롤은 비켜 준다
  useEffect(() => {
    if (ended) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Enter" && event.code !== "Space") || event.repeat) return;
      if (useMemoryRoomStore.getState().dialogueLogOpen) return;
      const target = event.target;
      const isOwn = target instanceof Element && target.closest("[data-webtoon-advance]") !== null;
      if (!isOwn && isInteractiveTarget(target)) return;
      event.preventDefault();
      event.stopPropagation();
      pressRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ended]);

  const viewport = useViewport();
  const width = pageWidth(viewport);
  const gap = pageGap(viewport);
  // 말풍선 글자: 폭 따라 15→20px. 칸 밖으로 걸쳐도 되니 칸 크기에 묶지 않는다
  const fontSize = Math.max(15, Math.min(20, width / 42));

  if (gone) return null;

  const renderPage = (page: number, motion: string) => {
    const rows = pages.find((each) => each.page === page)?.rows ?? [];
    const live = page === livePage && !ended;
    const lastShown = live ? active.cutIndex : Number.POSITIVE_INFINITY;
    // 화면은 지금 칸이 든 줄을 따라 내려간다. 넘어가는 페이지·걷히는 웹툰은 마지막 줄에 멈춰 있다
    const focusRow = live
      ? rows.findIndex((row) => (row.indices as readonly number[]).includes(active.cutIndex))
      : rows.length - 1;
    const top = pagePosition({
      rows,
      width,
      gap,
      viewportHeight: viewport.height,
      focusRow,
      overhang: fontSize * BUBBLE_OVERHANG_EM,
    });
    return (
      <div key={`page-${page}`} className={`absolute inset-0 ${motion}`}>
        <div
          className="absolute top-0 left-1/2 flex flex-col transition-transform duration-700 ease-out"
          style={{ width, gap, transform: `translate(-50%, ${top}px)` }}
        >
          {rows.map((row) => (
            <PageRow
              key={row.indices[0]}
              row={row}
              cuts={active.cuts}
              lastShown={lastShown}
              current={ended ? -1 : active.cutIndex}
              typed={typed}
              typing={typing}
              gap={gap}
              width={width}
              fontSize={fontSize}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    // z-40: 컷씬 판과 같은 층. 3D 방은 페이지 바탕에 완전히 가려진다
    <div
      className={`absolute inset-0 z-40 overflow-hidden bg-scene-coal transition-opacity duration-500 ${
        ended ? "pointer-events-none opacity-0" : "animate-webtoon-page-fade opacity-100"
      }`}
    >
      {leavingPage !== null && renderPage(leavingPage, "animate-webtoon-page-out")}
      {renderPage(shownPage, leavingPage !== null ? "animate-webtoon-page-in" : "")}

      {/* 화면 전체가 "다음" 버튼이다 (대사창과 같은 조작) */}
      <button
        type="button"
        data-webtoon-advance=""
        onClick={press}
        aria-label={typing && !done ? t("dialogue.skipTyping") : t("dialogue.advance")}
        className="absolute inset-0 cursor-pointer"
      />

      {/*
        컷씬 전체 건너뛰기: 접근성 장치. 페이지만 건너뛰는 버튼은 두지 않는다. 오른쪽 위에
        선다: 말풍선이 칸 아래쪽에 앉으므로 아래 구석에 두면 마지막 줄 칸을 가린다.
      */}
      <button
        type="button"
        onClick={endPlayback}
        className="absolute top-4 right-4 z-10 cursor-pointer rounded-sm border border-fog/50 bg-night/80 px-3.5 py-2 font-pixel text-xs tracking-[0.2em] text-ivory shadow-chip transition-colors duration-150 hover:border-ivory/70 hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
      >
        {t("playback.skip")}
      </button>
    </div>
  );
}

/** 페이지의 한 줄: 16:9 칸 하나, 또는 3:4 칸 둘. */
function PageRow({
  row,
  cuts,
  lastShown,
  current,
  typed,
  typing,
  gap,
  width,
  fontSize,
}: {
  row: WebtoonRow;
  cuts: readonly CutsceneCut[];
  lastShown: number;
  current: number;
  typed: string;
  typing: boolean;
  gap: number;
  width: number;
  fontSize: number;
}) {
  return (
    <div className={row.kind === "full" ? "" : "grid grid-cols-2"} style={{ gap }}>
      {row.indices.map((index, slot) => {
        const cut = cuts[index];
        if (!cut) return null;
        return (
          <Panel
            key={index}
            cut={cut}
            side={row.kind === "full" ? "full" : slot === 0 ? "left" : "right"}
            // 앞 칸이 위에 선다: 칸 아래로 걸친 말풍선이 다음 칸 그림에 덮이지 않게
            layer={cuts.length - index}
            shown={index <= lastShown}
            speaking={index === current}
            typed={typed}
            typing={typing}
            pageWidth={width}
            fontSize={fontSize}
          />
        );
      })}
    </div>
  );
}

/** 칸 아래로 걸치는 말풍선 몫(em). 마지막 줄 아래에 이만큼 자리를 더 둔다. */
const BUBBLE_OVERHANG_EM = 2.6;
/** 3:4 칸의 말풍선 폭: 칸보다 넓게, 페이지 폭의 이만큼 (칸 밖으로 걸친다). */
const PAIR_BUBBLE_WIDTH = 0.66;

/** 그림에 얹는 의성어 (무음으로 하는 사람도 소리를 본다). 칸의 sfx로 고른다. */
const SFX_CAPTION = { micTap: "playback.sfx.micTap" } as const;

/**
 * 칸 하나. 검은 3px 테두리, 그림은 가운데 기준으로 채운다. 아직 차례가 안 온 칸은
 * 자리만 지킨다(보이지 않게): 칸이 들 때마다 페이지가 흔들리면 안 된다.
 */
function Panel({
  cut,
  side,
  layer,
  shown,
  speaking,
  typed,
  typing,
  pageWidth,
  fontSize,
}: {
  cut: CutsceneCut;
  side: "full" | "left" | "right";
  layer: number;
  shown: boolean;
  speaking: boolean;
  typed: string;
  typing: boolean;
  pageWidth: number;
  fontSize: number;
}) {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const [missing, setMissing] = useState(false);
  const line = cut.lines[0];
  // 지나간 칸의 말풍선은 다 찍힌 채 남는다. 지금 칸은 찍히는 만큼만
  const bubbleText = line ? (speaking ? (typing ? typed : null) : tRoom(line.textKey)) : null;
  const caption = cut.sfx ? SFX_CAPTION[cut.sfx as keyof typeof SFX_CAPTION] : undefined;
  /*
   * 말풍선은 칸 아래 테두리에 걸쳐 칸 밖으로 나간다. 16:9 칸은 칸 폭 안에서, 3:4 칸은
   * 칸보다 넓게 페이지 안쪽으로 뻗는다 (왼쪽 칸은 오른쪽으로, 오른쪽 칸은 왼쪽으로).
   */
  const bubblePlace =
    side === "full"
      ? { left: "6%", right: "6%" }
      : side === "left"
        ? { left: "5%", width: pageWidth * PAIR_BUBBLE_WIDTH }
        : { right: "5%", width: pageWidth * PAIR_BUBBLE_WIDTH };

  return (
    <div
      className={`relative ${cut.ratio === "3:4" ? "aspect-[3/4]" : "aspect-video"} ${
        shown ? "animate-webtoon-panel-in" : "invisible"
      }`}
      style={{ zIndex: layer }}
    >
      {/* 그림은 칸 테두리 안에서만 잘린다. 말풍선·의성어는 이 바깥에 선다 */}
      <div className="absolute inset-0 overflow-hidden border-[3px] border-scene-void bg-scene-storm">
        {cut.image && !missing && (
          /* biome-ignore lint/performance/noImgElement: 파일이 없을 때 onError로 빈 칸에 떨어져야 해서 최적화 파이프라인을 타지 않는다. */
          <img
            src={cut.image}
            alt=""
            draggable={false}
            onError={() => setMissing(true)}
            className="absolute inset-0 size-full select-none object-cover object-center"
          />
        )}
      </div>
      {caption && (
        <p
          aria-hidden
          className="webtoon-sfx pointer-events-none absolute top-[9%] left-[36%] -rotate-8 font-bold italic tracking-[0.08em]"
          style={{ fontSize: pageWidth / 13 }}
        >
          {t(caption)}
        </p>
      )}
      {line && bubbleText !== null && (
        <RadioBubble
          speaker={tRoom(`characters.${line.speaker}.name` as ParseKeys<"memoryRoom">)}
          text={bubbleText}
          fontSize={fontSize}
          place={bubblePlace}
        />
      )}
    </div>
  );
}

/**
 * 라디오 말풍선: 꼬리 없는 둥근 사각형에 테두리가 지그재그로 떨린다 (전파). 칸 아래
 * 테두리에 걸쳐 칸 밖으로 나간다: 칸 안에 가두면 그림에 묻혀 대사가 안 읽힌다. 화자(???)는 왼쪽 위에 작게. 테두리는 크기를 재서 그린다: 비율로
 * 늘이면 톱니가 칸 모양 따라 찌그러진다.
 */
function RadioBubble({
  speaker,
  text,
  fontSize,
  place,
}: {
  speaker: string;
  text: string;
  fontSize: number;
  place: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setSize({ width: node.offsetWidth, height: node.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      // 칸 아래 테두리에 걸친다: 절반쯤이 칸 밖으로 나간다
      className="absolute bottom-0 translate-y-[45%] animate-fade-rise px-[1.1em] pt-[0.7em] pb-[0.8em] text-ivory"
      style={{ fontSize, ...place }}
    >
      {size.width > 0 && (
        <svg
          aria-hidden
          focusable="false"
          className="absolute inset-0 overflow-visible"
          width={size.width}
          height={size.height}
        >
          <title>radio</title>
          <path
            d={zigzagOutline(size.width, size.height)}
            fill="var(--color-night)"
            stroke="var(--color-ivory)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="relative block text-[0.7em] leading-none tracking-[0.2em] text-fog">
        {speaker}
      </span>
      {/* 두 줄 높이를 늘 잡아 둔다: 찍히는 동안 말풍선이 자라며 칸을 흔들지 않게 */}
      <p className="relative mt-[0.45em] min-h-[3em] break-ko text-pretty leading-[1.5]">{text}</p>
    </div>
  );
}

/** 떨리는 테두리의 톱니 간격(px)과 높이(px), 모서리 둥글기(px). */
const ZIG_STEP = 9;
const ZIG_AMP = 2.4;
const ZIG_RADIUS = 10;

/** 둥근 사각형 둘레를 톱니로 떤 경로. 모서리는 곡선으로 두고 변만 떤다. */
export function zigzagOutline(width: number, height: number): string {
  const r = Math.min(ZIG_RADIUS, width / 4, height / 4);
  const x0 = 0;
  const y0 = 0;
  const x1 = width;
  const y1 = height;
  const parts: string[] = [`M ${x0 + r} ${y0}`];
  const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const length = Math.hypot(bx - ax, by - ay);
    const teeth = Math.max(2, Math.round(length / ZIG_STEP));
    for (let step = 1; step <= teeth; step++) {
      const along = step / teeth;
      // 끝점은 제자리(모서리 곡선과 이어지게), 사이는 안팎으로 번갈아
      const offset = step === teeth ? 0 : step % 2 === 1 ? ZIG_AMP : -ZIG_AMP / 2;
      const x = ax + (bx - ax) * along + nx * offset;
      const y = ay + (by - ay) * along + ny * offset;
      parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  };
  edge(x0 + r, y0, x1 - r, y0, 0, -1);
  parts.push(`Q ${x1} ${y0} ${x1} ${y0 + r}`);
  edge(x1, y0 + r, x1, y1 - r, 1, 0);
  parts.push(`Q ${x1} ${y1} ${x1 - r} ${y1}`);
  edge(x1 - r, y1, x0 + r, y1, 0, 1);
  parts.push(`Q ${x0} ${y1} ${x0} ${y1 - r}`);
  edge(x0, y1 - r, x0, y0 + r, -1, 0);
  parts.push(`Q ${x0} ${y0} ${x0 + r} ${y0}`, "Z");
  return parts.join(" ");
}

/** 창 크기. 페이지가 한 화면에 들어오도록 폭을 계산하는 데 쓴다. */
function useViewport() {
  const [size, setSize] = useState({ width: 1280, height: 800 });
  useEffect(() => {
    const read = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return size;
}
