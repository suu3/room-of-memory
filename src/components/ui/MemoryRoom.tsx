"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { MEMORIES, MEMORY_GOAL, ROOM_STAGES, stageIndexFromCount } from "@/data/memory-room";
import { useTypewriter } from "@/lib/use-typewriter";
import { selectCollected, selectEndingReady, useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "./DialogueBox";
import { HudMenu } from "./HudMenu";
import { MemoryPanel } from "./MemoryPanel";
import { MinigameHost } from "./MinigameHost";

function CanvasLoading() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 grid place-items-center text-xs text-fog">
      {t("scene.loading")}
    </div>
  );
}

const RoomCanvas = dynamic(
  () => import("@/components/canvas/RoomCanvas").then((module) => module.RoomCanvas),
  {
    ssr: false,
    loading: () => <CanvasLoading />,
  },
);

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
  const monologue = useTypewriter(tRoom(`stages.${stage.id}.monologue`));

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* 플레이 가능한 3D 방 */}
      <RoomCanvas />

      {/* 문 — 기억을 모두 모으면 열린다. 아직 장식 요소라 핫스팟 클릭을 가로채지 않게 한다 */}
      <div
        className={`pointer-events-none absolute bottom-[16%] left-[4.5%] z-10 flex flex-col items-center gap-2.5 transition-all duration-1000 ${door.wrap}`}
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
          opacity: stage.vignetteOpacity / 0.55,
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 44%, color-mix(in srgb, var(--color-scene-void) 75%, transparent) 100%)",
        }}
      />
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0" />

      {/* 타이틀 HUD — 종이 리본 스티커 */}
      <header className="absolute left-6 top-6 z-10 flex flex-col gap-2">
        <div className="flex w-fit -rotate-1 items-center gap-2.5 rounded-lg border-2 border-bone bg-paper px-4 py-1.5 shadow-chip">
          <div aria-hidden className="w-5 border-t-2 border-dashed border-ember" />
          <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
          <div aria-hidden className="w-5 border-t-2 border-dashed border-ember" />
        </div>
        <p className="pl-2 text-xs tracking-widest text-fog">
          {t("hud.scattered")} · {count} / {MEMORY_GOAL}
        </p>
      </header>

      {/* HUD 햄버거 메뉴 — 언어 토글 · Contact · 리셋 (사운드 버튼 예정 자리) */}
      {/* 레이어링 순서: 대사(z-10) < HUD·모달(z-30) < 미니게임(z-40, HUD를 덮는다) < 성공 파티클(z-50) */}
      <div className="absolute right-6 top-6 z-30">
        <HudMenu />
      </div>

      {/* 혼잣말 */}
      <div className="pointer-events-none absolute left-1/2 top-24 z-10 w-full max-w-2xl -translate-x-1/2 text-center md:top-16">
        <p key={stage.id} className="animate-fade-rise font-pixel text-2xl text-fog">
          「 {monologue} 」
        </p>
      </div>

      {/* 진행 도트 — 종이 칩 */}
      <div className="absolute bottom-6 left-6 z-10 flex rotate-1 items-center gap-3 rounded-full border-2 border-bone bg-paper px-4 py-1.5 shadow-chip">
        <p className="text-xs tracking-wider text-ink/70">
          {t("hud.memoryCount")} <span className="font-bold text-ember">{count}</span> /{" "}
          {MEMORY_GOAL}
        </p>
        <div className="flex gap-1.5">
          {MEMORIES.map((memory) => (
            <span
              key={memory.id}
              aria-hidden
              className={`size-2.5 rounded-full transition-colors duration-500 ${
                collected.includes(memory.id) ? "bg-memory" : "border border-dashed border-ink/40"
              }`}
            />
          ))}
        </div>
      </div>

      <DialogueBox />
      <MemoryPanel />
      <MinigameHost />
    </div>
  );
}
