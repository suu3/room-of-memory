"use client";

/** 자리표시 막대의 폭. 글줄처럼 읽히도록 마지막 줄만 짧다. */
const BAR_WIDTHS = ["100%", "92%", "58%"] as const;

/**
 * 아직 열리지 않은 값의 자리.
 *
 * 예전에는 실제 본문을 흐려서 깔았는데, 흐린 글자도 글자다. DOM에 그대로 실려
 * 있어 미수집 내용이 화면과 마크업 양쪽에 노출됐다. 지금은 본문을 아예 싣지 않고
 * 낮은 대비의 막대 몇 줄로 "여기 무언가 있다"까지만 말한다. `text`는 줄 수를 어림잡는
 * 데만 쓰고 렌더하지 않는다.
 *
 * 스크린리더에는 `label`("아직 열리지 않은 기록")이, 눈에는 `hint`가 읽힌다.
 */
export function BlurredValue({
  text,
  label,
  hint,
}: {
  /** 열렸을 때의 본문: 길이만 본다. 화면에도 접근성 트리에도 싣지 않는다. */
  text: string;
  /** 스크린리더에 읽히는 상태 */
  label: string;
  /** 눈에 보이는 안내 (선택) */
  hint?: string;
}) {
  const lines = Math.min(BAR_WIDTHS.length, Math.max(1, Math.round(text.length / 28)));

  return (
    <span className="relative block">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col gap-2 py-1.5">
        {BAR_WIDTHS.slice(0, lines).map((width) => (
          <span key={width} className="block h-2.5 rounded-sm bg-bone/70" style={{ width }} />
        ))}
      </span>
      {hint ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center text-xs font-medium tracking-[0.06em] text-graphite"
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}
