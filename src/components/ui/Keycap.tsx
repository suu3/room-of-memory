import { CursorClick } from "@phosphor-icons/react";

/**
 * 키캡 모양. 키가 아닌 "누르는 것"(타이틀의 소리 켜짐/꺼짐)도 같은 옷을 입혀
 * 조작 안내 줄에서 라벨(글)과 조작(캡)이 한눈에 갈리게 한다.
 */
export const KEYCAP_CLASS =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-night/50 px-1.5 align-middle font-sans text-[11px] font-medium leading-none text-ivory";

/** 키보드 키 하나. 조작 안내에서 "이 키를 누른다"를 글자가 아니라 모양으로 읽히게 한다. */
export function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={`${KEYCAP_CLASS} ${className ?? ""}`}>{children}</kbd>;
}

/**
 * 문장 속 키 이름. 앞뒤가 라틴 글자면 낱말의 일부라 키가 아니다 ("Enter"의 E, "Tab"의 a).
 * 한글·가나 조사가 바로 붙는 건 허용한다 ("WASD로", "Spaceで").
 */
const KEY_SOURCE = String.raw`(?<![A-Za-z])(?:WASD|Space|SPACE|Enter|Esc|Shift|Tab|[EZXC]|↑\/↓|←\/→|[←→↑↓])(?![A-Za-z])`;

/**
 * 조작 이름으로서의 "클릭". 나열 속에 홀로 선 것만 ("클릭 · WASD", "Next page: click · Space").
 * 문장 속 동사("클릭한 곳으로", "Click where to go")는 그대로 둔다.
 */
const CLICK_SOURCE = String.raw`(?<=^|[:：·]\s*)(?:클릭|[Cc]lick|クリック)(?=\s*(?:·|$))`;

const TOKEN_PATTERN = new RegExp(`(${CLICK_SOURCE})|${KEY_SOURCE}`, "g");

export type KeyHintPart = { kind: "text" | "key" | "click"; value: string };

/** 안내 문구를 글과 키로 가른다. 순서를 지키고, 이어 붙이면 원문이 그대로 나온다. */
export function splitKeyTokens(text: string): KeyHintPart[] {
  const parts: KeyHintPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: text.slice(last, index) });
    parts.push({ kind: match[1] ? "click" : "key", value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

/** 조작 안내 한 줄. 문장은 그대로 두고 키 이름과 "클릭"만 키캡으로 바꿔 끼운다. */
export function KeyHint({ text }: { text: string }) {
  return (
    <>
      {splitKeyTokens(text).map((part, index) =>
        part.kind === "text" ? (
          part.value
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 문장에서 나온 조각이라 순서가 곧 정체다
          <Keycap key={index} className="mx-0.5 gap-1">
            {part.kind === "click" && <CursorClick size="1.1em" weight="bold" aria-hidden />}
            {part.value}
          </Keycap>
        ),
      )}
    </>
  );
}
