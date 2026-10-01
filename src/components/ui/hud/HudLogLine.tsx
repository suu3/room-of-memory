"use client";

import type { MemoryId } from "@/data/memory-room";
import {
  selectAct,
  selectDoorOpened,
  selectDoorReady,
  useMemoryRoomStore,
} from "@/store/memory-room";

/** 날짜를 세게 해 주는 기억. 달력 뒤쪽의 正자를 보고 나서야 며칠째인지 안다. */
const DAY_MEMORY = "calendar" as MemoryId;

/**
 * 달력을 본 뒤 라벨에 붙는 날수. 이야기는 사태 뒤 30일이 지난 자리에서 시작한다
 * (scripts.yaml "30일 만에 처음으로 짐을 싼다"). 그 다음 날, 서른한 번째 날이다.
 */
const DAY_COUNT = 31;

/**
 * 화면 귀퉁이의 기록 라벨: `MEMORY LOG 01 · DAY 31 · ● NO SIGNAL`.
 *
 * 타이틀과 인게임 HUD가 같은 줄을 쓴다. 3D 방만 덜렁 있으면 "웹페이지 위의 모형"으로
 * 읽히는데, 얇은 영문 픽셀 라벨 하나가 붙는 순간 "게임 화면"이 된다. 그림이 아니라
 * 글자로 만든 프레임이라 에셋이 없고, 언어를 가리지 않는 그래픽 글자라 번역하지 않는다.
 * 정보는 진행 줄(막·개수)과 안내(HudGuide)가 이미 나르므로 보조기술에는 숨긴다.
 *
 * 라벨은 이야기를 따라 자란다. 예쁘고 조용한 게임처럼 시작해서 조사할수록 UI에 무언가가
 * 스며드는 것이 이 게임의 구조("속에서 밝혀지는 진실")와 맞는다.
 *
 * - 로그 번호는 **막**이다: 1막 `01`, 방문이 열리면 `02`, 앰플을 찾아 3막이 열리면 `03`.
 *   3막의 번호는 ember로 서고 붉은 그림자가 한 픽셀 어긋난다 (.hud-log-tainted).
 *   깜빡이지 않는다. 좀비를 UI에 대놓고 박지 않는다.
 * - `DAY 31`은 달력을 조사한 뒤에만 붙는다. 날짜는 게임 안에서 알아내는 단서라
 *   (폰 → 달력) 처음부터 적혀 있으면 안 된다.
 * - 신호: 라디오가 잡음뿐인 동안 `● NO SIGNAL` ash, 목소리를 잡은 뒤 `● SIGNAL FOUND` 앰버.
 */
export function HudLogLine({
  className = "",
  signal = true,
}: {
  className?: string;
  /**
   * 신호 조각(● NO SIGNAL / SIGNAL FOUND)을 이 줄에 붙일지. 타이틀은 false로 두고 신호를
   * 오른쪽 위 귀퉁이에 따로 세운다 (HudSignalLight): 날짜까지 붙은 한 줄은 폰 폭에서
   * 오른쪽이 잘렸다. 인게임 넓은 화면의 아래 띠는 자리가 넉넉해 한 줄 그대로다.
   */
  signal?: boolean;
}) {
  const act = useMemoryRoomStore(selectAct);
  const dayKnown = useMemoryRoomStore((state) => state.collected.includes(DAY_MEMORY));
  const tainted = act === 3;

  return (
    <p
      aria-hidden
      className={`flex items-center gap-[0.75em] whitespace-nowrap font-pixel tracking-[0.12em] ${className}`}
    >
      <span className={tainted ? "hud-log-tainted text-ember" : "text-memory"}>
        MEMORY LOG 0{act}
      </span>
      {dayKnown ? (
        <>
          <span className="h-px w-[1.5em] bg-line" />
          <span className="text-fog">DAY {DAY_COUNT}</span>
        </>
      ) : null}
      {signal ? (
        <>
          <span className="h-px w-[1.5em] bg-line" />
          <HudSignalLight />
        </>
      ) : null}
    </p>
  );
}

/**
 * 신호 조각 하나: 라디오가 잡음뿐인 동안 `● NO SIGNAL` ash, 목소리를 잡은 뒤 `● SIGNAL FOUND`
 * 앰버. 기록 줄 안에도 들어가고, 타이틀에서는 오른쪽 위 귀퉁이의 상태등으로 혼자 선다.
 */
export function HudSignalLight({ className = "" }: { className?: string }) {
  const signal = useMemoryRoomStore((state) => selectDoorReady(state) || selectDoorOpened(state));
  return (
    <span
      aria-hidden
      className={`flex items-center gap-[0.5em] whitespace-nowrap font-pixel tracking-[0.12em] ${
        signal ? "text-memory" : "text-ash"
      } ${className}`}
    >
      <span className="text-[0.6em]">●</span>
      {signal ? "SIGNAL FOUND" : "NO SIGNAL"}
    </span>
  );
}
