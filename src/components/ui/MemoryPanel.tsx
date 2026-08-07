"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MEMORIES, MEMORY_GOAL } from "@/data/memory-room";
import { selectCollected, useMemoryRoomStore } from "@/store/memory-room";

/** 수집 여부에 따라 버튼이 되기도, 그냥 줄이 되기도 한다. */
function Row({
  as,
  onClick,
  label,
  done,
  children,
}: {
  as: "button" | "div";
  onClick?: () => void;
  label?: string;
  done: boolean;
  children: React.ReactNode;
}) {
  const className = `group flex w-full items-center gap-3 px-2 py-2 text-left transition-colors ${
    done ? "cursor-pointer hover:bg-ink/5 active:bg-ink/10" : "opacity-55"
  }`;

  if (as === "div") {
    return <div className={className}>{children}</div>;
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {children}
    </button>
  );
}

export function MemoryPanel() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  // 기본 닫힘 — 열린 드로어가 씬의 핫스팟(창문 등)을 가리지 않게 한다
  const [openedAtResetRevision, setOpenedAtResetRevision] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const collected = useMemoryRoomStore(selectCollected);
  // 컴퓨터는 1바퀴가 없어 collected에 안 들어간다 — 2바퀴 재조사가 그 자리를 대신한다
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const replayMemory = useMemoryRoomStore((state) => state.replayMemory);
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  const open = openedAtResetRevision === resetRevision;
  const count = collected.length;

  useEffect(() => {
    setUiLock("memory-panel", open);
    return () => setUiLock("memory-panel", false);
  }, [open, setUiLock]);

  // 드로어 바깥을 클릭하면 닫는다
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpenedAtResetRevision(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <aside
      ref={panelRef}
      className={`absolute right-4 top-1/2 z-30 w-72 -translate-y-1/2 transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-76"
      }`}
    >
      <div className="relative rounded-xl border border-bone bg-paper shadow-panel">
        <button
          type="button"
          onClick={() => setOpenedAtResetRevision(open ? null : resetRevision)}
          aria-expanded={open}
          aria-label={open ? t("panel.close") : t("panel.open")}
          className="absolute -left-9.5 top-1/2 flex h-30 w-9 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-l-lg border border-r-0 border-bone bg-paper"
        >
          <span className="text-xs font-bold tracking-widest text-ink [writing-mode:vertical-rl]">
            {t("panel.title")}
          </span>
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-memory px-1 text-xs font-bold text-night">
            {count}
          </span>
        </button>

        <div className="px-4 pb-2.5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold tracking-wide text-ink">{t("panel.title")}</span>
            <span className="text-xs text-ink/60">
              {count} / {MEMORY_GOAL}
            </span>
          </div>
          <div className="mt-2.5 h-px bg-ink/10" />
        </div>

        <ul className="flex flex-col px-3 pb-3">
          {MEMORIES.map((memory) => {
            const done = collected.includes(memory.id) || revisited.includes(memory.id);
            return (
              <li key={memory.id} className="border-b border-ink/8 last:border-b-0">
                {/* 수집한 기억은 눌러서 다시 볼 수 있다 — 미수집은 누를 게 없으므로 버튼이 아니다 */}
                <Row
                  as={done ? "button" : "div"}
                  onClick={
                    done
                      ? () => {
                          setOpenedAtResetRevision(null);
                          replayMemory(memory.id);
                        }
                      : undefined
                  }
                  label={
                    done
                      ? t("panel.replay", { name: tRoom(`memories.${memory.id}.name`) })
                      : undefined
                  }
                  done={done}
                >
                  <span
                    className={`grid size-11 flex-none place-items-center rounded-md border-2 transition-colors duration-500 ${
                      done
                        ? "border-memory bg-memory/20 text-memory shadow-slot-glow"
                        : "border-ink/15 bg-bone/40 text-ink/30"
                    }`}
                  >
                    <memory.icon size={22} weight={done ? "duotone" : "regular"} />
                  </span>
                  {/*
                    이름만 — 한 줄 요약은 캐릭터 시트의 "기록"과 하는 말이 겹쳤다.
                    이 패널은 진행 추적기(몇 개 남았나), 내용물은 기록 탭이 맡는다.
                  */}
                  <span
                    className={`min-w-0 truncate text-sm font-bold tracking-wide ${
                      done ? "text-ink" : "text-ink/45"
                    }`}
                  >
                    {done ? tRoom(`memories.${memory.id}.name`) : t("panel.unknownName")}
                  </span>
                  {/*
                    회전 화살표 아이콘만 있으면 "새로고침"으로도 읽혀서 무슨 일이 벌어질지
                    모른 채 누르게 된다. 글자로 적어 둔다 — 줄 전체가 버튼이므로 이건
                    누를 수 있는 별개의 컨트롤이 아니라 그 줄이 하는 일의 이름표다.
                  */}
                  {done && (
                    <span className="ml-auto flex-none whitespace-nowrap rounded-sm border border-ink/15 px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-ink/45 transition-colors group-hover:border-memory group-hover:text-memory">
                      {t("panel.replayAction")}
                    </span>
                  )}
                </Row>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
