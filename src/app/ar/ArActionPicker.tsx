"use client";

import { useTranslation } from "react-i18next";
import { FOCUS_RING } from "@/components/ui/ui-classes";
import { AR_ACTIONS, type ArAction } from "./ar-motion";

export function ArActionPicker({
  value,
  onChange,
}: {
  value: ArAction;
  onChange: (action: ArAction) => void;
}) {
  const { t } = useTranslation("ar");

  return (
    <fieldset aria-label={t("actions.label")} className="grid w-full max-w-xl grid-cols-5 gap-1.5">
      {AR_ACTIONS.map((action) => {
        const selected = value === action.id;
        return (
          <button
            key={action.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(action.id)}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border px-1 py-2 text-center text-[0.6875rem] font-medium leading-tight transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.96] ${FOCUS_RING} ${
              selected
                ? "border-memory/60 bg-memory/15 text-memory"
                : "border-line bg-surface text-fog hover:border-fog/40 hover:text-ivory active:bg-surface-strong"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {action.icon}
            </span>
            <span>{t(`actions.${action.id}`)}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
