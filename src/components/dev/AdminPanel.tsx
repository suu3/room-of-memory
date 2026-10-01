"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEMORIES } from "@/data/memory-room";
import { DISCOVERY_IDS, PUZZLE_IDS } from "@/data/room-clues";
import { storyPhaseOf } from "@/data/story-phase";
import { useMemoryRoomStore } from "@/store/memory-room";
import {
  ADMIN_PHASES,
  type AdminSpace,
  applyAdminPatch,
  cycleAdminMemory,
  jumpToPhase,
  setAdminDoor,
  warpToSpace,
} from "./admin-actions";
import { memoryStage } from "./admin-progress";

/** 펼침 여부만 기억한다. 진행 저장본(rom-progress)과 섞이면 안 되므로 열쇠를 따로 쓴다. */
const OPEN_KEY = "rom-dev-admin-open";

/** 패널을 여닫는 키. 게임이 안 쓰는 자판이라 이동·진행과 부딪히지 않는다. */
const TOGGLE_KEY = "`";

const STAGE_LABEL = { none: "·", collected: "1", revisited: "2" } as const;

/** 몸을 옮길 공간. 라벨은 화면에 뜨는 글자이자 버튼 이름이다. */
const SPACES: readonly { id: AdminSpace; label: string }[] = [
  { id: "room", label: "방" },
  { id: "living", label: "거실" },
  { id: "bathroom", label: "화장실" },
  { id: "parents", label: "안방" },
];

export function AdminPanel() {
  const [open, setOpen] = useState(false);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const currentPhase = useMemoryRoomStore(storyPhaseOf);
  const batTaken = useMemoryRoomStore((state) => state.batTaken);
  const sinkDrained = useMemoryRoomStore((state) => state.sinkDrained);
  const solvedPuzzles = useMemoryRoomStore((state) => state.solvedPuzzles);
  const discoveries = useMemoryRoomStore((state) => state.discoveries);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const started = useMemoryRoomStore((state) => state.started);
  const reset = useMemoryRoomStore((state) => state.reset);

  // 첫 렌더는 서버와 같은 값(false)으로 두고, 붙은 뒤에 저장본을 읽는다. 곧장 읽으면 hydration이 어긋난다
  useEffect(() => {
    if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
  }, []);

  // 마운트 직후 이 effect의 첫 실행은 건너뛴다. 그 시점엔 위 복원 effect가 setOpen(true)를
  // 예약했더라도 아직 커밋 전이라 open은 여전히 false: 그대로 저장하면 방금 읽은 "1"을
  // "0"으로 덮어써 버린다. 두 번째 실행부터는 setOpen이 이미 커밋된 뒤이므로 안전하다.
  const skipFirstPersist = useRef(true);
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [open]);

  // updater 함수는 순수해야 한다(React가 dev에서 두 번 호출할 수 있음): 여기선 상태만 뒤집고,
  // 저장은 위 effect가 open 변화를 감지해서 처리한다. useCallback으로 참조를 고정해 두어야
  // 아래 keydown effect의 의존성 배열에 넣어도 매 렌더마다 리스너를 다시 붙이지 않는다.
  const toggleOpen = useCallback(() => {
    setOpen((was) => !was);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // repeat을 그냥 두면 키를 누르고 있는 동안 매 반복 이벤트마다 뒤집혀서 패널이 깜빡인다
      if (event.key !== TOGGLE_KEY || event.repeat) return;
      toggleOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleOpen]);

  return (
    <div className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end gap-2 font-pixel text-xs">
      {open && (
        // fieldset은 암묵적으로 role="group"이고 legend가 접근 가능한 이름을 주므로
        // 억제 주석 없이도 role="group"(name: "memories") 쿼리가 그대로 통과한다.
        // 네이티브 fieldset 기본 테두리·패딩은 author 스타일(border, p-3)이 항상 UA 기본값을
        // 이기므로 이미 지워진다. 유일하게 남는 건 margin-inline 기본값이라 m-0만 더한다.
        // (border-0/p-0을 같이 넣으면 Tailwind 컴파일 순서상 border-0가 border보다 뒤에 와서
        // 테두리가 사라져 버리므로 넣지 않는다. 실제 컴파일 결과로 확인함)
        <fieldset
          /*
           * 패널 안에서 누른 키가 방의 이동·진행 핸들러까지 흘러가면 안 된다.
           * 버블 단계 stopPropagation만으로는 부족하다. DialogueBox는 대사가 떠 있는 동안
           * 자기 Enter 핸들러를 window에 캡처 단계로 붙여 두는데, 캡처는 window가 경로 맨
           * 앞이라 여기서 막을 수 없는 것과 별개로, 이후 언젠가 window와 패널 사이(예: 앱
           * 루트)에 캡처 리스너가 생기더라도 버블 쪽처럼 걸러지도록 캡처 단계 짝을 붙여 둔다.
           * 백틱은 패널이 유일하게 직접 소비하는 키라, 여기서 stopPropagation과 함께 열림
           * 상태를 뒤집어 둔다. 그래야 패널 안에 포커스가 있어도 백틱으로 닫을 수 있다
           * (버블 단계 window 리스너는 이 이벤트를 못 보므로 거기선 못 닫는다).
           */
          onKeyDownCapture={(event) => {
            event.stopPropagation();
            if (event.key === TOGGLE_KEY && !event.repeat) toggleOpen();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className="m-0 flex w-56 flex-col gap-3 rounded-md border border-bone/30 bg-ink/95 p-3 text-bone"
        >
          <legend className="sr-only">memories</legend>
          <div className="grid grid-cols-4 gap-1">
            {MEMORIES.map((memory) => {
              const stage = memoryStage({ collected, revisited }, memory.id);
              return (
                <button
                  key={memory.id}
                  type="button"
                  aria-label={`${memory.id} ${stage}`}
                  onClick={() => cycleAdminMemory(memory.id)}
                  className={`cursor-pointer rounded-sm px-1 py-1 text-[0.625rem] ${
                    stage === "none" ? "bg-night text-fog" : "bg-memory text-ink"
                  }`}
                >
                  {memory.id.slice(0, 4)} {STAGE_LABEL[stage]}
                </button>
              );
            })}
          </div>

          {/* 페이즈의 첫 순간으로 (v4). 지금 페이즈는 금빛 */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-fog">phase</span>
            {ADMIN_PHASES.map((phase) => (
              <button
                key={phase}
                type="button"
                onClick={() => jumpToPhase(phase)}
                className={`cursor-pointer rounded-sm px-2 py-1 ${
                  currentPhase === phase ? "bg-memory text-ink" : "bg-night text-bone"
                }`}
              >
                {phase}
              </button>
            ))}
          </div>

          {/* 몸을 옮긴다. 위치는 스토어에 없어서 체크박스로는 안 되고 신호를 보내야 한다 */}
          <div className="flex items-center gap-1">
            <span className="text-fog">warp</span>
            {SPACES.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => warpToSpace(space.id)}
                className="cursor-pointer rounded-sm bg-night px-2 py-1 text-bone"
              >
                {space.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="doorOpened"
              checked={doorOpened}
              onChange={(event) => setAdminDoor(event.target.checked)}
            />
            door
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="batTaken"
              checked={batTaken}
              onChange={(event) => applyAdminPatch({ batTaken: event.target.checked })}
            />
            bat
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="sinkDrained"
              checked={sinkDrained}
              onChange={(event) => applyAdminPatch({ sinkDrained: event.target.checked })}
            />
            sink drained
          </label>

          {PUZZLE_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={id}
                checked={solvedPuzzles.includes(id)}
                onChange={(event) =>
                  applyAdminPatch({
                    solvedPuzzles: event.target.checked
                      ? [...solvedPuzzles, id]
                      : solvedPuzzles.filter((each) => each !== id),
                  })
                }
              />
              {id}
            </label>
          ))}

          {DISCOVERY_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={id}
                checked={discoveries.includes(id)}
                onChange={(event) =>
                  applyAdminPatch({
                    discoveries: event.target.checked
                      ? [...discoveries, id]
                      : discoveries.filter((each) => each !== id),
                  })
                }
              />
              {id}
            </label>
          ))}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="endingStarted"
              checked={endingStarted}
              onChange={(event) => applyAdminPatch({ endingStarted: event.target.checked })}
            />
            ending
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="started"
              checked={started}
              onChange={(event) => applyAdminPatch({ started: event.target.checked })}
            />
            started
          </label>

          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-sm bg-paper px-2 py-1 text-ink"
          >
            reset
          </button>
        </fieldset>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        className="cursor-pointer rounded-sm border border-memory/50 bg-ink/90 px-2 py-1 text-memory"
      >
        DEV
      </button>
    </div>
  );
}
