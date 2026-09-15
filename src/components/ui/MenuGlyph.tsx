/**
 * 햄버거 ↔ X. 아이콘을 갈아 끼우는 대신 세 줄이 접힌다: 위·아래 줄이 가운데로 모이며
 * 45도로 눕고, 가운데 줄은 줄어들며 사라진다. "열린다"가 아니라 "같은 물건이 모양을
 * 바꾼다"로 읽혀야 버튼이 하나로 느껴진다. 움직임은 globals.css의 .menu-glyph.
 *
 * 치수는 phosphor의 List(bold)와 같은 자리다: 24 격자에서 y 6·12·18, x 3.75~20.25,
 * 획 2.25. 옆의 소리 버튼(phosphor)과 같은 굵기로 선다.
 */
export function MenuGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      className="menu-glyph"
      data-open={open}
      width="1.25em"
      height="1.25em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
    >
      <line className="menu-glyph-top" x1="3.75" y1="6" x2="20.25" y2="6" />
      <line className="menu-glyph-mid" x1="3.75" y1="12" x2="20.25" y2="12" />
      <line className="menu-glyph-bottom" x1="3.75" y1="18" x2="20.25" y2="18" />
    </svg>
  );
}
