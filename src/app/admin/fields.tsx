"use client";

/**
 * 어드민 공용 입력 부품.
 *
 * 색은 게임 팔레트가 아니라 `admin-theme.css`의 어드민 전용 변수를 쓴다.
 * 이유는 그 파일 머리말에 적어 뒀다. 컴포넌트에 hex를 직접 박지 말고, 필요한
 * 색이 없으면 거기에 변수를 먼저 만든다.
 */
import { type ReactNode, useState } from "react";
import { CONTENT_LOCALES, type LocalizedText } from "@/types/content";

const LOCALE_LABEL: Record<string, string> = { ko: "한국어", en: "English", ja: "日本語" };

// 입력칸은 카드보다 한 단 내려앉힌다. 카드가 거의 흰색이라 같은 톤으로 두면 칸의 경계가 테두리
// 하나에만 걸린다. 포커스는 테두리 색만으로 알리지 않고 링을 같이 켠다 (키보드로도 보여야 한다).
export const inputClass =
  "w-full rounded-sm border border-[var(--admin-line-strong)] bg-[var(--admin-sunken)] px-3 py-2 " +
  "text-[var(--admin-ink)] outline-none transition-colors " +
  "placeholder:text-[var(--admin-ink-faint)] focus:border-[var(--admin-accent)] " +
  "focus:bg-[var(--admin-panel)] focus:ring-2 focus:ring-[var(--admin-accent-line)]";

// uppercase는 쓰지 않는다. 라벨에 섞인 영문(public 등)까지 대문자로 뒤집혀 경로처럼 안 읽힌다
export const labelClass = "text-[var(--admin-ink-soft)] text-xs tracking-wide";

/** 라벨 밑에 붙는 한 줄 설명: "언제 뜨는가" 같은 규칙을 화면 안에서 답한다. */
export const hintClass = "text-[var(--admin-ink-soft)] text-xs leading-normal";

/** 바탕보다 한 톤 밝은 종이: 카드. */
export const panelClass = "rounded-md border border-[var(--admin-line)] bg-[var(--admin-panel)]";

/** 카드 안에서 한 단 내려앉은 자리: 미리보기·요약. */
export const sunkenClass = "rounded-sm border border-[var(--admin-line)] bg-[var(--admin-sunken)]";

export const mutedClass = "text-[var(--admin-ink-soft)]";

/** 번호·화살표 같은 장식 전용. 본문에 쓰면 대비가 모자란다. */
export const faintClass = "text-[var(--admin-ink-faint)]";

/**
 * 라벨 + 입력 한 쌍. 입력을 label 안에 넣는 암묵적 연결이라 htmlFor가 없다.
 * 규칙은 children 안을 못 봐서 짝이 없다고 보지만, 렌더 결과는 제대로 묶인다.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: 입력이 children으로 들어와 암묵적으로 묶인다
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className={hintClass}>{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={inputClass}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function Select({
  value,
  options,
  onChange,
  allowEmpty,
  emptyLabel = "(없음)",
  labelOf,
}: {
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** 목록에 id 말고 사람이 읽을 것을 함께 세운다 (대사 첫 줄 등). */
  labelOf?: (option: string) => string;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {labelOf ? labelOf(option) : option}
        </option>
      ))}
    </select>
  );
}

/**
 * ko/en/ja 세 칸을 한 묶음으로: 한 언어만 고치고 나머지를 잊는 것이 가장 흔한
 * 실수라, 항상 셋을 나란히 세운다. 비어 있으면 저장이 막힌다.
 */
export function LocalizedInput({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  rows?: number;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelClass}>{label}</legend>
      {CONTENT_LOCALES.map((locale) => (
        <div key={locale} className="flex items-start gap-2">
          <span className={`w-16 shrink-0 pt-2 text-xs ${mutedClass}`}>{LOCALE_LABEL[locale]}</span>
          <textarea
            className={`${inputClass} resize-y font-sans leading-dialogue`}
            rows={rows}
            value={value?.[locale] ?? ""}
            data-empty={!value?.[locale]?.trim()}
            onChange={(event) => onChange({ ...value, [locale]: event.target.value })}
          />
        </div>
      ))}
    </fieldset>
  );
}

export function Button({
  children,
  onClick,
  tone = "quiet",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "quiet" | "primary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const tones = {
    quiet:
      "border-[var(--admin-line-strong)] bg-[var(--admin-panel)] text-[var(--admin-ink)] " +
      "hover:bg-[var(--admin-sunken)]",
    primary:
      "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-[var(--admin-panel)] " +
      "hover:brightness-110",
    danger:
      "border-[var(--admin-warn-line)] bg-[var(--admin-panel)] text-[var(--admin-warn)] " +
      "hover:bg-[var(--admin-warn-soft)]",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * 카드 접기 상태. 열림/닫힘을 id별로 들고 있되 손대지 않은 것은 기본값을 따른다.
 * 목록이 바뀌어도(기억 순서 교체 등) 따로 맞출 것이 없다.
 */
export function useCollapsible(defaultOpen: boolean) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return {
    isOpen: (id: string) => overrides[id] ?? defaultOpen,
    toggle: (id: string) => setOverrides((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultOpen) })),
    setAll: (ids: string[], open: boolean) =>
      setOverrides(Object.fromEntries(ids.map((id) => [id, open]))),
  };
}

/** 모두 펼치기 / 모두 접기 한 쌍. */
export function CollapseAll({
  onExpand,
  onCollapse,
}: {
  onExpand: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button onClick={onExpand}>모두 펼치기</Button>
      <Button onClick={onCollapse}>모두 접기</Button>
    </div>
  );
}

/**
 * 카드. onToggle을 주면 아코디언이 된다. 제목 줄 전체가 여닫는 버튼이고,
 * 접힌 동안에는 summary만 남는다 (접었을 때 아무것도 안 남으면 목록에서 카드를
 * 다시 찾을 수가 없다).
 */
export function Card({
  title,
  actions,
  children,
  open,
  onToggle,
  summary,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  summary?: ReactNode;
}) {
  const expanded = onToggle ? (open ?? false) : true;

  const heading = onToggle ? (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-2 text-left"
    >
      <span aria-hidden className={`shrink-0 text-xs ${faintClass}`}>
        {expanded ? "▾" : "▸"}
      </span>
      <span className="min-w-0 flex-1">{title}</span>
      {!expanded && summary ? (
        <span className={`shrink-0 font-normal text-xs ${mutedClass}`}>{summary}</span>
      ) : null}
    </button>
  ) : (
    title
  );

  return (
    <section className={`${panelClass} p-4`}>
      <header className={`flex items-center justify-between gap-3 ${expanded ? "mb-3" : ""}`}>
        <h3 className="min-w-0 flex-1 font-medium text-[var(--admin-ink)]">{heading}</h3>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {expanded ? children : null}
    </section>
  );
}
