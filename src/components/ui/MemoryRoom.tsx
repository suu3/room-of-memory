"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { AdminPanel } from "@/components/dev/AdminPanel";
import { MEMORY_GOAL, memoriesForPhase } from "@/data/memory-room";
import { monologueIdFor } from "@/data/monologue";
import { useAudioRuntime, useRoomMusic } from "@/lib/audio";
import { useMediaQuery } from "@/lib/use-media-query";
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
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { BootCurtain } from "./BootCurtain";
import { CharacterSheetModal } from "./CharacterSheetModal";
import { ClueOverlay } from "./ClueOverlay";
import { ContactModal } from "./ContactModal";
import { CustomCursor } from "./CustomCursor";
import { DialogueBox } from "./DialogueBox";
import { DialogueLog } from "./DialogueLog";
import { EndingScreen } from "./EndingScreen";
import { FeedbackModal } from "./FeedbackModal";
import { HudGuideBanner, HudGuideDock, HudSpaceLine } from "./HudGuide";
import { HudLogLine } from "./HudLogLine";
import { HudMenu } from "./HudMenu";
import { HudMiniMap } from "./HudMiniMap";
import { InventoryStrip } from "./InventoryStrip";
import { MinigameHost } from "./MinigameHost";
import { Monologue } from "./Monologue";
import { NotebookTab } from "./NotebookTab";
import { PlaybackScene } from "./PlaybackScene";
import { PuzzleHost } from "./PuzzleHost";
import { RemarkLine } from "./RemarkLine";
import { RoomCallout } from "./RoomCallout";
import { SoundToggle } from "./SoundToggle";
import { TitleScreen } from "./TitleScreen";
import { ViewpointTransition } from "./ViewpointTransition";

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
  /*
   * 화면 네 귀를 다 쓸 만큼 넓은가 (Tailwind md). 넓으면 "지금 할 일"이 왼쪽 위 헤더가
   * 아니라 **아래 띠**에 선다: 제목·진행(왼쪽 위), 메뉴(오른쪽 위), 목표(왼쪽 아래),
   * 기록 라벨(오른쪽 아래)로 방을 둘러싸는 틀이 된다. 폰에서는 띠를 둘 자리가 없어
   * (조이스틱·둘러보기 버튼이 아래에 선다) 헤더에 그대로 둔다. CSS로 두 자리에 다
   * 그리지 않는 이유는 안내 줄이 role="status"라 두 번 읽히기 때문이다.
   */
  const wide = useMediaQuery("(min-width: 768px)");
  /*
   * 햄버거를 접지 않고 메뉴를 한 줄로 펼칠 만큼 넓은가. 오른쪽 위 버튼과 가운데 혼잣말
   * 기둥(44vw) 사이에 설정 줄이 들어갈 폭은 1536px부터 남지만(제일 긴 일본어 기준),
   * 거기서는 기둥 끝과 거의 붙는다. 넉넉히 떨어지는 1800px부터 펼친다: 풀HD 모니터에서
   * 창을 꽉 채웠을 때만이다. 패널과 줄은 입력 잠금·리스너가 달라 둘 중 하나만 마운트한다.
   */
  const menuInline = useMediaQuery("(min-width: 1800px)");
  const isBatReady = useMemoryRoomStore(selectBatReady);
  const isDoorReady = useMemoryRoomStore(selectDoorReady);
  /** 방문이 열리면 오른쪽 위에 평면도(HudMiniMap)가 한 줄 더 선다. 혼잣말 기둥이 그만큼 내려앉는다 */
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  // 타이틀 화면이 떠 있는 동안에는 인게임 HUD를 아예 렌더하지 않는다. 블러 너머로 비친다.
  const started = useMemoryRoomStore((state) => state.started);
  // BGM은 밝기와 같은 값을 먹는다. 방이 어두워지면 곡도 벽 너머로 물러난다.
  // 인터랙션 중에는 눌러둔다: 미니게임은 효과음이, 대사는 글이 주인공이다.
  // 미니게임은 효과음이, 대사는 글이 주인공이다. 눌러야 하는 깊이가 다르다
  const musicForeground = useMemoryRoomStore(selectMusicForeground);
  const lightsOn = useMemoryRoomStore((state) => state.lightsOn);
  // 1인칭 구간. 인트로는 소등보다 깊은 어둠이다(blackout)
  const viewpoint = useMemoryRoomStore(selectViewpoint);
  // 불을 끄면 곡도 같이 물러난다. 밝기와 음색을 한 축으로 묶어 둔 이득이다.
  // 인트로의 어둠도 같은 축을 탄다: 스위치를 켜는 순간 곡이 방과 함께 차오른다
  const heardLevel = lampScaled(lightLevel, lightsOn, viewpoint === "intro");
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
      {/* 넓은 화면에서는 아래 띠(목표·기록 라벨) 위에 선다 (md:bottom-16) */}
      {isDoorReady && !endingStarted ? (
        <p className="monologue-text pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.2em] text-memory md:bottom-16">
          {t("door.ready")}
        </p>
      ) : isBatReady && !endingStarted ? (
        <p className="monologue-text pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-fade-rise font-pixel text-xs tracking-[0.2em] text-memory md:bottom-16">
          {t("door.exitReady")}
        </p>
      ) : null}

      {/* 비네트. 그레인은 캔버스 안의 셰이더 패스가 뿌린다 (scenes/memory-room/FilmLook) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: roomLightValue(ROOM_LIGHT_RAMP.vignette, heardLevel),
          background:
            "radial-gradient(115% 90% at 50% 42%, transparent 44%, color-mix(in srgb, var(--color-scene-void) 75%, transparent) 100%)",
        }}
      />
      {/*
        1인칭 구간의 비네트: 화면 가운데만 남기고 가장자리를 어둠에 잠근다. "일부만
        보인다"는 인상은 조명이 아니라 이 겹이 만든다 (visual-state의 BLACKOUT_FACTOR).
        인트로는 꽉 조이고, 문 넘기는 방이 이미 가장 어두운 지점이라 절반만 조인다.
        늘 렌더하고 투명도만 바꾼다: 들어가고 나올 때 번쩍임(ViewpointTransition)과 겹쳐
        부드럽게 잠기고 풀린다.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: viewpoint === "intro" ? 1 : viewpoint === "doorway" ? 0.55 : 0,
          background:
            "radial-gradient(62% 50% at 50% 52%, transparent 18%, color-mix(in srgb, var(--color-scene-void) 70%, transparent) 62%, var(--color-scene-void) 100%)",
        }}
      />
      {/*
        정지 그레인은 모션을 끈 사람에게만 남는다. 셰이더 그레인은 프레임마다 다시
        뿌려지는 노이즈라 낮은 세기라도 깜빡임이고, 그런 판에서는 FilmLook이 그레인
        패스를 아예 만들지 않는다. 이 타일이 그 빈자리를 메운다.
      */}
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 hidden motion-reduce:block"
      />

      {/*
        타이틀 + 진행. 밝은 캡슐 없이 장면 위에 글자만 얹는다. 그림자(.monologue-text)가
        밝은 물건 위에서도 글자를 세운다. 진행은 가는 분절 막대와 숫자 하나다.
        크기는 헤더에 걸린 --text-hud(폭 따라 16→22px) 하나를 안쪽이 em으로 따른다.
        제목 1em, 라벨 0.75em, 진행 칸 1.5em: 폭이 넓어지면 전부 같은 비율로 자란다.
      */}
      {started && (
        <header className="monologue-text absolute left-4 top-4 z-10 flex flex-col gap-[0.5em] text-hud md:left-6 md:top-6">
          <h1 className="text-[1em] font-medium leading-snug tracking-tight text-ivory">
            {t("title")}
          </h1>
          <div className="flex flex-col gap-[0.375em]">
            <div className="flex items-baseline gap-[0.5em]">
              {/* 지금 있는 곳. 방 하나뿐인 1막에는 안 뜬다 */}
              <HudSpaceLine />
              <span className="text-[0.75em] font-medium text-fog">
                {t("hud.round", { value: round })}
                <span aria-hidden> · </span>
                {t("hud.memoryCount")}
              </span>
              {/* 모은 개수가 이 화면의 유일한 진행 지표다. 라벨보다 확실히 앞으로 나와야 한다 */}
              <span className="text-[0.75em] tabular-nums text-fog">
                {/* 숫자가 바뀌면 아래에서 밀려 올라온다. key가 다시 마운트시킨다 */}
                <span
                  key={count}
                  className="inline-block animate-count-tick text-[1.3333em] font-medium text-memory"
                >
                  {count}
                </span>
                <span> / {roundMemories.length}</span>
              </span>
            </div>
            {/*
              기억 하나당 한 칸: 모을수록 금빛이 왼쪽부터 찬다. 칸은 개수만 세고 어느
              기억인지는 모른다. 기억마다 칸을 고정하면 조사 순서에 따라 가운데가 먼저
              차서 "순서대로 안 찬다"로 읽힌다.
            */}
            <div className="flex gap-[0.25em]">
              {roundMemories.map((memory, index) => (
                <span
                  key={memory.id}
                  aria-hidden
                  className={`h-0.5 w-[1.5em] rounded-full transition-colors duration-700 ${
                    // 새로 찬 칸은 왼쪽에서 차오른다. 이미 찬 칸은 클래스가 그대로라 다시 안 돈다
                    index < count ? "animate-segment-fill bg-memory" : "bg-ivory/25"
                  }`}
                />
              ))}
            </div>
            {/* 지금 할 일의 제자리(폰). 새 목표는 가운데(HudGuideBanner)에 잠깐 떴다가 여기로 온다.
                넓은 화면에서는 아래 띠가 이 자리다 */}
            {!wide && <HudGuideDock hidden={monologueHidden} />}
            {/* 들고 있는 물건. 빈손이면 안 그린다 */}
            <InventoryStrip />
          </div>
        </header>
      )}

      {/*
        아래 띠 (넓은 화면). 위쪽 1px 선 하나로 방 아래를 받치고, 왼쪽에 지금 할 일,
        오른쪽에 기록 라벨(MEMORY LOG · SIGNAL)이 선다. 타이틀의 아래 띠와 같은 문법이라
        시작을 눌러도 화면의 틀이 이어진다. 대사창·컷씬이 떠 있는 동안은 헤더의 안내 줄처럼
        물러난다. 방문·배트 안내 한 줄은 이 띠 위(md:bottom-16)에 선다.
      */}
      {started && wide && !endingStarted && (
        <footer
          className={`monologue-text pointer-events-none absolute inset-x-6 bottom-5 z-10 flex items-end justify-between gap-6 border-t border-line pt-3 text-hud transition-opacity duration-300 ${
            monologueHidden ? "opacity-0" : "opacity-100"
          }`}
        >
          <HudGuideDock hidden={monologueHidden} />
          <HudLogLine className="text-[0.6875em]" />
        </footer>
      )}

      {/* HUD: 메뉴(언어 · 난이도 · 오토 · 만든 사람 · 피드백 · 리셋)와 소리 on/off. 1800px부터 메뉴는 펼친 줄 */}
      {/* 레이어링 순서: 대사(z-10) < HUD·모달(z-30) < 미니게임(z-40, HUD를 덮는다) < 성공 파티클(z-50) */}
      {started && (
        /*
         * 가로가 아니라 세로로 쌓는다. 제일 좁은 폰(360px)에서 헤더(기억 진행 바)
         * 오른쪽 끝과 메뉴 버튼 사이가 좁아, 버튼 둘(44px)을 나란히 넣으면 헤더와 맞닿는다.
         */
        <div className="absolute right-3 top-3 z-30 flex items-start gap-[0.75em] text-hud md:right-5 md:top-5">
          {/* 넓은 화면: 메뉴 내용물을 버튼 왼쪽에 펼쳐 둔다 (HudMenu inline) */}
          {menuInline && <HudMenu inline />}
          <div className="flex flex-col items-end gap-1">
            {/*
              메뉴 드롭다운은 햄버거 바로 아래(top-full + mt-2)로 열리는데, 그 자리가
              소리 버튼 자리와 정확히 겹친다. 메뉴 쪽을 위로 올려 두지 않으면 열린 패널
              위로 소리 버튼이 뚫고 올라온다.
            */}
            {!menuInline && (
              <div className="relative z-10">
                <HudMenu />
              </div>
            )}
            <SoundToggle />
            {/* 작은 평면도 겸 이동 버튼. 방문이 열린 뒤에만 뜬다 */}
            <HudMiniMap />
          </div>
        </div>
      )}

      {started && (
        <>
          {/*
            화면 위 가운데 기둥: 혼잣말(Monologue) 아래에 새 목표 배너(HudGuideBanner)가
            잠깐 선다. 둘을 한 흐름에 세우는 이유는 겹치지 않게 하기 위해서다. 혼잣말이
            위, 안내가 아래다. 안내는 조작 설명이라 감정을 말하는 혼잣말보다 앞에 나서지
            않는다.

            HUD(왼쪽 위 제목·진행, 오른쪽 위 버튼) 아래에 선다. 폰에서는 오른쪽 버튼이
            두 줄로 쌓이고 헤더도 안내 줄까지 네 줄이라 그 밑(top-28)까지 내려오고, md에서는
            기둥이 헤더와 가로로 겹치는 폭이라 헤더 밑을 지키고, lg부터는 기둥이 헤더 오른쪽
            바깥에 서므로 HUD 양끝과 겹치지 않는 높이까지 올린다. 기둥 폭은 폭 따라
            640→840px.

            혼잣말: 구간이 바뀌면 Monologue가 스스로 옛 줄을 물리고 새로 찍는다.
            key로 강제 리마운트하면 기억을 완료하는 순간 줄이 통째로 사라졌다
            다시 나타나서, 대사창이 닫히는 것과 겹쳐 깜빡임으로 보인다.
          */}
          {/*
              폰에서 이 기둥은 폭을 거의 다 쓰기 때문에 위쪽 HUD를 좌우 양쪽으로 다 지나간다.
              그래서 양쪽 HUD 중 더 긴 쪽 밑에서 시작해야 글자가 겹치지 않는다. 방문이 열리기
              전에는 왼쪽 헤더(제목·진행·목표, 바닥 102px)와 오른쪽 햄버거·소리(바닥 104px)뿐이라
              top-32(128px)면 되고, 열린 뒤에는 오른쪽에 평면도가 한 줄 더 서고(바닥 174px)
              왼쪽에도 소지품 줄이 생겨 top-44(176px)까지 내려앉는다. 한 값으로 두면 1막 내내
              헤더와 혼잣말 사이가 휑하게 비었다 (2026-09-27). md부터는 좌우로 비켜설 폭이
              남아 예전 자리(top-28)를 그대로 쓴다.
            */}
          <div
            className={`pointer-events-none absolute left-1/2 z-10 flex w-[min(clamp(640px,44vw,840px),calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-2.5 md:top-28 md:gap-3 lg:top-16 ${
              doorOpened ? "top-44" : "top-32"
            }`}
          >
            {/* 인트로(불 켜기 전)에는 어둠 속의 한 줄(p0-dark)이 걸린다 (monologueIdFor) */}
            <Monologue monologueId={monologueId} hidden={monologueHidden} />
            <HudGuideBanner hidden={monologueHidden} />
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
          {/* 지나간 대사: 대사창 위에 얹힌다. 입구는 대사창 안의 작은 버튼 하나 */}
          <DialogueLog />
          <RemarkLine />
          {/* 거실에 있는 동안 방의 액자가 켜졌다는 한 줄 (content-design 4-3) */}
          <RoomCallout />
        </>
      )}

      {/* 시점이 바뀌는 순간의 한 겹: 카메라 컷을 덮는다. 타이틀(z-40)보다 앞에 그려 그 아래에 선다 */}
      <ViewpointTransition />

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

      {/* 마우스를 따라오는 점과 링. 맨 위(개발 패널보다도 위)라 커튼·모달·DEV 패널 위에서도 손이 보인다 */}
      <CustomCursor />
    </div>
  );
}
