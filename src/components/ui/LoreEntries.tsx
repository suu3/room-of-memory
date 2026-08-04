"use client";

import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { MEMORY_BY_ID, MEMORY_IDS } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { BlurredValue } from "./BlurredValue";

/**
 * 도해가 남긴 기록. 조사 오브젝트 하나가 항목 하나를 연다 (1:1).
 *
 * 해금을 "수집 개수"가 아니라 **그 오브젝트를 조사했는지**로 거는 것이 중요하다.
 * 개수로 걸면 라디오를 듣기 전에 사태의 정체가 열려서 반전이 무너진다.
 *
 * 2바퀴에서 다시 조사한 항목은 본문이 희망 톤으로 갈아끼워진다 —
 * "같은 물건이 다르게 보인다"를 기록에도 적용한 것.
 */
export function LoreEntries() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);

  return (
    <dl className="flex flex-col">
      {MEMORY_IDS.map((id) => {
        const unlocked = collected.includes(id);
        const rewritten = revisited.includes(id) && Boolean(MEMORY_BY_ID[id].phase2);
        const bodyKey = `lore.${id}.${rewritten ? "phase2" : "phase1"}` as ParseKeys<"memoryRoom">;

        return (
          <div key={id} className="border-t border-ink/10 py-4 first:border-t-0 first:pt-0">
            {/* 잠긴 항목은 제목도 흐린다 — 제목만 봐도 무슨 일이 있었는지 짐작된다 */}
            <dt
              className={`text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ink/40 ${
                unlocked ? "" : "select-none blur-[4px]"
              }`}
              aria-hidden={!unlocked}
            >
              {tRoom(`lore.${id}.title` as ParseKeys<"memoryRoom">)}
            </dt>
            <dd className="mt-2">
              {unlocked ? (
                <span className="block animate-fade-rise break-ko text-pretty text-sm leading-relaxed text-ink/80">
                  {tRoom(bodyKey)}
                </span>
              ) : (
                <BlurredValue
                  text={tRoom(bodyKey)}
                  label={t("characterSheet.loreLocked")}
                  hint={t("characterSheet.lockedHint")}
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
