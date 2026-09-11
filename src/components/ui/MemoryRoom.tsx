"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { AdminPanel } from "@/components/dev/AdminPanel";
import { MEMORY_GOAL, memoriesForPhase } from "@/data/memory-room";
import { monologueIdFor } from "@/data/monologue";
import { useAudioRuntime, useRoomMusic } from "@/lib/audio";
import {
  lampScaled,
  ROOM_LIGHT_RAMP,
  roomLightLevel,
  roomLightValue,
} from "@/scenes/memory-room/visual-state";
import {
  selectAct,
  selectActTwoProgress,
  selectBatReady,
  selectCollected,
  selectDoorReady,
  selectMusicForeground,
  selectMusicPhase,
  selectMusicPlaying,
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
import { HudGuide } from "./HudGuide";
import { HudMenu } from "./HudMenu";
import { MinigameHost } from "./MinigameHost";
import { Monologue } from "./Monologue";
import { NotebookTab } from "./NotebookTab";
import { PlaybackScene } from "./PlaybackScene";
import { PuzzleHost } from "./PuzzleHost";
import { RoomCallout } from "./RoomCallout";
import { SoundToggle } from "./SoundToggle";
import { TitleScreen } from "./TitleScreen";

/*
 * 로딩 표시는 부팅 커튼이 혼자 맡는다 (BootCurtain).
 *
 * 여기에 loading 폴백을 걸면 청크를 받는 동안 전체 화면 오버레이가 뜨는데, 그
 * 위를 커튼이 또 덮어 로딩 표시가 두 겹이 된다. started는 저장하지 않으므로 이
 * 청크는 **항상** 커튼이 내려와 있는 동안 받는다. 즉 이 폴백은 언제나 겹친다.
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
  // 밝기는 V자: 1막은 어두워지고 2막 추리로 되밝아진다 (docs/content-design.md 5장)
  const recovery = useMemoryRoomStore(selectActTwoProgress);
  const lightLevel = roomLightLevel({
    collected: collected.length,
    memoryTotal: MEMORY_GOAL,
    recovery,
  });
  const act = useMemoryRoomStore(selectAct);
  /*
   * 진행 표시는 이 바퀴에 조사하는 것만 센다. 2바퀴는 대상이 갈리므로(컴퓨터·거실
   * 물건이 새로 끼고 창문·달력이 빠진다) 1바퀴 목록을 그대로 두면 영영 안 채워지는
   * 칸이 남는다. 밝기의 분모는 또 다르다. 그쪽은 2막 **필수 체인**만 세므로
   * 곁가지를 건너뛴 플레이어도 3막에서 방이 다 밝다 (actTwoProgress).
   *
   * 바퀴가 바뀌는 자리는 수집 완주(gamePhase)가 아니라 **방문**(act)이다. 7개를 다
   * 모은 순간 숫자가 0/11로 떨어지면 가장 힘들게 도달한 지점에서 성취가 통째로
   * 사라진 것처럼 보인다. 문이 열리기 전까지는 "1바퀴 · 7/7"로 꽉 찬 채 남고,
   * 라벨이 바퀴 수를 같이 말하므로 0/11이 리셋이 아니라 새 목록으로 읽힌다.
   */
  const round: 1 | 2 = act === 1 ? 1 : 2;
  const roundMemories = memoriesForPhase(round);
  const roundDone = round === 1 ? collected : revisited;
  const count = roundMemories.filter((memory) => roundDone.includes(memory.id)).length;
  // 대사창·컷씬·미니게임·단서가 떠 있는 동안 상단 독백은 물러난다. 말은 한 번에 하나만.
  const monologueHidden = useMemoryRoomStore(
    (state) =>
      state.activeInteraction !== null ||
      state.activePlayback !== null ||
      state.activePuzzle !== null ||
      state.activeClue !== null,
  );
  const monologueId = useMemoryRoomStore(monologueIdFor);
  const isBatReady = useMemoryRoomStore(selectBatReady);
  const isDoorReady = useMemoryRoomStore(selectDoorReady);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  // 타이틀 화면이 떠 있는 동안에는 인게임 HUD를 아예 렌더하지 않는다. 블러 너머로 비친다.
  const started = useMemoryRoomStore((state) => state.started);
  // BGM은 밝기와 같은 값을 먹는다. 방이 어두워지면 곡도 벽 너머로 물러난다.
  // 인터랙션 중에는 눌러둔다: 미니게임은 효과음이, 대사는 글이 주인공이다.
  // 미니게임은 효과음이, 대사는 글이 주인공이다. 눌러야 하는 깊이가 다르다
  const musicForeground = useMemoryRoomStore(selectMusicForeground);
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  // 불을 끄면 곡도 같이 물러난다. 밝기와 음색을 한 축으로 묶어 둔 이득이다
  const heardLevel = lampScaled(lightLevel, lightsOn);
  // 컷씬은 방송이 끊긴 정적 위에 서는 장면이라 곡도 같이 멎는다 (selectMusicPlaying)
  const musicPlaying = useMemoryRoomStore(selectMusicPlaying);
  // 곡이 갈리는 자리는 밝기와 다르다. 2막 곡은 방문이 열려야 든다
  const musicPhase = useMemoryRoomStore(selectMusicPhase);
  useRoomMusic({
    playing: musicPlaying,
    phase: musicPhase,
    level: heardLevel,
    foreground: musicForeground,
  });

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* 플레이 가능한 3D 방 */}
      <RoomCanvas />

      {/*
        문은 씬 안의 진짜 문이다 (RoomShell·LivingRoomShell). 안내문만 DOM으로 띄운다.
        방문이 열릴 준비(2막의 시작)와 현관의 배트가 켜지는 순간(3막)을 같은
        자리에서 한 줄씩 알린다.
      */}
      {isDoorReady && !endingStarted ? (
        <p className="monologue-text pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.2em] text-memory">
          {t("door.ready")}
        </p>
      ) : isBatReady && !endingStarted ? (
        <p className="monologue-text pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.2em] text-memory">
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

      {/*
        타이틀 + 진행. 밝은 캡슐 없이 장면 위에 글자만 얹는다. 그림자(.monologue-text)가
        밝은 물건 위에서도 글자를 세운다. 진행은 가는 분절 막대와 숫자 하나다.
      */}
      {started && (
        <header className="monologue-text absolute left-4 top-4 z-10 flex flex-col gap-2 md:left-6 md:top-6">
          <h1 className="text-base font-medium leading-snug tracking-tight text-ivory md:text-[1.0625rem]">
            {t("title")}
          </h1>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-fog">
                {t("hud.round", { value: round })}
                <span aria-hidden> · </span>
                {t("hud.memoryCount")}
              </span>
              {/* 모은 개수가 이 화면의 유일한 진행 지표다. 라벨보다 확실히 앞으로 나와야 한다 */}
              <span className="text-xs tabular-nums text-fog">
                <span className="text-base font-medium text-memory">{count}</span>
                <span> / {roundMemories.length}</span>
              </span>
            </div>
            {/*
              기억 하나당 한 칸: 모을수록 금빛이 왼쪽부터 찬다. 칸은 개수만 세고 어느
              기억인지는 모른다. 기억마다 칸을 고정하면 조사 순서에 따라 가운데가 먼저
              차서 "순서대로 안 찬다"로 읽힌다.
            */}
            <div className="flex gap-1">
              {roundMemories.map((memory, index) => (
                <span
                  key={memory.id}
                  aria-hidden
                  className={`h-0.5 w-6 rounded-full transition-colors duration-700 ${
                    index < count ? "bg-memory" : "bg-ivory/25"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>
      )}

      {/* HUD: 햄버거 메뉴(언어 · 캐릭터 시트 · Contact · 리셋)와 소리 on/off */}
      {/* 레이어링 순서: 대사(z-10) < HUD·모달(z-30) < 미니게임(z-40, HUD를 덮는다) < 성공 파티클(z-50) */}
      {started && (
        /*
         * 가로가 아니라 세로로 쌓는다. 제일 좁은 폰(360px)에서 헤더(기억 진행 바)
         * 오른쪽 끝과 메뉴 버튼 사이가 좁아, 버튼 둘(44px)을 나란히 넣으면 헤더와 맞닿는다.
         */
        <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-1 md:right-5 md:top-5">
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
          {/*
            화면 위 가운데 기둥: 혼잣말(Monologue) 아래에 지금 할 일(HudGuide)이 선다.
            둘을 한 흐름에 세우는 이유는 겹치지 않게 하기 위해서다. 안내를 왼쪽 위
            헤더에, 혼잣말을 절대 좌표에 따로 두면 폰에서 헤더가 길어지는 만큼 둘이
            포개진다. 혼잣말이 위, 안내가 아래다. 안내는 조작 설명이라 감정을 말하는
            혼잣말보다 앞에 나서지 않는다.

            HUD(왼쪽 위 제목·진행, 오른쪽 위 버튼) 아래에 선다. 폰에서는 오른쪽 버튼이
            두 줄로 쌓여 더 내려오고, 넓은 화면에서는 가운데 640px이 HUD 양끝과 겹치지
            않는 높이까지 올린다.

            혼잣말: 구간이 바뀌면 Monologue가 스스로 옛 줄을 물리고 새로 찍는다.
            key로 강제 리마운트하면 기억을 완료하는 순간 줄이 통째로 사라졌다
            다시 나타나서, 대사창이 닫히는 것과 겹쳐 깜빡임으로 보인다.
          */}
          <div className="pointer-events-none absolute left-1/2 top-28 z-10 flex w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-2.5 md:top-24 md:gap-3 lg:top-16">
            <Monologue monologueId={monologueId} hidden={monologueHidden} />
            <HudGuide hidden={monologueHidden} />
          </div>

          {/* 컷씬·다시보기: 대사창(z-50)보다 아래에 깔려 그림 위로 글이 얹힌다 */}
          <PlaybackScene />
          <DialogueBox />
          {/* 수첩(기록 페이지)으로 들어가는 오른쪽 가장자리 손잡이 */}
          <NotebookTab />
          {/* 방에서 집어 든 종이 한 장 (기록 노트 · 서랍 쪽지): 진행에 남지 않는다 */}
          <ClueOverlay />
          <CharacterSheetModal />
          <MinigameHost />
          <PuzzleHost />
          <DoorNudge />
          {/* 거실에 있는 동안 방의 액자가 켜졌다는 한 줄 (content-design 4-3) */}
          <RoomCallout />
        </>
      )}

      {/* 배트를 쥔 뒤: 문이 열리는 걸 보여주고 나서 화면을 덮는다 */}
      <EndingScreen />

      {/* 씬(z-0) < 대사(z-10) < HUD·모달(z-30) < 타이틀(z-40): 시작 전에는 전부 덮는다 */}
      <TitleScreen />
      {/* 타이틀 화면에서도 열 수 있어야 하므로 타이틀보다 뒤에 그린다 */}
      <ContactModal />
      <FeedbackModal />

      {/*
        개발 빌드에서만 뜨는 진행 점프 패널. process.env.NODE_ENV는 Next가 리터럴로
        치환하므로 프로덕션 컴파일에서는 이 자리가 `false && …`가 되어 패널 코드가
        번들에서 통째로 빠진다. dynamic import가 아니라 정적 import여야 그렇게 된다.
      */}
      {process.env.NODE_ENV !== "production" && <AdminPanel />}

      {/*
        부팅 커튼(z-50): 맨 위에서 전부 덮는다. 타이틀보다 **뒤에** 그리는 것이
        요점이다: 커튼이 걷히는 동안 그 아래에서 드러날 화면이 이미 있어야 한다.
      */}
      <BootCurtain />
    </div>
  );
}
