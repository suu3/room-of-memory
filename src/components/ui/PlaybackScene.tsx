"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CUTSCENE_RADIO_BLACKOUT } from "@/data/memory-room";
import { playSound, startNoiseBed } from "@/lib/audio";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { selectActivePlayback, useMemoryRoomStore } from "@/store/memory-room";
import { CutDissolve } from "./CutDissolve";
import { grainForCut } from "./cut-dissolve";
import { PhotoMorph } from "./PhotoMorph";
import { morphSeed } from "./photo-morph";
import { WebtoonViewer } from "./WebtoonViewer";

/** 방송이 마지막으로 지직거리는 구간. */
const STATIC_MS = 1100;
/** 뚝 끊긴 뒤의 암전. 여기서 아무 소리도 나지 않는 것이 이 비트의 내용이다. */
const BLACKOUT_MS = 900;
/**
 * 방송이 끊기는 치지직(CutsceneCut.sfx의 radioSignOff)의 잡음 길이. 짧은 효과음 한 방
 * (0.6초 한도, voices.test)이 아니라 연출이라 노이즈 베드로 깔고 끝에서 radioCut으로 끊는다.
 */
const SIGN_OFF_MS = 800;

/**
 * 그림이 서 있는 동안 바닥에 까는 테이프 히스. 곡이 아니라 "재생 중"이라는 기척이다.
 * 방의 BGM이 삼켜진 자리(music.ts의 SINK_CUTOFF_HZ)에 곧바로 완전한 무음이 오면
 * 컷씬이 아니라 소리가 고장난 것으로 들린다. 방송 잡음(gain 0.09)의 절반도 안 되게:
 * 의식하면 들리고 대사를 읽는 동안은 잊히는 크기.
 */
const TAPE_HISS = { gain: 0.035, highpass: 2400, lowpass: 9000 } as const;

/**
 * 컷씬이 도는 세 국면. 그림이 뜨기 전에 라디오가 확실히 죽어야 한다.
 * 나중의 재점화가 이질적으로 들리려면 "꺼졌다"가 먼저 성립해야 하기 때문이다.
 * 다시보기에는 도입이 없으므로 곧장 "cuts"에서 시작한다.
 */
type Stage = "static" | "blackout" | "cuts";

/** 파형 막대 수. 화면 폭을 채울 만큼이면서 막대 하나가 픽셀로 읽히는 굵기. */
const WAVE_BARS = 56;
/**
 * 막대마다 다른 지연·높이. 난수를 쓰지 않는다: 렌더마다 파형이 달라지면 리렌더 때
 * 화면이 툭툭 튀고, 서버·클라이언트 첫 그림도 어긋난다. 정해진 수열이면 늘 같다.
 */
const WAVE_SHAPE = Array.from({ length: WAVE_BARS }, (_, index) => {
  const phase = Math.sin(index * 12.9898) * 43758.5453;
  const noise = phase - Math.floor(phase);
  // 가운데가 높고 양끝이 낮은 봉우리 위에 잡음을 얹는다
  const envelope = 0.35 + 0.65 * Math.sin((index / (WAVE_BARS - 1)) * Math.PI);
  return { delay: noise * 1.9, height: 0.25 + 0.75 * envelope * (0.55 + 0.45 * noise) };
});

/**
 * 그림이 아직 없는 컷 뒤에 까는 신호의 그림: 어두운 판 위의 파형, 스캔라인, 잡히다 말다
 * 하는 라디오 램프. 게임 전체의 전환점(라디오 너머 첫 목소리)이 회색 판 하나로 지나가면
 * 안 된다. 일러스트가 리포에 들어오면 그 위에 얹혀 이 층을 덮는다.
 *
 * 방송이 끊기는 도입(static)에서는 파형이 붉게 흔들리고, 목소리가 드는 컷에서는
 * 금빛으로 가라앉는다. 같은 파형이 색만 바꿔 "죽은 신호"와 "다시 든 신호"를 가른다.
 */
function SignalVisual({ tone }: { tone: "dying" | "alive" }) {
  const bar = tone === "dying" ? "bg-ember/70" : "bg-memory/80";
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-scene-abyss">
      {/* 가운데로 모이는 어둠. 그림 없는 판이 통짜 단색으로 읽히지 않게 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 50%, color-mix(in srgb, var(--color-scene-storm) 85%, transparent) 0%, transparent 100%)",
        }}
      />
      {/* 파형: 가운데 축을 두고 위아래로 대칭이라 막대는 세로 중앙에서 자란다 */}
      <div className="absolute inset-x-[8%] top-1/2 flex h-[38%] -translate-y-1/2 items-center gap-[0.35%]">
        {WAVE_SHAPE.map((shape, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 파형이라 자리 자체가 정체성이다.
            key={index}
            className={`animate-signal-wave block h-full flex-1 rounded-full ${bar}`}
            style={{
              animationDelay: `-${shape.delay.toFixed(2)}s`,
              maxHeight: `${(shape.height * 100).toFixed(1)}%`,
            }}
          />
        ))}
      </div>
      {/* 다이얼 눈금: 파형 아래 가는 줄 하나와 잘게 찍힌 눈금 */}
      <div className="absolute inset-x-[8%] top-[72%] h-px bg-ivory/20" />
      <div className="absolute inset-x-[8%] top-[72%] flex justify-between">
        {Array.from({ length: 21 }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 눈금은 같은 것의 반복이다.
            key={index}
            className={`w-px bg-ivory/30 ${index % 5 === 0 ? "h-3" : "h-1.5"}`}
          />
        ))}
      </div>
      {/* 램프: 잡히다 말다 하는 신호. 도입에서는 붉게, 목소리가 들면 금빛으로 */}
      <span
        className={`animate-signal-lamp absolute left-[8%] top-[80%] size-2.5 rounded-full blur-[1px] ${
          tone === "dying" ? "bg-ember" : "bg-memory"
        }`}
      />
      <span className="absolute left-[11%] top-[79.4%] font-pixel text-[0.6rem] tracking-[0.3em] text-ivory/45">
        {tone === "dying" ? "NO SIGNAL" : "SIGNAL"}
      </span>
      {/* 게임기 화면과 같은 주사선. 파형이 그림이 아니라 기계의 화면으로 읽히게 */}
      <span className="duel-scanline pointer-events-none absolute inset-0 opacity-30" />
    </div>
  );
}

/**
 * 대사와 그림만으로 도는 장면: 전환 컷씬과 다시보기가 이 화면을 함께 쓴다.
 *
 * 대사는 여기서 그리지 않는다. 기존 대사창(DialogueBox)이 재생 대사도 받으므로,
 * 이 컴포넌트가 맡는 건 그림과 정적, 그리고 컷씬이라면 라디오가 꺼지는 첫 비트뿐이다.
 * 일러스트에 말풍선을 넣지 않는 규칙이 레이어 분리로 그대로 지켜진다.
 *
 * 두 재생의 태도는 다르다. 컷씬은 방을 통째로 덮고 진행을 밀어붙이지만,
 * 다시보기는 이미 지나간 것을 들춰 보는 것뿐이라 방이 뒤에 비쳐야 한다.
 */
export function PlaybackScene() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const active = useMemoryRoomStore(selectActivePlayback);
  const advancePlayback = useMemoryRoomStore((state) => state.advancePlayback);
  const endPlayback = useMemoryRoomStore((state) => state.endPlayback);
  const [stage, setStage] = useState<Stage>("cuts");
  /** 아직 리포에 없는 일러스트. 회색 판이 그대로 남는다. */
  const [missing, setMissing] = useState<string[]>([]);

  const isCutscene = active?.kind === "cutscene";
  /**
   * 그림 없는 컷씬 (배트의 작별 대사). 화면을 덮는 대신 방이 비친 채 대사창만
   * 뜬다. 떠나는 말은 회상이 아니라 지금 이 방에서 하는 말이라서다.
   */
  const bare = isCutscene && active.cuts.every((each) => each.image === undefined);
  /** 재생이 바뀔 때마다 도입을 다시 돌리기 위한 열쇠. */
  const playbackKey = active ? `${active.kind}:${active.cutsceneId ?? active.memoryId}` : null;
  const cut = active?.cuts[active.cutIndex];

  /*
   * 컷씬이 열릴 때마다 처음부터: 방송이 끊기고, 잠깐 아무것도 없다가, 그림이 뜬다.
   * 도입이 끝나면 스토어의 intro를 내려 대사창이 첫 컷 위에 올라오게 한다.
   *
   * 단, 도입은 재생이 intro를 달고 열렸을 때만이다. 지직거리다 꺼지는 비트는
   * 라디오 컷씬의 것이라, intro 없이 열린 컷씬(배트)은 곧장 첫 줄로 간다.
   * effect가 도는 시점에는 아직 아무도 재생을 진행시키지 않았으므로, 스토어에서
   * 지금 값을 읽으면 그게 곧 열릴 때의 값이다.
   */
  useEffect(() => {
    if (!playbackKey) return;
    const openedWithIntro = useMemoryRoomStore.getState().activePlayback?.intro === true;
    if (!isCutscene || !openedWithIntro) {
      setStage("cuts");
      return;
    }
    setStage("static");
    const bed = startNoiseBed({ gain: 0.09, highpass: 900, lowpass: 7000 });
    bed?.setLevel(1);
    const toBlackout = window.setTimeout(() => {
      bed?.stop();
      playSound("radioCut");
      setStage("blackout");
    }, STATIC_MS);
    const toCuts = window.setTimeout(() => {
      setStage("cuts");
      advancePlayback();
    }, STATIC_MS + BLACKOUT_MS);
    return () => {
      window.clearTimeout(toBlackout);
      window.clearTimeout(toCuts);
      bed?.stop();
    };
  }, [playbackKey, isCutscene, advancePlayback]);

  /*
   * 그림이 서 있는 동안의 소리: 서는 순간 영사기가 걸리고(reelStart), 바닥에 히스가
   * 깔린다. 암전(blackout)에는 닿지 않는다. 거기서는 아무 소리도 안 나는 것이 내용이다.
   * 그림 없는 컷씬(bare)은 방에서 하는 말이라 방의 소리가 그대로 남는다.
   * 웹툰(생존자 방송)은 필름이 아니라 라디오라 영사기도 셔터도 없다. 소리는 칸의 sfx 몫이다.
   */
  const webtoon = isCutscene && active?.cuts.some((each) => each.page !== undefined) === true;
  const screening = active !== null && stage === "cuts" && !bare && !webtoon;
  useEffect(() => {
    if (!screening) return;
    playSound("reelStart");
    const bed = startNoiseBed(TAPE_HISS);
    bed?.setLevel(1);
    return () => bed?.stop();
  }, [screening]);

  // 컷이 바뀔 때마다 셔터 한 번. 첫 컷은 reelStart의 몫이라 울리지 않는다
  const cutIndex = active?.cutIndex ?? 0;
  useEffect(() => {
    if (screening && cutIndex > 0) playSound("cutChange");
  }, [screening, cutIndex]);

  /*
   * 컷에 붙은 효과음 (CutsceneCut.sfx): 생존자 방송 첫 컷의 마이크 탁, 탁. 그림이 뜨는
   * 순간과 같은 박자에 한 번. 도입(방송이 끊기는 비트) 동안에는 울리지 않는다.
   */
  const cutSfx = stage === "cuts" ? cut?.sfx : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: cutIndex·playbackKey는 본문에서 읽지 않고 "컷이 바뀌었다"는 신호로만 쓴다. 같은 효과음이 이어진 컷에서도 다시 울려야 한다.
  useEffect(() => {
    if (!cutSfx) return;
    if (cutSfx !== "radioSignOff") {
      playSound(cutSfx);
      return;
    }
    const bed = startNoiseBed({ gain: 0.09, highpass: 900, lowpass: 7000 });
    bed?.setLevel(1);
    const timer = window.setTimeout(() => {
      bed?.stop();
      playSound("radioCut");
    }, SIGN_OFF_MS);
    return () => {
      window.clearTimeout(timer);
      bed?.stop();
    };
  }, [cutSfx, cutIndex, playbackKey]);

  /*
   * 컷이 바뀌는 그림의 전환 (CutDissolve). 셔터 소리와 같은 박자에 노이즈 장막이 결을
   * 따라 걷힌다. 첫 컷은 판 자체가 떠오르는 등장(animate-playback-enter)이 있으니
   * 여기서 한 번 더 덮지 않는다. 켤지 끌지는 효과 예산 한 곳이 정한다 (effect-budget).
   */
  const dissolveEnabled = useEffectEnabled("cheap");

  /*
   * 사진이 사진으로 밀려 넘어가는 컷 (PhotoMorph). 액자를 2막에 되짚을 때만 선다:
   * 1막의 사진으로 열렸다가 2막의 사진으로 넘어간다. 장막과 같은 등급(cheap)을 쓴다.
   * 둘 다 기록물의 결이라 한쪽만 남으면 재질이 갈라진다.
   *
   * 끝난 컷을 열쇠로 적어 둔다. 재생을 닫았다 다시 열면 열쇠가 같아도 컴포넌트가
   * 새로 마운트되므로 다시 넘어가고, 같은 재생 안에서 대사를 넘기는 동안에는
   * 이미 끝난 넘어감이 다시 돌지 않는다.
   */
  const [morphedKey, setMorphedKey] = useState<string | null>(null);

  /*
   * 정적 구간. 대사창이 사라진 채로 holdMs만큼 그림만 남았다가 저절로 넘어간다.
   * 멈춰 있는 화면을 사람이 눌러서 넘기게 두면 정적이 "로딩"으로 읽힌다.
   */
  const holding = active?.holding === true && stage === "cuts";
  const holdMs = cut?.holdMs ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: cutIndex·playbackKey는 "컷이 바뀌었다"는 신호다. 대사 없는 컷이 같은 holdMs로 이어지면 holding·holdMs가 그대로라, 이것 없이는 둘째 컷에서 타이머가 다시 걸리지 않는다.
  useEffect(() => {
    if (!holding || holdMs <= 0) return;
    const timer = window.setTimeout(advancePlayback, holdMs);
    return () => window.clearTimeout(timer);
  }, [holding, holdMs, advancePlayback, cutIndex, playbackKey]);

  // 다시보기는 Esc로 닫힌다. 되짚어 보다 그만두는 데 확인이 필요할 이유가 없다
  useEffect(() => {
    if (!active || isCutscene) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") endPlayback();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, isCutscene, endPlayback]);

  if (!active) return null;

  // 생존자 방송: 페이지 단위 웹툰은 제 뷰어가 통째로 맡는다 (칸·말풍선·페이지 넘김)
  if (webtoon) return <WebtoonViewer active={active} />;

  const image = cut?.image;
  const showImage = stage === "cuts" && image !== undefined && !missing.includes(image);
  const morphFrom = cut?.morphFrom;
  const morphKey = showImage && morphFrom !== undefined ? `${playbackKey}:${cutIndex}:morph` : null;
  const morphing = dissolveEnabled && morphKey !== null && morphedKey !== morphKey;
  /**
   * 컷씬에서는 그림이 아직 없어도 자리를 지킨다. 다시보기는 보여줄 게 없으면 비운다.
   * 애초에 그림 없이 설계된 컷씬(bare)은 판도 세우지 않는다. 회색 판은 "올 그림"의
   * 자리이지, 없는 그림의 자리가 아니다.
   */
  const showPlate = stage === "cuts" && ((isCutscene && !bare) || image !== undefined);

  return (
    // z-40: 미니게임과 같은 층. 재생은 인터랙션이 닫힌 뒤에 열려 둘이 겹치지 않는다.
    // 대사창(z-50)은 이 위에 뜬다. 그림 위에 글이 얹히는 것이 이 연출의 형태다.
    <div
      // 한 박자 늦게 떠오른다(animate-playback-enter). 그 사이 뒤의 방이 신호 끊기듯 찢긴다 (ScreenTransition)
      className={`absolute inset-0 z-40 animate-playback-enter ${
        // 그림 없는 컷씬은 방을 살짝 눌러만 둔다. 말하는 곳이 이 방이라서다
        isCutscene && !bare ? "bg-scene-void" : "bg-scene-void/80 backdrop-blur-sm"
      }`}
    >
      {/*
        컷 그림. 컷씬 일러스트가 아직 없으면 회색 판이 그대로 남는다. 파일이 들어오는
        순간 이 자리에 그대로 들어차므로 구도를 미리 잡아둘 필요가 없다.
        다시보기 스틸은 대사창 자리를 비우고 그 위에 선다.
      */}
      <div
        className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${
          stage === "cuts" ? "opacity-100" : "opacity-0"
        } ${
          // 다시보기 스틸은 위로는 제목 아래, 아래로는 대사창 위 한 뼘(24px 안팎)을 비운다
          isCutscene ? "" : "pt-16 pb-60"
        }`}
      >
        {showPlate && (
          <div
            className={`relative h-full max-h-full w-full ${
              isCutscene
                ? "aspect-video max-w-[min(100%,177.7svh)] bg-scene-storm"
                : "max-w-[min(88%,92svh)]"
            }`}
          >
            {/*
              컷씬은 그림이 없어도 빈 판으로 두지 않는다. 신호의 그림이 판을 채우고,
              일러스트가 있으면 그 위에 얹혀 이 층을 가린다. 다시보기는 스틸이 없으면
              판 자체를 세우지 않으므로(showPlate) 여기 오지 않는다.
            */}
            {isCutscene && (
              <SignalVisual
                tone={
                  active.cutsceneId === CUTSCENE_RADIO_BLACKOUT && active.cutIndex < 2
                    ? "dying"
                    : "alive"
                }
              />
            )}
            {showImage && (
              /* biome-ignore lint/performance/noImgElement: 파일이 없을 때 onError로 회색 판에 떨어져야 해서 최적화 파이프라인을 타지 않는다. */
              <img
                src={image}
                alt=""
                draggable={false}
                onError={() => setMissing((ids) => (ids.includes(image) ? ids : [...ids, image]))}
                // 다시보기 스틸은 통째로 보인다. 잘라 채우면 사진 윗단이 화면 밖으로 나간다
                className={`absolute inset-0 size-full select-none transition-opacity duration-300 ${
                  cut?.fit === "contain" || !isCutscene ? "object-contain" : "object-cover"
                } ${
                  // 밀림이 도는 동안은 물러나 있다. 비율이 달라 뒤에서 비치면 두 장이 겹쳐 보인다
                  morphing ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
            {/* 앞 사진에서 이 사진으로 밀려 넘어가는 층. 끝나면 물러나며 위의 원본에 자리를 넘긴다 */}
            {morphing && morphFrom !== undefined && image !== undefined && (
              <PhotoMorph
                key={morphKey}
                from={morphFrom}
                to={image}
                within={cut?.morphWithin}
                seed={morphSeed(morphKey)}
                onDone={() => setMorphedKey(morphKey)}
              />
            )}
            {/* 컷 전환 장막. 그림 위에 얹혀야 하므로 마지막 자식이다 */}
            <CutDissolve
              cutKey={`${playbackKey}:${cutIndex}`}
              grain={grainForCut(cutIndex)}
              enabled={dissolveEnabled && cutIndex > 0}
            />
          </div>
        )}
      </div>

      {/*
        필름 먼지와 스크래치 (.film-dust, DESIGN.md > Texture). 3D 방의 그레인은 셰이더가
        프레임마다 뿌리는 결이고, 여기는 **기록물**의 결이다: 같은 그레인을 쓰면 화면이
        바뀌었을 뿐 재질이 안 바뀐다. 그림이 선 동안에만 얹힌다.
      */}
      {screening && (
        <div aria-hidden className="film-dust pointer-events-none absolute inset-0">
          <span className="film-scratch" />
        </div>
      )}

      {/* 방송이 마지막으로 지직거리는 노이즈. 끊기는 순간 같이 사라진다 */}
      <div
        aria-hidden
        className={`film-grain pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          stage === "static" ? "animate-signal-static opacity-100" : "opacity-0"
        }`}
      />

      {/*
        화면 가장자리를 조여 그림을 가운데로 모은다. 방 비네트와 같은 처방.
        방(75%)보다 옅게 잡는다: 여기서는 비네트가 그림 자체를 먹어치우면 안 된다.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 95% at 50% 45%, transparent 52%, color-mix(in srgb, var(--color-scene-void) 62%, transparent) 100%)",
        }}
      />

      {/* 무엇을 되짚는 중인지: 다시보기는 진행이 아니라 열람이라 제목이 필요하다 */}
      {!isCutscene && active.memoryId && (
        <p className="pointer-events-none absolute left-1/2 top-8 z-10 -translate-x-1/2 font-pixel text-xs tracking-[0.2em] text-memory">
          {t("playback.replayTitle", {
            name: tRoom(`memories.${active.memoryId}.name` as ParseKeys<"memoryRoom">),
          })}
        </p>
      )}

      {/*
        나가는 문. 컷씬에서는 접근성 장치인 건너뛰기이고, 다시보기에서는 그냥 닫기다.
        건너뛸 진행이 없으니 같은 말을 쓰면 안 된다. 구석에 서 있되 흐리지는 않다.
        어두운 그림 위에서 안 보이는 건너뛰기는 접근성 장치가 아니라 장식이다.
      */}
      {stage === "cuts" && (
        <button
          type="button"
          onClick={endPlayback}
          className="absolute bottom-6 right-6 z-10 cursor-pointer rounded-sm border border-fog/50 bg-night/80 px-3.5 py-2 font-pixel text-xs tracking-[0.2em] text-ivory shadow-chip transition-colors duration-150 hover:border-ivory/70 hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
        >
          {t(isCutscene ? "playback.skip" : "playback.close")}
        </button>
      )}
    </div>
  );
}
