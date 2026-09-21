"use client";

import {
  selectAct,
  selectDoorOpened,
  selectDoorReady,
  useMemoryRoomStore,
} from "@/store/memory-room";

/**
 * 화면 귀퉁이의 기록 라벨: `MEMORY LOG 01 · ● NO SIGNAL`.
 *
 * 타이틀과 인게임 HUD가 같은 줄을 쓴다. 3D 방만 덜렁 있으면 "웹페이지 위의 모형"으로
 * 읽히는데, 얇은 영문 픽셀 라벨 하나가 붙는 순간 "게임 화면"이 된다. 그림이 아니라
 * 글자로 만든 프레임이라 에셋이 없고, 언어를 가리지 않는 그래픽 글자라 번역하지 않는다.
 * 정보는 진행 줄(막·개수)과 안내(HudGuide)가 이미 나르므로 보조기술에는 숨긴다.
 *
 * 라벨은 이야기와 같이 상한다. 예쁘고 조용한 게임처럼 시작해서 조사할수록 UI에 무언가가
 * 스며드는 것이 이 게임의 구조("속에서 밝혀지는 진실")와 맞는다.
 *
 * - 1막: `MEMORY LOG 01` 앰버, `● NO SIGNAL` ash. 라디오는 아직 잡음뿐이다.
 * - 라디오에서 목소리를 잡은 뒤: `● SIGNAL FOUND` 앰버. 방문이 열리면 `LOG 02`.
 * - 3막(앰플을 찾아 진실을 안 뒤): `MEMORY LOG ??` ember. 붉은 그림자가 한 픽셀 어긋나
 *   있을 뿐 깜빡이지 않는다 (.hud-log-tainted). 좀비를 UI에 대놓고 박지 않는다.
 */
export function HudLogLine({ className = "" }: { className?: string }) {
  const act = useMemoryRoomStore(selectAct);
  const signal = useMemoryRoomStore((state) => selectDoorReady(state) || selectDoorOpened(state));
  const tainted = act === 3;

  return (
    <p
      aria-hidden
      className={`flex items-center gap-[0.75em] whitespace-nowrap font-pixel tracking-[0.12em] ${className}`}
    >
      <span className={tainted ? "hud-log-tainted text-ember" : "text-memory"}>
        MEMORY LOG {tainted ? "??" : `0${act}`}
      </span>
      <span className="h-px w-[1.5em] bg-line" />
      <span className={`flex items-center gap-[0.5em] ${signal ? "text-memory" : "text-ash"}`}>
        <span className="text-[0.6em]">●</span>
        {signal ? "SIGNAL FOUND" : "NO SIGNAL"}
      </span>
    </p>
  );
}
