"use client";

import { type CSSProperties, type ReactNode, useId } from "react";

/**
 * 게임기 화면을 굵은 도트로 다시 그리는 무대 상자 (docs/visual-experiments.md 4장 "게임기").
 *
 * 무대의 레이아웃은 그대로 두고, 그려진 결과만 `block`px 격자로 뭉갠다. 안의 좌표
 * 계산(stageLeft·점프 높이·스프라이트 칸)은 하나도 모르고 지나간다. `block`이 1이면
 * 아무것도 덧씌우지 않아 지금 화면 그대로다: `enabled=false`의 폴백이 곧 이 상태다.
 *
 * 왜 transform scale이 아니라 SVG 필터인가. 무대를 1/block 크기로 놓고 `scale(block)`으로
 * 키우는 방법은 브라우저가 변환된 층을 **최종 배율로 다시 래스터화**하기 때문에 해상도가
 * 떨어지지 않는다 (그라디언트·글자·배경 그림 전부 선명하게 다시 그려진다). `image-rendering:
 * pixelated`도 이미지 자체의 원본 픽셀에만 듣고 층의 확대에는 듣지 않는다. DOM을 실제로
 * 낮은 해상도로 그리는 CSS 한 줄은 `filter: url(#...)` 하나다.
 *
 * 필터의 구조. 격자 한 칸(block×block)마다 왼쪽 위 픽셀 하나만 남기고(feFlood 씨앗 →
 * feTile 격자 → feComposite in), 그 픽셀을 feOffset+feMerge로 오른쪽·아래로 복사해 칸을
 * 메운다. 복사 폭을 1→2→4…로 두 배씩 늘리고 마지막 걸음만 남는 폭에 맞추므로 칸 밖으로
 * 새지 않고, 한 칸 안의 복사본은 전부 같은 색이라 이음새가 없다. 흔히 쓰는 feMorphology
 * dilate는 (2r+1) 정방형이라 짝수 칸에서 이웃 칸과 겹치며 채널별 max로 밝은 줄이 생긴다.
 * 이 게임의 블록은 2와 4가 대부분이라 그 길로 안 갔다.
 *
 * 비용: 무대 한 판(256px 높이) 위에 primitive 열 개 안쪽. 렌더 타깃도 패스도 없다. 필터
 * 정의는 인스턴스마다 id를 따로 받아 실험실에서 여러 개를 나란히 놓아도 서로 안 섞인다.
 */
export function PixelStage({
  block,
  className,
  style,
  children,
}: {
  /** 블록 한 변(CSS px). 1이면 필터 없음. 정수가 아니면 반올림한다. */
  block: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  // React의 id에는 `:`·`«»` 같은 기호가 섞여 있다. url(#...)의 조각으로 쓰기 전에 걷어낸다
  const filterId = `pixel-stage-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const size = Math.max(1, Math.round(block));
  const active = size > 1;

  return (
    <>
      {active && (
        // 0×0의 자리 없는 svg: 필터 정의만 문서에 둔다. absolute라 줄 상자를 만들지 않는다
        <svg className="absolute size-0" aria-hidden="true" focusable="false">
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            // 픽셀을 복사만 하므로 선형 공간으로 갔다 올 이유가 없다 (변환 비용과 오차 둘 다)
            colorInterpolationFilters="sRGB"
          >
            {pixelatePrimitives(size)}
          </filter>
        </svg>
      )}
      <div
        className={className}
        style={
          active ? { ...style, filter: `url(#${filterId})`, imageRendering: "pixelated" } : style
        }
      >
        {children}
      </div>
    </>
  );
}

/**
 * `size`px 격자로 뭉개는 필터 primitive 열.
 *
 * 마지막 primitive의 결과가 필터의 출력이다. 이름은 `fill-<n>`으로 이어 붙여 다음 걸음이
 * 앞 걸음의 결과를 받는다.
 */
function pixelatePrimitives(size: number): ReactNode[] {
  const nodes: ReactNode[] = [
    // 씨앗: 격자 원점의 1px. 색은 아무래도 좋고 알파만 쓴다 (기본 flood-color 그대로)
    <feFlood key="seed" x={0} y={0} width={1} height={1} floodOpacity={1} result="seed" />,
    // 씨앗을 size×size 캔버스에 놓는다. 자기 자신 위에 over라 픽셀은 그대로, 영역만 커진다
    <feComposite
      key="tile"
      in="seed"
      in2="seed"
      operator="over"
      x={0}
      y={0}
      width={size}
      height={size}
      result="tile"
    />,
    // 그 칸을 무대 전체에 깐다: 칸마다 원점 1px만 뚫린 격자
    <feTile key="grid" in="tile" result="grid" />,
    // 격자로 원본을 자른다. 칸마다 픽셀 하나씩 남는다
    <feComposite key="sample" in="SourceGraphic" in2="grid" operator="in" result="fill-0" />,
  ];

  let source = "fill-0";
  let index = 0;
  for (const axis of ["x", "y"] as const) {
    let covered = 1;
    while (covered < size) {
      // 두 배씩 넓히되 칸을 넘지 않는다: 3이면 1→2→3, 4면 1→2→4
      const step = Math.min(covered, size - covered);
      index += 1;
      const shifted = `shift-${index}`;
      const merged = `fill-${index}`;
      nodes.push(
        <feOffset
          key={shifted}
          in={source}
          dx={axis === "x" ? step : 0}
          dy={axis === "y" ? step : 0}
          result={shifted}
        />,
        <feMerge key={merged} result={merged}>
          <feMergeNode in={source} />
          <feMergeNode in={shifted} />
        </feMerge>,
      );
      source = merged;
      covered += step;
    }
  }

  return nodes;
}
