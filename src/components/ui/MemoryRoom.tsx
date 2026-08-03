"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { MEMORIES, MEMORY_GOAL, ROOM_STAGES } from "@/data/memory-room";
import { useAudioRuntime } from "@/lib/audio";
import {
  ROOM_LIGHT_RAMP,
  roomLightLevel,
  roomLightValue,
  roomStageIndex,
} from "@/scenes/memory-room/visual-state";
import {
  gamePhaseOf,
  REVISIT_TOTAL,
  selectCollected,
  selectEndingReady,
  selectRevisitedCount,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { CharacterSheetModal } from "./CharacterSheetModal";
import { ContactModal } from "./ContactModal";
import { DialogueBox } from "./DialogueBox";
import { EndingScreen } from "./EndingScreen";
import { HudMenu } from "./HudMenu";
import { LoadingOverlay } from "./LoadingOverlay";
import { MemoryPanel } from "./MemoryPanel";
import { MinigameHost } from "./MinigameHost";
import { Monologue } from "./Monologue";
import { TitleScreen } from "./TitleScreen";

function CanvasLoading() {
  const { t } = useTranslation();
  return <LoadingOverlay label={t("scene.loading")} />;
}

const RoomCanvas = dynamic(
  () => import("@/components/canvas/RoomCanvas").then((module) => module.RoomCanvas),
  {
    ssr: false,
    loading: () => <CanvasLoading />,
  },
);

export function MemoryRoom() {
  const { t } = useTranslation();
  // 스토어의 음소거 설정을 오디오 엔진에 잇고 첫 제스처에서 AudioContext를 깨운다
  useAudioRuntime();
  const collected = useMemoryRoomStore(selectCollected);
  const count = collected.length;
  // 밝기는 V자 — 1바퀴는 어두워지고 2바퀴에 되밝아진다 (기획안 3장)
  const revisitedCount = useMemoryRoomStore(selectRevisitedCount);
  const phase = useMemoryRoomStore(gamePhaseOf);
  const lightLevel = roomLightLevel({
    collected: count,
    memoryTotal: MEMORY_GOAL,
    revisited: revisitedCount,
    revisitTotal: REVISIT_TOTAL,
  });
  const stage = ROOM_STAGES[roomStageIndex(lightLevel, phase)];
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  // 타이틀 화면이 떠 있는 동안에는 인게임 HUD를 아예 렌더하지 않는다 — 블러 너머로 비친다.
  const started = useMemoryRoomStore((state) => state.started);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* 플레이 가능한 3D 방 */}
      <RoomCanvas />

      {/*
        문은 이제 씬 안의 진짜 문이다 (RoomShell). 화면 구석에 고정된 DOM 문을 같이
        그리면 카메라를 돌릴 때 벽 밖에 문이 하나 더 떠 있는 꼴이라 뺐다 — 대신
        준비가 되면 문 옆 배트가 금빛으로 켜지고, 그걸 쥐는 게 엔딩 입구다.
      */}
      {isEndingReady && !endingStarted ? (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.3em] text-memory/80">
          {t("door.ready")}
        </p>
      ) : null}

      {/* 비네트 + 필름 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: roomLightValue(ROOM_LIGHT_RAMP.vignette, lightLevel),
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 44%, color-mix(in srgb, var(--color-scene-void) 75%, transparent) 100%)",
        }}
      />
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0" />

      {/* 타이틀 + 진행 — 아래쪽 칩과 숫자가 겹치던 걸 하나로 합쳤다 */}
      {started && (
        <header className="absolute left-6 top-6 z-10 flex flex-col gap-3">
          <div className="w-fit rounded-xl border border-bone bg-paper px-5 py-2 shadow-chip">
            <h1 className="text-lg font-bold tracking-tight text-ink">{t("title")}</h1>
          </div>
          <div className="flex flex-col gap-2 pl-1">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.22em] text-fog">
                {t("hud.scattered")}
              </span>
              {/* 모은 개수가 이 화면의 유일한 진행 지표다 — 라벨보다 확실히 앞으로 나와야 한다 */}
              <span className="font-pixel text-bone/40">
                <span className="text-xl font-bold text-memory">{count}</span>
                <span className="text-sm"> / {MEMORY_GOAL}</span>
              </span>
            </div>
            {/* 기억 하나당 한 칸 — 모을수록 금빛이 왼쪽부터 찬다 */}
            <div className="flex gap-1">
              {MEMORIES.map((memory) => (
                <span
                  key={memory.id}
                  aria-hidden
                  className={`h-1 w-7 rounded-full transition-colors duration-700 ${
                    collected.includes(memory.id) ? "bg-memory shadow-slot-glow" : "bg-bone/18"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>
      )}

      {/* HUD 햄버거 메뉴 — 언어 토글 · Contact · 리셋 (사운드 버튼 예정 자리) */}
      {/* 레이어링 순서: 대사(z-10) < HUD·모달(z-30) < 미니게임(z-40, HUD를 덮는다) < 성공 파티클(z-50) */}
      {started && (
        <div className="absolute right-6 top-6 z-30">
          <HudMenu />
        </div>
      )}

      {started && (
        <>
          {/* 혼잣말 — key로 단계가 바뀔 때마다 다시 마운트해 처음부터 찍는다 */}
          <Monologue key={stage.id} stageId={stage.id} />

          <DialogueBox />
          <MemoryPanel />
          <CharacterSheetModal />
          <MinigameHost />
        </>
      )}

      {/* 배트를 쥔 뒤 — 문이 열리는 걸 보여주고 나서 화면을 덮는다 */}
      <EndingScreen />

      {/* 씬(z-0) < 대사(z-10) < HUD·모달(z-30) < 타이틀(z-40) — 시작 전에는 전부 덮는다 */}
      <TitleScreen />
      {/* 타이틀 화면에서도 열 수 있어야 하므로 타이틀보다 뒤에 그린다 */}
      <ContactModal />
    </div>
  );
}
