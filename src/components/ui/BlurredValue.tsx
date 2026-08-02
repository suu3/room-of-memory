"use client";

/**
 * 아직 열리지 않은 값 — 본문을 흐리게 덮고, 그 위에 왜 가려졌는지 한 줄 얹는다.
 *
 * 텍스트 자체를 블러 처리하므로 줄 수·길이가 실제 본문과 같아, 열렸을 때
 * 레이아웃이 튀지 않는다. i18n 리소스는 어차피 클라이언트 번들에 통째로
 * 들어가므로 DOM에서 빼도 실질적인 보호는 되지 않는다 — 대신 스크린리더와
 * 복사에는 노출되지 않게 막는다.
 */
export function BlurredValue({
  text,
  label,
  hint,
}: {
  text: string;
  /** 스크린리더용 설명. */
  label: string;
  /** 블러 위에 얹는 안내 문구. */
  hint?: string;
}) {
  return (
    <span className="relative block">
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        title={label}
        // 안내 문구가 위에 얹히므로 본문은 더 눌러둔다 — 둘 다 진하면 서로 읽기 어렵다
        className="block select-none text-sm leading-relaxed text-ink/40 blur-[5px]"
      >
        {text}
      </span>
      {hint ? (
        // 아래 본문과 같은 왼쪽 정렬 — 가운데로 띄우면 흐린 글줄과 축이 어긋나 겉돈다
        <span
          aria-hidden
          className="absolute inset-0 flex items-center text-[0.6875rem] font-bold tracking-[0.14em] text-memory"
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}
