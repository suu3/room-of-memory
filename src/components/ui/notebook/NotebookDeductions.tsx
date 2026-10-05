"use client";

import { LinkSimpleIcon } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { DEDUCTION_IDS, DEDUCTIONS } from "@/data/deductions";
import { lastVisitDone, visitConfig } from "@/data/story-phase";
import { localizeAsset } from "@/lib/assets";
import { useMemoryRoomStore } from "@/store/memory-room";
import { selectLocale, useSettingsStore } from "@/store/settings";
import { LoreStill } from "./LoreEntries";
import { loreTitleKey } from "./lore-text";

/**
 * 수첩의 추리 페이지: 모순 찾기 판(DeductionBoard)에서 이어 낸 것이 남는 자리.
 *
 * 판은 한 번 풀면 다시 서지 않는다. 그래서 "그때 무엇과 무엇을 이었더라"가 남을 곳이
 * 필요하다: 어긋났던 말, 그 말과 안 맞던 기록 두 장, 그리고 도해가 적은 한 줄.
 * 기록 페이지가 "무엇을 봤는가"라면 여기는 "그래서 무엇을 알았는가"다.
 *
 * 아직 잇지 않은 추리는 자리도 두지 않는다. 빈 칸이 서 있으면 몇 개가 더 남았는지를
 * 미리 흘린다 (소지품 페이지와 같은 이유). 페이지 자체도 첫 추리와 함께 생긴다.
 */
export function NotebookDeductions() {
  const { t } = useTranslation();
  const { t: tRoom, i18n } = useTranslation("memoryRoom");
  const deduced = useMemoryRoomStore((state) => state.deduced);
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const rechecked = useMemoryRoomStore((state) => state.rechecked);
  const locale = useSettingsStore(selectLocale);
  const progress = { collected, revisited, rechecked };
  // 순서는 이은 순서가 아니라 표 순서다: 열 때마다 자리가 바뀌지 않고, 이야기 순서와도 같다
  const solved = DEDUCTION_IDS.filter((id) => deduced.includes(id));

  return (
    <ul className="mx-auto flex max-w-2xl flex-col gap-4 py-1">
      {solved.map((id) => {
        const { answer, claimantKey } = DEDUCTIONS[id];
        return (
          <li
            key={id}
            className="animate-fade-rise rounded-md border border-ink/10 bg-bone/30 px-4 py-4"
          >
            <figure className="border-ink/40 border-l-2 pl-3.5">
              <blockquote className="break-ko text-pretty text-ink text-sm font-medium leading-normal">
                “{t(`deduction.claims.${id}`)}”
              </blockquote>
              <figcaption className="mt-0.5 text-graphite text-xs">
                {tRoom(claimantKey as ParseKeys<"memoryRoom">)}
              </figcaption>
            </figure>

            {/* 그 말과 안 맞던 기록 두 장. 가운데 고리가 "이었다"를 말한다 */}
            <div className="mt-3.5 flex items-center gap-2.5">
              {answer.map((memory, index) => {
                const visit = lastVisitDone(progress, memory) ?? 2;
                const title = tRoom(
                  loreTitleKey(memory, visit, (key) =>
                    i18n.exists(key, { ns: "memoryRoom" }),
                  ) as ParseKeys<"memoryRoom">,
                );
                return (
                  <div key={memory} className="contents">
                    {index === 1 && (
                      <LinkSimpleIcon
                        aria-hidden
                        size={16}
                        weight="bold"
                        className="flex-none text-graphite"
                      />
                    )}
                    <div className="min-w-0 flex-1 rounded-sm border border-ink/10 bg-card p-1.5">
                      <LoreStill
                        id={memory}
                        name={title}
                        unlocked
                        wide
                        still={localizeAsset(visitConfig(memory, visit)?.replayStill, locale)}
                      />
                      <p className="mt-1 truncate text-ink text-xs font-medium">{title}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3.5 break-ko text-pretty text-ink text-sm leading-normal">
              {t(`deduction.notes.${id}`)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
