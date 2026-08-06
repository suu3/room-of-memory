"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";
import type { ParseKeys } from "i18next";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { MEMORY_BY_ID, MEMORY_IDS, type MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { BlurredValue } from "./BlurredValue";

/**
 * 도해가 남긴 기록. 조사 오브젝트 하나가 항목 하나를 연다 (1:1).
 *
 * 해금을 "수집 개수"가 아니라 **그 오브젝트를 조사했는지**로 거는 것이 중요하다.
 * 개수로 걸면 라디오를 듣기 전에 사태의 정체가 열려서 반전이 무너진다.
 *
 * 2바퀴에서 다시 조사한 항목은 본문이 희망 톤으로 갈아끼워진다 —
 * "같은 물건이 다르게 보인다"를 기록에도 적용한 것. 사진도 같이 바뀐다
 * (액자: 그늘에 묻힌 얼굴 → 드러난 얼굴).
 *
 * 목록이 아니라 사진을 붙인 스크랩북인 이유는, 이 화면이 "읽는 곳"이기 전에
 * **모으는 곳**이기 때문이다. 빈 자리가 그림으로 남아야 몇 개를 아직 못 채웠는지가
 * 글자를 세지 않고 보인다.
 *
 * 열린 항목마다 다시보기가 붙는다. 미니게임을 다시 여는 게 아니라 그때의 대사와
 * 그림만 되짚는 재생이라(store의 buildMemoryReplay), 기록을 읽다 "그때 뭐라고
 * 했더라"로 이어지는 길이 끊기지 않는다.
 */
export function LoreEntries({ onReplay }: { onReplay?: () => void }) {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const collected = useMemoryRoomStore((state) => state.collected);
  const revisited = useMemoryRoomStore((state) => state.revisited);
  const replayMemory = useMemoryRoomStore((state) => state.replayMemory);

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {MEMORY_IDS.map((id, index) => {
        const memory = MEMORY_BY_ID[id];
        const unlocked = collected.includes(id);
        const rewritten = revisited.includes(id) && Boolean(memory.phase2);
        const phase = rewritten ? memory.phase2 : memory.phase1;
        const bodyKey = `lore.${id}.${rewritten ? "phase2" : "phase1"}` as ParseKeys<"memoryRoom">;
        const name = tRoom(`memories.${id}.name` as ParseKeys<"memoryRoom">);

        return (
          <li key={id}>
            {/*
              카드를 아주 조금 기울인다 (±0.6°). 손으로 붙인 것처럼 보이게 하려는
              것인데, 이보다 크면 글줄이 눕는 게 눈에 띄어 읽기가 나빠진다.
            */}
            <article
              className={`relative flex h-full flex-col rounded-sm border border-ink/12 bg-paper p-2.5 ring-1 ring-ink/5 ${
                index % 2 === 0 ? "rotate-[-0.6deg]" : "rotate-[0.6deg]"
              }`}
            >
              {/* 종이에 붙인 마스킹 테이프. mix-blend-multiply라 밑의 모눈이 비쳐 보인다 */}
              <span
                aria-hidden
                className="-top-2 -translate-x-1/2 -rotate-2 absolute left-1/2 h-4 w-14 rounded-[1px] bg-bone/80 mix-blend-multiply"
              />

              <LoreStill id={id} name={name} unlocked={unlocked} still={phase?.replayStill} />

              {/*
                잠긴 항목은 제목도 흐린다 — 제목만 봐도 무슨 일이 있었는지 짐작된다.
                제목 칸 자체는 비우지 않는다: 흐린 글자를 aria-hidden으로 덮고
                스크린리더에는 "왜 잠겼는지"를 대신 읽힌다 (BlurredValue와 같은 방식).
              */}
              <h3 className="mt-2.5 font-bold text-[0.625rem] text-ink/40 uppercase tracking-[0.18em]">
                {unlocked ? (
                  tRoom(`lore.${id}.title` as ParseKeys<"memoryRoom">)
                ) : (
                  <>
                    <span className="sr-only">{t("characterSheet.loreLocked")}</span>
                    <span aria-hidden className="block select-none blur-[4px]">
                      {tRoom(`lore.${id}.title` as ParseKeys<"memoryRoom">)}
                    </span>
                  </>
                )}
              </h3>

              {/* mt-auto가 아니라 flex-1 — 카드 높이가 달라도 다시보기 줄이 바닥에 맞는다 */}
              <div className="mt-1.5 flex-1">
                {unlocked ? (
                  <p className="block animate-fade-rise break-ko text-pretty text-ink/80 text-sm leading-relaxed">
                    {tRoom(bodyKey)}
                  </p>
                ) : (
                  <BlurredValue
                    text={tRoom(bodyKey)}
                    label={t("characterSheet.loreLocked")}
                    hint={t("characterSheet.lockedHint")}
                  />
                )}
              </div>

              {unlocked && (
                <button
                  type="button"
                  onClick={() => {
                    // 수첩을 닫아야 재생이 보인다 — 모달이 위를 덮고 있다
                    onReplay?.();
                    replayMemory(id);
                  }}
                  aria-label={t("panel.replay", { name })}
                  className="mt-3 flex cursor-pointer items-center gap-1 self-end rounded-sm border border-ink/15 px-1.5 py-0.5 font-bold text-[0.6875rem] text-ink/45 tracking-wide transition-colors hover:border-memory hover:text-memory focus-visible:outline-2 focus-visible:outline-memory focus-visible:outline-offset-2"
                >
                  <ArrowCounterClockwise size={11} weight="bold" />
                  {t("panel.replayAction")}
                </button>
              )}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 카드에 붙은 사진 한 장.
 *
 * 세 가지 상태가 있다. 아직 조사하지 않았으면 **빈 사진 자리**(모서리 홀더만 남은
 * 칸)다 — 아이콘조차 넣지 않는 이유는, 무엇이 들어올 자리인지까지 알려주면
 * "아직 모르는 물건"이라는 상태가 사라지기 때문이다.
 *
 * 조사했는데 그때 본 장면이 한 장으로 남지 않는 기억(게임기·라디오·폰·달력)은
 * 아이콘 판으로 대신한다. 미니게임 화면을 억지로 스크린샷처럼 끼워 넣는 것보다,
 * 그 물건이 거기 있었다는 표시만 남기는 편이 맞다.
 */
function LoreStill({
  id,
  name,
  unlocked,
  still,
}: {
  id: MemoryId;
  name: string;
  unlocked: boolean;
  still?: string;
}) {
  const { t } = useTranslation();
  const Icon = MEMORY_BY_ID[id].icon;

  if (!unlocked) {
    return (
      <div
        aria-hidden
        className="relative aspect-[4/3] w-full rounded-[2px] border border-ink/10 border-dashed bg-bone/25"
      >
        {/* 네 귀퉁이의 사진 홀더 — 사진만 빠져 있다는 신호 */}
        {[
          "left-1.5 top-1.5 border-l-2 border-t-2",
          "right-1.5 top-1.5 border-r-2 border-t-2",
          "left-1.5 bottom-1.5 border-b-2 border-l-2",
          "right-1.5 bottom-1.5 border-b-2 border-r-2",
        ].map((corner) => (
          <span key={corner} className={`absolute size-3.5 border-ink/20 ${corner}`} />
        ))}
      </div>
    );
  }

  if (!still) {
    return (
      <div
        aria-hidden
        className="grid aspect-[4/3] w-full place-items-center rounded-[2px] border border-memory/25 bg-memory/10 text-memory/70"
      >
        <Icon size={40} weight="duotone" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px] bg-bone/40">
      <Image
        src={still}
        alt={t("characterSheet.loreStill", { name })}
        fill
        sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 90vw"
        className="animate-fade-rise object-cover"
      />
    </div>
  );
}
