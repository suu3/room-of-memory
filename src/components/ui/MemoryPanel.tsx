"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MEMORIES, MEMORY_GOAL } from "@/data/memory-room";
import { selectCollected, useMemoryRoomStore } from "@/store/memory-room";

export function MemoryPanel() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  // 기본 닫힘 — 열린 드로어가 씬의 핫스팟(창문 등)을 가리지 않게 한다
  const [open, setOpen] = useState(false);
  const collected = useMemoryRoomStore(selectCollected);
  const count = collected.length;

  return (
    <aside
      className={`absolute right-4 top-1/2 w-72 -translate-y-1/2 transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-76"
      }`}
    >
      <div className="relative rounded-md border border-bone/15 bg-ink/90 shadow-panel backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? t("panel.close") : t("panel.open")}
          className="absolute -left-9 top-1/2 flex h-30 w-9 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-l-sm border border-r-0 border-bone/15 bg-ink/90"
        >
          <span className="text-xs font-bold tracking-widest text-bone [writing-mode:vertical-rl]">
            {t("panel.title")}
          </span>
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-memory px-1 text-xs font-bold text-scene-navy">
            {count}
          </span>
        </button>

        <div className="px-4 pb-2.5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold tracking-wide text-bone">{t("panel.title")}</span>
            <span className="text-xs text-fog">
              {count} / {MEMORY_GOAL}
            </span>
          </div>
          <div className="mt-2.5 border-t-2 border-dashed border-memory/35" />
        </div>

        <ul className="flex flex-col px-3 pb-3">
          {MEMORIES.map((memory) => {
            const done = collected.includes(memory.id);
            return (
              <li
                key={memory.id}
                className={`flex items-center gap-3 border-b border-dashed border-bone/10 px-2 py-2 last:border-b-0 ${
                  done ? "" : "opacity-60"
                }`}
              >
                <span
                  className={`grid size-11 flex-none place-items-center rounded-sm border transition-colors duration-500 ${
                    done
                      ? "border-memory/55 bg-memory/10 text-memory shadow-slot-glow"
                      : "border-bone/15 bg-scene-deep/50 text-bone/25"
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    role="presentation"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={memory.iconPath} />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`text-sm font-bold tracking-wide ${done ? "text-memory" : "text-bone/50"}`}
                  >
                    {done ? tRoom(`memories.${memory.id}.name`) : t("panel.unknownName")}
                  </span>
                  <span className="truncate font-hand text-base text-fog">
                    {done ? tRoom(`memories.${memory.id}.summary`) : t("panel.unknownSummary")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
