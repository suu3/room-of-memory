"use client";

import Image from "next/image";
import type { CharacterExpression } from "@/types/interaction";
import { PORTRAIT_EXPRESSIONS, PORTRAIT_SOURCES, portraitExpressionOf } from "./character-portrait";

interface CharacterPortraitProps {
  /** 대사가 지정한 쉬는 표정. */
  expression: CharacterExpression;
  /** 타자 연출이 진행 중인지 — true면 입이 열린다. */
  talking: boolean;
}

/** 대사창 위에 서는 초상. 순수 장식이므로 클릭 대상이 아니다 (캐릭터 시트는 HUD 메뉴로). */
export function CharacterPortrait({ expression, talking }: CharacterPortraitProps) {
  const shown = portraitExpressionOf(expression, talking);

  return (
    <div
      aria-hidden
      // 4:5 — 원본 crop 비율과 맞춰 object-contain 여백을 없앤다.
      // z-0: 화자 이름 칩(z-10)이 초상 아래쪽을 덮는 VN 레이어링
      className="pointer-events-none absolute -top-45 left-2 z-0 hidden h-45 w-36 animate-fade-rise sm:block md:-top-55 md:h-55 md:w-44"
    >
      {PORTRAIT_EXPRESSIONS.map((candidate) => (
        <Image
          key={candidate}
          src={PORTRAIT_SOURCES[candidate]}
          alt=""
          fill
          sizes="(min-width: 768px) 176px, 144px"
          draggable={false}
          // 세 장을 겹쳐두고 opacity만 바꾼다 — src를 갈아끼우면 프레임마다 깜빡인다
          className={`object-contain object-bottom drop-shadow-lg transition-opacity duration-200 ${
            candidate === shown ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
