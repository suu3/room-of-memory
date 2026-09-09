"use client";

import Image from "next/image";
import type { CharacterExpression } from "@/types/interaction";
import {
  PORTRAIT_BASE_EXPRESSION,
  PORTRAIT_OVERLAY_EXPRESSIONS,
  PORTRAIT_SOURCES,
  portraitExpressionOf,
} from "./character-portrait";

const PORTRAIT_SIZES = "(min-width: 768px) 180px, (min-width: 640px) 140px, 104px";
const PORTRAIT_IMAGE_CLASS = "object-contain object-bottom drop-shadow-lg";

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
      // 아래 20px을 대사창 뒤로 밀어 넣는다 — 얼굴 크롭이 끊긴 자리가 패널에 가려진다.
      // 모바일에서도 화자를 보여준다. 폭을 줄여 대사 텍스트를 가리지 않게만 한다.
      // z-0: 대사창(z-auto)이 초상 아래쪽을 덮는 VN 레이어링
      // 밑단은 패널 속으로 스며든다 (.portrait-fade) — 초상이 패널 뒤에서 올라오는 것으로 읽혀야 한다
      className="portrait-fade pointer-events-none absolute -top-27 left-3 z-0 h-32 w-26 animate-fade-rise sm:-top-39 sm:h-44 sm:w-35 md:-top-51 md:h-56 md:w-45"
    >
      {/*
        바닥은 항상 불투명하게 둔다. 전환 중에도 실루엣이 꽉 차 있어야
        합성 알파가 1로 유지되고, 캐릭터가 잠깐 비쳐 보이는 깜빡임이 사라진다.
      */}
      <Image
        src={PORTRAIT_SOURCES[PORTRAIT_BASE_EXPRESSION]}
        alt=""
        fill
        sizes={PORTRAIT_SIZES}
        draggable={false}
        className={PORTRAIT_IMAGE_CLASS}
      />
      {PORTRAIT_OVERLAY_EXPRESSIONS.map((candidate) => (
        <Image
          key={candidate}
          src={PORTRAIT_SOURCES[candidate]}
          alt=""
          fill
          sizes={PORTRAIT_SIZES}
          draggable={false}
          // 겹쳐두고 opacity만 바꾼다 — src를 갈아끼우면 프레임마다 깜빡인다
          className={`${PORTRAIT_IMAGE_CLASS} transition-opacity duration-200 ${
            candidate === shown ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
