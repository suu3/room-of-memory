"use client";

import { useEffect, useState } from "react";
import { MEMORIES } from "@/data/memory-room";
import { PUZZLE_IDS } from "@/data/room-clues";
import { useMemoryRoomStore } from "@/store/memory-room";
import { applyAdminPatch, cycleAdminMemory } from "./admin-actions";
import { memoryStage } from "./admin-progress";

/** 펼침 여부만 기억한다. 진행 저장본(rom-progress)과 섞이면 안 되므로 열쇠를 따로 쓴다. */
const OPEN_KEY = "rom-dev-admin-open";

/** 패널을 여닫는 키. 게임이 안 쓰는 자판이라 이동·진행과 부딪히지 않는다. */
const TOGGLE_KEY = "`";

const STAGE_LABEL = { none: "·", collected: "1", revisited: "2" } as const;

export function AdminPanel() {
  const [open, setOpen] = useState(false);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const solvedPuzzles = useMemoryRoomStore((state) => state.solvedPuzzles);
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const started = useMemoryRoomStore((state) => state.started);
  const reset = useMemoryRoomStore((state) => state.reset);

  // 첫 렌더는 서버와 같은 값(false)으로 두고, 붙은 뒤에 저장본을 읽는다 — 곧장 읽으면 hydration이 어긋난다
  useEffect(() => {
    if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== TOGGLE_KEY) return;
      setOpen((was) => {
        localStorage.setItem(OPEN_KEY, was ? "0" : "1");
        return !was;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleOpen() {
    setOpen((was) => {
      localStorage.setItem(OPEN_KEY, was ? "0" : "1");
      return !was;
    });
  }

  return (
    <div className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end gap-2 font-pixel text-xs">
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset>은 기본 테두리·패딩이 붙어 레이아웃을 흐트러뜨린다 — 테스트가 찾는 role="group"만 유지
        <div
          role="group"
          aria-label="memories"
          /* 패널 안에서 누른 키가 방의 이동·진행 핸들러까지 흘러가면 안 된다 */
          onKeyDown={(event) => event.stopPropagation()}
          className="flex w-56 flex-col gap-3 rounded-md border border-bone/30 bg-ink/95 p-3 text-bone"
        >
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="doorOpened"
              checked={doorOpened}
              onChange={(event) => applyAdminPatch({ doorOpened: event.target.checked })}
            />
            door
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
        </div>
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
