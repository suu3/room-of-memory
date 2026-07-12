"use client";

import { useTranslation } from "react-i18next";
import { MEMORIES, MEMORY_GOAL, ROOM_STAGES, stageIndexFromCount } from "@/data/memory-room";
import { selectCollected, selectEndingReady, useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "./DialogueBox";
import { LanguageToggle } from "./LanguageToggle";
import { MemoryHotspot } from "./MemoryHotspot";
import { MemoryPanel } from "./MemoryPanel";
import { MinigameHost } from "./MinigameHost";

const DOOR_VARIANTS = [
  {
    wrap: "opacity-35",
    frame: "border-bone/25 bg-scene-deep/60",
    knob: "bg-bone/25",
    chip: "border-bone/25 bg-scene-deep/60 text-bone/40",
  },
  {
    wrap: "opacity-60",
    frame: "border-bone/35 bg-scene-navy/60",
    knob: "bg-bone/35",
    chip: "border-bone/35 bg-scene-navy/70 text-bone/60",
  },
  {
    wrap: "opacity-100",
    frame: "border-memory bg-memory/15 shadow-door-glow",
    knob: "bg-memory",
    chip: "border-memory bg-memory text-scene-navy",
  },
];

export function MemoryRoom() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const collected = useMemoryRoomStore(selectCollected);
  const count = collected.length;
  const stageIndex = stageIndexFromCount(count);
  const stage = ROOM_STAGES[stageIndex];
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const doorIndex = isEndingReady ? 2 : Math.min(stageIndex, 1);
  const door = DOOR_VARIANTS[doorIndex];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* 방 배경 — 단계 간 느린 크로스페이드 (DESIGN.md > Motion) */}
      {ROOM_STAGES.map((roomStage, index) => (
        <div
          key={roomStage.id}
          aria-hidden
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ background: roomStage.background, opacity: index === stageIndex ? 1 : 0 }}
        />
      ))}

      {/* 바닥 */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[30%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--color-scene-navy) 55%, var(--color-scene-deep) 100%)",
        }}
      />

      {/* 커튼 틈의 빛줄기 */}
      <div
        aria-hidden
        className="absolute -top-[6%] bottom-[18%] left-[74%] -skew-x-9 blur-md transition-all duration-1000"
        style={{
          width: stage.beamWidth,
          opacity: stage.beamOpacity,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-memory) 75%, transparent) 0%, color-mix(in srgb, var(--color-memory) 28%, transparent) 55%, transparent 100%)",
        }}
      />

      {/* 금빛 워시 (3단계에서 최대) */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: stage.washOpacity,
          background:
            "radial-gradient(90% 70% at 70% 40%, color-mix(in srgb, var(--color-memory) 30%, transparent) 0%, color-mix(in srgb, var(--color-memory) 8%, transparent) 45%, transparent 75%)",
        }}
      />

      {/* three.js 디오라마 자리 — 씬 구현 시 Canvas로 교체 */}
      <div className="pointer-events-none absolute left-1/2 top-[45%] grid h-75 w-140 max-w-[80vw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm border border-dashed border-bone/20">
        <div className="text-center text-bone/45">
          <div className="font-mono text-xs tracking-widest">{"<Canvas /> · THREE.JS DIORAMA"}</div>
          <div className="mt-1.5 text-xs opacity-80">{t("canvas.placeholder")}</div>
        </div>
      </div>

      {/* 기억 핫스팟 */}
      {MEMORIES.map((memory) => (
        <MemoryHotspot key={memory.id} memory={memory} />
      ))}

      {/* 문 — 기억을 모두 모으면 열린다. 아직 장식 요소라 핫스팟 클릭을 가로채지 않게 한다 */}
      <div
        className={`pointer-events-none absolute bottom-[16%] left-[4.5%] flex flex-col items-center gap-2.5 transition-all duration-1000 ${door.wrap}`}
      >
        <div
          className={`relative h-40 w-18 rounded-t-sm border-2 transition-colors duration-1000 ${door.frame}`}
        >
          <span
            aria-hidden
            className={`absolute right-2 top-18 size-2 rounded-full ${door.knob}`}
          />
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold tracking-widest transition-colors duration-1000 ${door.chip}`}
        >
          {isEndingReady ? t("door.exit") : t("door.locked")}
        </span>
      </div>

      {/* 비네트 + 필름 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: stage.vignetteOpacity / 0.75,
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 44%, color-mix(in srgb, var(--color-scene-void) 75%, transparent) 100%)",
        }}
      />
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0" />

      {/* 타이틀 HUD */}
      <header className="absolute left-6 top-6 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div aria-hidden className="w-6 border-t-2 border-dashed border-ember" />
          <h1 className="text-lg font-bold text-bone">{t("title")}</h1>
        </div>
        <p className="pl-9 text-xs tracking-widest text-fog">
          {t("hud.scattered")} · {count} / {MEMORY_GOAL}
        </p>
      </header>

      {/* 언어 토글 */}
      <div className="absolute right-6 top-6">
        <LanguageToggle />
      </div>

      {/* 혼잣말 */}
      <div className="pointer-events-none absolute left-1/2 top-16 w-full max-w-2xl -translate-x-1/2 text-center">
        <p key={stage.id} className="animate-fade-rise font-hand text-2xl text-fog">
          「 {tRoom(`stages.${stage.id}.monologue`)} 」
        </p>
      </div>

      {/* 진행 도트 */}
      <div className="absolute bottom-6 left-6 flex items-center gap-3">
        <p className="text-xs tracking-wider text-fog">
          {t("hud.memoryCount")} <span className="font-bold text-memory">{count}</span> /{" "}
          {MEMORY_GOAL}
        </p>
        <div className="flex gap-1.5">
          {MEMORIES.map((memory) => (
            <span
              key={memory.id}
              aria-hidden
              className={`size-2.5 rounded-full transition-colors duration-500 ${
                collected.includes(memory.id) ? "bg-memory" : "border border-dashed border-fog/70"
              }`}
            />
          ))}
        </div>
      </div>

      <DialogueBox stageId={stage.id} />
      <MemoryPanel />
      <MinigameHost />
    </div>
  );
}
