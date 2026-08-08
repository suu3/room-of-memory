"use client";

import { type Ref, useRef } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";

/**
 * 자리수가 보이는 답 입력 — 세 숫자 입력란(트럼프·현관 잠금·노트북)이 함께 쓴다.
 *
 * 빈 슬롯 자체가 힌트다: "답은 n자리"까지는 공짜로 주고, 무엇인지는 단서로 찾게
 * 한다. 진짜 <input>은 슬롯 위에 투명하게 겹쳐 둔다 — 시각은 슬롯이 맡고, 물리
 * 키보드·포커스·스크린리더·기존 테스트(aria-label로 input을 찾는다)는 전부 실제
 * input이 받는다. 슬롯을 흉내 낸 div에 키 핸들러를 다는 순간 그 넷을 다 다시
 * 만들어야 한다.
 */
export function AnswerSlots({
  length,
  value,
  onChange,
  label,
  masked = false,
  rejected = false,
  solved = false,
  disabled = false,
  inputRef,
}: {
  length: number;
  /** 숫자만 담긴 현재 입력. 걸러내는 건 이 컴포넌트가 한다. */
  value: string;
  onChange: (digits: string) => void;
  /** 실제 input의 aria-label — 각 게임의 answerLabel을 그대로 받는다. */
  label: string;
  /** 비밀번호 자리(노트북)는 숫자 대신 점을 세운다. */
  masked?: boolean;
  rejected?: boolean;
  solved?: boolean;
  disabled?: boolean;
  /** 바깥에서 포커스를 쥐어야 할 때 (노트북 잠금 화면이 열리면 바로 입력받는다). */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const ownRef = useRef<HTMLInputElement>(null);

  return (
    /*
     * 슬롯 어디를 눌러도 입력이 시작되게 클릭을 실제 input으로 넘긴다. 키보드
     * 사용자는 input에 바로 탭이 닿으므로 키 핸들러는 필요 없다 — 이 div는
     * 마우스 전용 겉껍데기다.
     */
    // biome-ignore lint/a11y/noStaticElementInteractions: 조작 대상은 안의 input이다.
    // biome-ignore lint/a11y/useKeyWithClickEvents: 키보드는 input이 직접 받는다.
    <div
      className={`relative flex justify-center gap-1.5 ${rejected ? "animate-page-nudge" : ""}`}
      onClick={() => ownRef.current?.focus()}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index];
        return (
          <span
            key={`slot-${
              // biome-ignore lint/suspicious/noArrayIndexKey: 슬롯은 자리 그 자체라 인덱스가 곧 정체성이다.
              index
            }`}
            aria-hidden
            className={`grid h-11 w-9 place-items-center rounded-md border bg-paper text-lg font-bold tabular-nums text-ink transition-colors ${
              rejected ? "border-ember" : solved ? "border-memory text-memory" : "border-bone"
            } ${
              // 다음에 채워질 자리를 한 칸만 밝힌다 — 어디까지 왔는지가 눈에 잡힌다
              !disabled && !solved && index === value.length ? "border-memory/60" : ""
            }`}
          >
            {digit ? (masked ? "•" : digit) : ""}
          </span>
        );
      })}
      <input
        ref={(node) => {
          ownRef.current = node;
          if (typeof inputRef === "function") inputRef(node);
          else if (inputRef) inputRef.current = node;
        }}
        // 시각은 슬롯이 전담한다 — input은 투명하게 전체를 덮고 입력만 받는다
        className="absolute inset-0 cursor-text opacity-0"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
      />
    </div>
  );
}

/** phone-lock의 잠금 키패드와 같은 배열 — 화면 키보드는 게임마다 다르면 안 된다. */
const KEYPAD: readonly string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/**
 * 화면 숫자 키패드. 물리 키보드를 대체하는 게 아니라 나란히 있는 입력 수단이다 —
 * 터치 기기에서 OS 키보드가 화면 반을 덮는 것을 피하는 게 존재 이유라, 물리
 * 키보드 입력(AnswerSlots의 실제 input)은 그대로 살아 있다.
 */
export function AnswerKeypad({
  value,
  length,
  onChange,
  disabled = false,
}: {
  value: string;
  length: number;
  onChange: (digits: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid w-full max-w-52 grid-cols-3 gap-1.5">
      {KEYPAD.map((key) =>
        key === "" ? (
          <span key="pad-gap" aria-hidden />
        ) : (
          <button
            key={`pad-${key}`}
            type="button"
            disabled={disabled}
            aria-label={key === "⌫" ? t("minigame.answer.backspace") : key}
            onClick={() => {
              playSound("phoneBeep", { variation: 0.04 });
              onChange(key === "⌫" ? value.slice(0, -1) : (value + key).slice(0, length));
            }}
            className="cursor-pointer rounded-md border border-bone bg-paper py-2 text-base font-bold tabular-nums text-ink/80 transition-all hover:border-memory hover:text-ink active:translate-y-px active:bg-ink/5 disabled:cursor-default disabled:opacity-40"
          >
            {key}
          </button>
        ),
      )}
    </div>
  );
}
