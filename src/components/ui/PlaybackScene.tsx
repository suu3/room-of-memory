"use client";

import type { ParseKeys } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound, startNoiseBed } from "@/lib/audio";
import { selectActivePlayback, useMemoryRoomStore } from "@/store/memory-room";

/** 방송이 마지막으로 지직거리는 구간. */
const STATIC_MS = 1100;
/** 뚝 끊긴 뒤의 암전. 여기서 아무 소리도 나지 않는 것이 이 비트의 내용이다. */
const BLACKOUT_MS = 900;

/**
 * 컷씬이 도는 세 국면. 그림이 뜨기 전에 라디오가 확실히 죽어야 한다 —
 * 나중의 재점화가 이질적으로 들리려면 "꺼졌다"가 먼저 성립해야 하기 때문이다.
 * 다시보기에는 도입이 없으므로 곧장 "cuts"에서 시작한다.
 */
type Stage = "static" | "blackout" | "cuts";

/**
 * 대사와 그림만으로 도는 장면 — 전환 컷씬과 다시보기가 이 화면을 함께 쓴다.
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
   * 뜬다 — 떠나는 말은 회상이 아니라 지금 이 방에서 하는 말이라서다.
   */
  const bare = isCutscene && active.cuts.every((each) => each.image === undefined);
  /** 재생이 바뀔 때마다 도입을 다시 돌리기 위한 열쇠. */
  const playbackKey = active ? `${active.kind}:${active.cutsceneId ?? active.memoryId}` : null;
  const cut = active?.cuts[active.cutIndex];

  /*
   * 컷씬이 열릴 때마다 처음부터 — 방송이 끊기고, 잠깐 아무것도 없다가, 그림이 뜬다.
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
   * 정적 구간. 대사창이 사라진 채로 holdMs만큼 그림만 남았다가 저절로 넘어간다.
   * 멈춰 있는 화면을 사람이 눌러서 넘기게 두면 정적이 "로딩"으로 읽힌다.
   */
  const holding = active?.holding === true && stage === "cuts";
  const holdMs = cut?.holdMs ?? 0;
  useEffect(() => {
    if (!holding || holdMs <= 0) return;
    const timer = window.setTimeout(advancePlayback, holdMs);
    return () => window.clearTimeout(timer);
  }, [holding, holdMs, advancePlayback]);

  // 다시보기는 Esc로 닫힌다 — 되짚어 보다 그만두는 데 확인이 필요할 이유가 없다
  useEffect(() => {
    if (!active || isCutscene) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") endPlayback();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, isCutscene, endPlayback]);

  if (!active) return null;

  const image = cut?.image;
  const showImage = stage === "cuts" && image !== undefined && !missing.includes(image);
  /**
   * 컷씬에서는 그림이 아직 없어도 자리를 지킨다 — 다시보기는 보여줄 게 없으면 비운다.
   * 애초에 그림 없이 설계된 컷씬(bare)은 판도 세우지 않는다 — 회색 판은 "올 그림"의
   * 자리이지, 없는 그림의 자리가 아니다.
   */
  const showPlate = stage === "cuts" && ((isCutscene && !bare) || image !== undefined);

  return (
    // z-40: 미니게임과 같은 층. 재생은 인터랙션이 닫힌 뒤에 열려 둘이 겹치지 않는다.
    // 대사창(z-50)은 이 위에 뜬다 — 그림 위에 글이 얹히는 것이 이 연출의 형태다.
    <div
      className={`absolute inset-0 z-40 ${
        // 그림 없는 컷씬은 방을 살짝 눌러만 둔다 — 말하는 곳이 이 방이라서다
        isCutscene && !bare ? "bg-scene-void" : "bg-scene-void/80 backdrop-blur-sm"
      }`}
    >
      {/*
        컷 그림. 컷씬 일러스트가 아직 없으면 회색 판이 그대로 남는다 — 파일이 들어오는
        순간 이 자리에 그대로 들어차므로 구도를 미리 잡아둘 필요가 없다.
        다시보기 스틸은 대사창 자리를 비우고 그 위에 선다.
      */}
      <div
        className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${
          stage === "cuts" ? "opacity-100" : "opacity-0"
        } ${isCutscene ? "" : "pb-56"}`}
      >
        {showPlate && (
          <div
            className={`relative h-full max-h-full w-full ${
              isCutscene
                ? "aspect-video max-w-[min(100%,177.7svh)] bg-scene-storm"
                : "max-w-[min(88%,92svh)]"
            }`}
          >
            {showImage && (
              /* biome-ignore lint/performance/noImgElement: 파일이 없을 때 onError로 회색 판에 떨어져야 해서 최적화 파이프라인을 타지 않는다. */
              <img
                src={image}
                alt=""
                draggable={false}
                onError={() => setMissing((ids) => (ids.includes(image) ? ids : [...ids, image]))}
                className={`absolute inset-0 size-full select-none ${
                  cut?.fit === "contain" ? "object-contain" : "object-cover"
                }`}
              />
            )}
          </div>
        )}
      </div>

      {/* 방송이 마지막으로 지직거리는 노이즈. 끊기는 순간 같이 사라진다 */}
      <div
        aria-hidden
        className={`film-grain pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          stage === "static" ? "animate-signal-static opacity-100" : "opacity-0"
        }`}
      />

      {/*
        화면 가장자리를 조여 그림을 가운데로 모은다 — 방 비네트와 같은 처방.
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

      {/* 무엇을 되짚는 중인지 — 다시보기는 진행이 아니라 열람이라 제목이 필요하다 */}
      {!isCutscene && active.memoryId && (
        <p className="pointer-events-none absolute left-1/2 top-8 z-10 -translate-x-1/2 font-pixel text-[0.6875rem] tracking-[0.3em] text-memory/75">
          {t("playback.replayTitle", {
            name: tRoom(`memories.${active.memoryId}.name` as ParseKeys<"memoryRoom">),
          })}
        </p>
      )}

      {/*
        나가는 문. 컷씬에서는 접근성 장치인 건너뛰기이고, 다시보기에서는 그냥 닫기다 —
        건너뛸 진행이 없으니 같은 말을 쓰면 안 된다. 컷씬 쪽은 이 장면의 무게를
        깎지 않도록 구석에서 흐리게 서 있는다.
      */}
      {stage === "cuts" && (
        <button
          type="button"
          onClick={endPlayback}
          className="absolute bottom-6 right-6 z-10 cursor-pointer rounded-full border border-bone/25 px-4 py-1.5 font-pixel text-[0.625rem] tracking-[0.3em] text-bone/45 transition-colors hover:border-bone/60 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
        >
          {t(isCutscene ? "playback.skip" : "playback.close")}
        </button>
      )}
    </div>
  );
}
