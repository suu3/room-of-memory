"use client";

import { Fragment } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { RESEARCH_REDACTION_RATIO, redactLine } from "@/components/ui/redaction";
import { PANEL_PAPER } from "@/components/ui/ui-classes";

/**
 * 세 언어의 견본 문단. 같은 줄 번호를 먹으므로 글자 수가 달라도 같은 상대 위치가
 * 깨지는 것을 나란히 볼 수 있다. 본문은 데모용 문장이고 게임의 대본이 아니다.
 */
const SAMPLES: readonly { lang: string; lines: readonly string[] }[] = [
  {
    lang: "ko",
    lines: [
      "3차 배양분은 안정화 단계에 들어갔다. 반응 속도는 예상보다 느리다.",
      "투여 후 48시간 안에 변화가 없으면 폐기한다. 남은 앰플은 냉장 보관.",
      "이 기록은 연구소 밖으로 나가지 않는다.",
    ],
  },
  {
    lang: "en",
    lines: [
      "The third culture has entered stabilization. Reaction is slower than expected.",
      "Discard if no change within 48 hours of dosing. Keep remaining ampoules refrigerated.",
      "This record does not leave the institute.",
    ],
  },
  {
    lang: "ja",
    lines: [
      "第三培養分は安定化段階に入った。反応速度は予想より遅い。",
      "投与後四十八時間以内に変化がなければ廃棄する。残りのアンプルは冷蔵保管。",
      "この記録は研究所の外に出さない。",
    ],
  },
];

/**
 * 깨진 글리프 데모 (docs/visual-experiments.md 11장 "깨진 글리프").
 *
 * 안방 책상의 연구 서류(ClueOverlay의 ResearchNote)가 하는 일을 종이 판 세 장에 세운다.
 * intensity가 곧 깨지는 비율이다: 게임은 RESEARCH_REDACTION_RATIO에 고정돼 있고, 여기서는
 * 그 값이 문장을 잃는 정도로 알맞은지 눈으로 재 본다. 움직이는 것이 없는 효과라 1차/2차
 * 토글은 뜻이 없고, disabled는 비율 0(원문 그대로)이다.
 */
export function RedactionLab() {
  return (
    <LabFrame
      title="깨진 글리프 · 연구 서류"
      note="서류의 몇 단어가 지워지거나 깨져 있다. hover 복원 없음: 읽을 수 없다는 것이 이야기다. intensity가 깨지는 비율이고, 세 언어는 같은 상대 위치에서 깨진다. 1차/2차는 뜻이 없다."
    >
      {({ intensity, enabled }) => {
        const ratio = enabled ? intensity : 0;
        return (
          <div className="flex flex-col gap-6 py-6">
            <p className="text-sm tabular-nums text-fog">
              ratio {ratio.toFixed(2)} · 게임 값 {RESEARCH_REDACTION_RATIO}
            </p>
            <div className="grid gap-6 lg:grid-cols-3">
              {SAMPLES.map(({ lang, lines }) => (
                <article key={lang} lang={lang} className={`p-6 ${PANEL_PAPER}`}>
                  <p className="border-b border-ink/10 pb-3 text-sm font-medium text-graphite">
                    {lang}
                  </p>
                  <div className="flex flex-col gap-2 pt-4">
                    {lines.map((line, index) => {
                      let offset = 0;
                      return (
                        <p
                          key={line}
                          className="break-ko text-pretty text-base leading-relaxed text-ink"
                        >
                          {redactLine(line, index, ratio).map((segment) => {
                            const at = offset;
                            offset += segment.text.length;
                            return segment.broken ? (
                              <Fragment key={at}>
                                <span aria-hidden className="select-none text-graphite/60">
                                  {segment.text}
                                </span>
                                <span className="sr-only">(읽을 수 없는 부분)</span>
                              </Fragment>
                            ) : (
                              <Fragment key={at}>{segment.text}</Fragment>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      }}
    </LabFrame>
  );
}
