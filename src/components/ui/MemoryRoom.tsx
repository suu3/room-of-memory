"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { AdminPanel } from "@/components/dev/AdminPanel";
import { MEMORY_GOAL, memoriesForPhase, ROOM_STAGES } from "@/data/memory-room";
import { useAudioRuntime, useRoomMusic } from "@/lib/audio";
import {
  lampScaled,
  ROOM_LIGHT_RAMP,
  roomLightLevel,
  roomLightValue,
  roomStageIndex,
} from "@/scenes/memory-room/visual-state";
import {
  gamePhaseOf,
  REVISIT_TOTAL,
  selectCollected,
  selectDoorReady,
  selectEndingReady,
  selectMusicForeground,
  selectMusicPlaying,
  selectRevisitedCount,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { BootCurtain } from "./BootCurtain";
import { CharacterSheetModal } from "./CharacterSheetModal";
import { ClueOverlay } from "./ClueOverlay";
import { ContactModal } from "./ContactModal";
import { DialogueBox } from "./DialogueBox";
import { DoorNudge } from "./DoorNudge";
import { EndingScreen } from "./EndingScreen";
import { FeedbackModal } from "./FeedbackModal";
import { HudMenu } from "./HudMenu";
import { MemoryPanel } from "./MemoryPanel";
import { MinigameHost } from "./MinigameHost";
import { Monologue } from "./Monologue";
import { PlaybackScene } from "./PlaybackScene";
import { PuzzleHost } from "./PuzzleHost";
import { SoundToggle } from "./SoundToggle";
import { TitleScreen } from "./TitleScreen";

/*
 * 로딩 표시는 부팅 커튼이 혼자 맡는다 (BootCurtain).
 *
 * 여기에 loading 폴백을 걸면 청크를 받는 동안 전체 화면 오버레이가 뜨는데, 그
 * 위를 커튼이 또 덮어 로딩 표시가 두 겹이 된다. started는 저장하지 않으므로 이
 * 청크는 **항상** 커튼이 내려와 있는 동안 받는다 — 즉 이 폴백은 언제나 겹친다.
 */
const RoomCanvas = dynamic(
  () => import("@/components/canvas/RoomCanvas").then((module) => module.RoomCanvas),
  { ssr: false },
);

export function MemoryRoom() {
  const { t } = useTranslation();
  // 스토어의 음소거 설정을 오디오 엔진에 잇고 첫 제스처에서 AudioContext를 깨운다
  useAudioRuntime();
  const collected = useMemoryRoomStore(selectCollected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  // 밝기는 V자 — 1바퀴는 어두워지고 2바퀴에 되밝아진다 (기획안 3장)
  const revisitedCount = useMemoryRoomStore(selectRevisitedCount);
  const phase = useMemoryRoomStore(gamePhaseOf);
  const lightLevel = roomLightLevel({
    collected: collected.length,
    memoryTotal: MEMORY_GOAL,
    revisited: revisitedCount,
    revisitTotal: REVISIT_TOTAL,
  });
  const stage = ROOM_STAGES[roomStageIndex(lightLevel, phase)];
  /*
   * 진행 표시는 이 바퀴에 모으는 것만 센다 — 2바퀴는 대상이 여섯 개로 갈리고
   * (컴퓨터가 새로 끼고 창문·달력이 빠진다) 1바퀴 목록을 그대로 두면 영영 안
   * 채워지는 칸이 남는다. 방 밝기의 분모는 이것과 다르다 — 그쪽은 V자를 그리는
   * 축이라 1바퀴 수집 수(MEMORY_GOAL)와 2바퀴 재조사 수를 따로 본다.
   */
  const roundMemories = memoriesForPhase(phase);
  const roundDone = phase === 1 ? collected : revisited;
  const count = roundMemories.filter((memory) => roundDone.includes(memory.id)).length;
  const isEndingReady = useMemoryRoomStore(selectEndingReady);
  const isDoorReady = useMemoryRoomStore(selectDoorReady);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  // 타이틀 화면이 떠 있는 동안에는 인게임 HUD를 아예 렌더하지 않는다 — 블러 너머로 비친다.
  const started = useMemoryRoomStore((state) => state.started);
  // BGM은 밝기와 같은 값을 먹는다 — 방이 어두워지면 곡도 벽 너머로 물러난다.
  // 인터랙션 중에는 눌러둔다: 미니게임은 효과음이, 대사는 글이 주인공이다.
  // 미니게임은 효과음이, 대사는 글이 주인공이다 — 눌러야 하는 깊이가 다르다
  const musicForeground = useMemoryRoomStore(selectMusicForeground);
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  // 불을 끄면 곡도 같이 물러난다 — 밝기와 음색을 한 축으로 묶어 둔 이득이다
  const heardLevel = lampScaled(lightLevel, lightsOn);
  // 컷씬은 방송이 끊긴 정적 위에 서는 장면이라 곡도 같이 멎는다 (selectMusicPlaying)
  const musicPlaying = useMemoryRoomStore(selectMusicPlaying);
  useRoomMusic({
    playing: musicPlaying,
    phase,
    level: heardLevel,
    foreground: musicForeground,
  });

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* 플레이 가능한 3D 방 */}
      <RoomCanvas />

      {/*
        문은 씬 안의 진짜 문이다 (RoomShell·LivingRoomShell). 안내문만 DOM으로 띄운다 —
        배트가 켜지는 순간(방문이 열릴 준비)과 현관문이 켜지는 순간(엔딩 준비)을
        같은 자리에서 한 줄씩 알린다.
      */}
      {isDoorReady && !endingStarted ? (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.3em] text-memory/80">
          {t("door.ready")}
        </p>
      ) : isEndingReady && !endingStarted ? (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.3em] text-memory/80">
          {t("door.exitReady")}
        </p>
      ) : null}

      {/* 비네트 + 필름 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: roomLightValue(ROOM_LIGHT_RAMP.vignette, heardLevel),
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
                <span className="text-sm"> / {roundMemories.length}</span>
              </span>
            </div>
            {/* 기억 하나당 한 칸 — 모을수록 금빛이 왼쪽부터 찬다 */}
            <div className="flex gap-1">
              {roundMemories.map((memory) => (
                <span
                  key={memory.id}
                  aria-hidden
                  className={`h-1 w-7 rounded-full transition-colors duration-700 ${
                    roundDone.includes(memory.id) ? "bg-memory shadow-slot-glow" : "bg-bone/18"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>
      )}

      {/* HUD — 햄버거 메뉴(언어 · 캐릭터 시트 · Contact · 리셋)와 소리 on/off */}
      {/* 레이어링 순서: 대사(z-10) < HUD·모달(z-30) < 미니게임(z-40, HUD를 덮는다) < 성공 파티클(z-50) */}
      {started && (
        /*
         * 가로가 아니라 세로로 쌓는다. 제일 좁은 폰(360px)에서 헤더(기억 진행 바)
         * 오른쪽 끝과 메뉴 버튼 사이가 48px인데, 버튼 하나(40px)와 간격(8px)을
         * 나란히 넣으면 딱 48px이라 여백이 0이 된다 — 헤더와 맞닿는다.
         */
        <div className="absolute right-6 top-6 z-30 flex flex-col items-end gap-2">
          {/*
            메뉴 드롭다운은 햄버거 바로 아래(top-full + mt-2)로 열리는데, 그 자리가
            소리 버튼 자리와 정확히 겹친다. 메뉴 쪽을 위로 올려 두지 않으면 열린 패널
            위로 소리 버튼이 뚫고 올라온다.
          */}
          <div className="relative z-10">
            <HudMenu />
          </div>
          <SoundToggle />
        </div>
      )}

      {started && (
        <>
          {/* 혼잣말 — 단계가 바뀌면 Monologue가 스스로 옛 줄을 물리고 새로 찍는다.
              key로 강제 리마운트하면 기억을 완료하는 순간 줄이 통째로 사라졌다
              다시 나타나서, 대사창이 닫히는 것과 겹쳐 깜빡임으로 보인다 */}
          <Monologue stageId={stage.id} />

          {/* 컷씬·다시보기 — 대사창(z-50)보다 아래에 깔려 그림 위로 글이 얹힌다 */}
          <PlaybackScene />
          <DialogueBox />
          <MemoryPanel />
          {/* 방에서 집어 든 종이 한 장 (기록 노트 · 서랍 쪽지) — 진행에 남지 않는다 */}
          <ClueOverlay />
          <CharacterSheetModal />
          <MinigameHost />
          <PuzzleHost />
          <DoorNudge />
        </>
      )}

      {/* 배트를 쥔 뒤 — 문이 열리는 걸 보여주고 나서 화면을 덮는다 */}
      <EndingScreen />

      {/* 씬(z-0) < 대사(z-10) < HUD·모달(z-30) < 타이틀(z-40) — 시작 전에는 전부 덮는다 */}
      <TitleScreen />
      {/* 타이틀 화면에서도 열 수 있어야 하므로 타이틀보다 뒤에 그린다 */}
      <ContactModal />
      <FeedbackModal />

      {/*
        개발 빌드에서만 뜨는 진행 점프 패널. process.env.NODE_ENV는 Next가 리터럴로
        치환하므로 프로덕션 컴파일에서는 이 자리가 `false && …`가 되어 패널 코드가
        번들에서 통째로 빠진다 — dynamic import가 아니라 정적 import여야 그렇게 된다.
      */}
      {process.env.NODE_ENV !== "production" && <AdminPanel />}

      {/*
        부팅 커튼(z-50) — 맨 위에서 전부 덮는다. 타이틀보다 **뒤에** 그리는 것이
        요점이다: 커튼이 걷히는 동안 그 아래에서 드러날 화면이 이미 있어야 한다.
      */}
      <BootCurtain />
    </div>
  );
}
