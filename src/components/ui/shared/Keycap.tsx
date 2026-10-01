import {
  ArrowsVerticalIcon,
  CursorClickIcon,
  HandGrabbingIcon,
  HandTapIcon,
  type Icon,
  MouseScrollIcon,
} from "@phosphor-icons/react";

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
const CLICK_SOURCE = String.raw`(?<=^|[:：·・]\s*)(?:클릭|[Cc]lick|クリック)(?=\s*(?:[·・]|$))`;

/**
 * 손가락·휠로 하는 조작. "클릭"과 같은 규칙이라 나열 속에 홀로 선 것만 캡이 된다
 * ("아래로 스크롤 · 터치", "scroll down · Space"). 문장 속 동사("빛나는 물건을 탭해",
 * "Drag to turn it")는 그대로 둔다. 방향 부사가 붙어 있으면 한 덩어리로 캡에 넣는다.
 */
const GESTURE_WORDS = [
  String.raw`(?:(?:아래로|위로)\s)?(?:터치|탭|스크롤|드래그|휠)`,
  String.raw`(?:[Tt]ouch|[Tt]ap|[Ss]croll|[Ss]wipe|[Dd]rag|[Ww]heel)(?:\s(?:down|up))?`,
  "(?:下に|上に)?(?:タッチ|タップ|スクロール|スワイプ|ドラッグ|ホイール)",
].join("|");
const GESTURE_SOURCE = String.raw`(?<=^|[:：·・]\s*)(?:${GESTURE_WORDS})(?=\s*(?:[·・]|$))`;

const TOKEN_PATTERN = new RegExp(`(${CLICK_SOURCE})|(${GESTURE_SOURCE})|${KEY_SOURCE}`, "g");

export type KeyHintPart = { kind: "text" | "key" | "click" | "gesture"; value: string };

/** 제스처 캡 앞에 붙는 그림. 무엇으로 하는 조작인지가 글보다 먼저 읽힌다. */
function gestureIcon(value: string): Icon {
  if (/스크롤|휠|scroll|wheel|スクロール|ホイール/i.test(value)) return MouseScrollIcon;
  if (/swipe|スワイプ/i.test(value)) return ArrowsVerticalIcon;
  if (/드래그|drag|ドラッグ/i.test(value)) return HandGrabbingIcon;
  return HandTapIcon;
}

/** 안내 문구를 글과 키로 가른다. 순서를 지키고, 이어 붙이면 원문이 그대로 나온다. */
export function splitKeyTokens(text: string): KeyHintPart[] {
  const parts: KeyHintPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: text.slice(last, index) });
    parts.push({ kind: match[1] ? "click" : match[2] ? "gesture" : "key", value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

/** 캡 바로 뒤의 구분점(" ·", "・"). */
const SEPARATOR_HEAD = /^\s*[·・]/;

/** 조작 안내 한 줄. 문장은 그대로 두고 키 이름·"클릭"·제스처만 키캡으로 바꿔 끼운다. */
export function KeyHint({ text }: { text: string }) {
  const parts = splitKeyTokens(text);
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          // 캡 뒤의 구분점은 캡이 가져갔다 (아래)
          return parts[index - 1] && parts[index - 1].kind !== "text"
            ? part.value.replace(SEPARATOR_HEAD, "")
            : part.value;
        }
        const PartIcon =
          part.kind === "click"
            ? CursorClickIcon
            : part.kind === "gesture"
              ? gestureIcon(part.value)
              : null;
        // 캡과 뒤의 "·"를 한 덩어리로 묶는다. 캡은 inline-flex 상자라 경계에서 줄이 갈라지고,
        // 그러면 "·"만 다음 줄 맨 앞에 떨어진다
        const trailing = parts[index + 1]?.value.match(SEPARATOR_HEAD)?.[0] ?? "";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 문장에서 나온 조각이라 순서가 곧 정체다
          <span key={index} className="whitespace-nowrap">
            <Keycap className="mx-0.5 gap-1">
              {PartIcon && <PartIcon size="1.1em" weight="bold" aria-hidden />}
              {part.value}
            </Keycap>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
