"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CUTSCENES } from "@/data/memory-room";
import { playSound, startNoiseBed } from "@/lib/audio";
import { selectActiveCutscene, useMemoryRoomStore } from "@/store/memory-room";

/** 방송이 마지막으로 지직거리는 구간. */
const STATIC_MS = 1100;
/** 뚝 끊긴 뒤의 암전. 여기서 아무 소리도 나지 않는 것이 이 비트의 내용이다. */
const BLACKOUT_MS = 900;

/**
 * 컷씬이 도는 세 국면. 그림이 뜨기 전에 라디오가 확실히 죽어야 한다 —
 * 나중의 재점화가 이질적으로 들리려면 "꺼졌다"가 먼저 성립해야 하기 때문이다.
 */
type Stage = "static" | "blackout" | "cuts";

/**
 * 전환 컷씬 — 게임을 통틀어 일러스트가 화면을 통째로 차지하는 유일한 자리.
 *
 * 대사는 여기서 그리지 않는다. 기존 대사창(DialogueBox)이 컷씬 대사도 받으므로,
 * 이 컴포넌트가 맡는 건 그림과 정적, 그리고 라디오가 꺼지는 첫 비트뿐이다.
 * 일러스트에 말풍선을 넣지 않는 규칙이 레이어 분리로 그대로 지켜진다.
 */
export function Cutscene() {
  const { t } = useTranslation();
  const active = useMemoryRoomStore(selectActiveCutscene);
  const advanceCutscene = useMemoryRoomStore((state) => state.advanceCutscene);
  const endCutscene = useMemoryRoomStore((state) => state.endCutscene);
  const [stage, setStage] = useState<Stage>("static");
  /** 아직 리포에 없는 일러스트. 회색 판이 그대로 남는다. */
  const [missing, setMissing] = useState<string[]>([]);

  const cutsceneId = active?.id ?? null;
  const cut = active ? CUTSCENES[active.id]?.cuts[active.cutIndex] : undefined;

  /*
   * 컷씬이 열릴 때마다 처음부터 — 방송이 끊기고, 잠깐 아무것도 없다가, 그림이 뜬다.
   * 도입이 끝나면 스토어의 intro를 내려 대사창이 첫 컷 위에 올라오게 한다.
   */
  useEffect(() => {
    if (!cutsceneId) return;
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
      advanceCutscene();
    }, STATIC_MS + BLACKOUT_MS);
    return () => {
      window.clearTimeout(toBlackout);
      window.clearTimeout(toCuts);
      bed?.stop();
    };
  }, [cutsceneId, advanceCutscene]);

  /*
   * 정적 구간. 대사창이 사라진 채로 holdMs만큼 그림만 남았다가 저절로 넘어간다.
   * 멈춰 있는 화면을 사람이 눌러서 넘기게 두면 정적이 "로딩"으로 읽힌다.
   */
  const holding = active?.holding === true && stage === "cuts";
  const holdMs = cut?.holdMs ?? 0;
  useEffect(() => {
    if (!holding || holdMs <= 0) return;
    const timer = window.setTimeout(advanceCutscene, holdMs);
    return () => window.clearTimeout(timer);
  }, [holding, holdMs, advanceCutscene]);

  if (!active) return null;

  const image = cut?.image;
  const showImage = stage === "cuts" && image !== undefined && !missing.includes(image);

  return (
    // z-40: 미니게임과 같은 층. 컷씬은 인터랙션이 닫힌 뒤에 열려 둘이 겹치지 않는다.
    // 대사창(z-50)은 이 위에 뜬다 — 그림 위에 글이 얹히는 것이 이 연출의 형태다.
    <div className="absolute inset-0 z-40 bg-scene-void">
      {/*
        컷 그림. 일러스트가 아직 없으면 회색 판이 그대로 남는다 — 파일이 들어오는
        순간 이 자리에 그대로 들어차므로 구도를 미리 잡아둘 필요가 없다.
      */}
      <div
        className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${
          stage === "cuts" ? "opacity-100" : "opacity-0"
        }`}
      >
        {/*
          일러스트 자리. 파일이 오기 전에는 회색 판이 그대로 보인다 — 비어 보이는
          것이 맞다. 다만 "아직 안 들어온 자리"로 읽히도록 배경보다 확실히 밝게 둔다.
        */}
        <div className="relative aspect-video h-full max-h-full w-full max-w-[min(100%,177.7svh)] bg-scene-storm">
          {showImage && (
            /* biome-ignore lint/performance/noImgElement: 파일이 없을 때 onError로 회색 판에 떨어져야 해서 최적화 파이프라인을 타지 않는다. */
            <img
              src={image}
              alt=""
              draggable={false}
              onError={() => setMissing((ids) => (ids.includes(image) ? ids : [...ids, image]))}
              className="absolute inset-0 size-full select-none object-cover"
            />
          )}
        </div>
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

      {/*
        건너뛰기. 접근성 장치라 컷이 뜬 뒤에는 늘 보인다 — 다만 이 장면의 무게를
        깎지 않도록 구석에서 흐리게 서 있는다.
      */}
      {stage === "cuts" && (
        <button
          type="button"
          onClick={endCutscene}
          className="absolute bottom-6 right-6 z-10 cursor-pointer rounded-full border border-bone/25 px-4 py-1.5 font-pixel text-[0.625rem] tracking-[0.3em] text-bone/45 transition-colors hover:border-bone/60 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
        >
          {t("cutscene.skip")}
        </button>
      )}
    </div>
  );
}
