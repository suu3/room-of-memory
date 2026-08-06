"use client";

/**
 * 어드민 공용 입력 부품.
 *
 * 게임 UI가 아니라 나만 보는 편집 화면이라 연출은 없다 — 대신 색·간격은
 * DESIGN.md 토큰을 그대로 쓴다. 편집 중인 대사가 게임에서 어떤 톤으로 보일지
 * 감이 오게 하려는 것이다.
 */
import type { ReactNode } from "react";
import { CONTENT_LOCALES, type LocalizedText } from "@/types/content";

const LOCALE_LABEL: Record<string, string> = { ko: "한국어", en: "English", ja: "日本語" };

export const inputClass =
  "w-full rounded-sm border border-fog/30 bg-night/60 px-3 py-2 text-paper " +
  "outline-none transition-colors placeholder:text-fog focus:border-memory";

export const labelClass = "text-xs uppercase tracking-wide text-fog";

/**
 * 라벨 + 입력 한 쌍. 입력을 label 안에 넣는 암묵적 연결이라 htmlFor가 없다 —
 * 규칙은 children 안을 못 봐서 짝이 없다고 보지만, 렌더 결과는 제대로 묶인다.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: 입력이 children으로 들어와 암묵적으로 묶인다
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      {children}
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
  emptyLabel = "— 없음 —",
}: {
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
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
          {option}
        </option>
      ))}
    </select>
  );
}

/**
 * ko/en/ja 세 칸을 한 묶음으로 — 한 언어만 고치고 나머지를 잊는 것이 가장 흔한
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
          <span className="w-16 shrink-0 pt-2 text-xs text-fog">{LOCALE_LABEL[locale]}</span>
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
    quiet: "border-fog/30 text-bone hover:border-fog/60",
    primary: "border-memory bg-memory/20 text-paper hover:bg-memory/30",
    danger: "border-ember/50 text-ember hover:bg-ember/15",
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

export function Card({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-fog/20 bg-scene-coal/60 p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium text-paper">{title}</h3>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
