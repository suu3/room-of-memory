"use client";

import type { CSSProperties } from "react";

/** 인라인으로 넘기는 CSS 변수까지 받는 style 타입. 낱알마다 다른 값은 변수로만 전달된다. */
type DustStyle = CSSProperties & Record<`--${string}`, string | number>;

/**
 * 인덱스 하나로 재현되는 난수.
 *
 * Math.random을 쓰면 서버가 찍은 자리와 클라이언트가 찍은 자리가 달라 hydration이
 * 어긋난다. 흩어져 보이기만 하면 되는 값이라 진짜 난수일 필요가 없다.
 */
function hashUnit(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * CSS 값으로 쓸 수 있게 자릿수를 끊는다. 뒤에 남는 0은 지운다.
 * 브라우저는 `55.600%`를 다시 적을 때 `55.6%`로 줄이므로, 0을 달고 있으면
 * 왕복한 값이 서버가 쓴 것과 달라져 hydration이 어긋난다.
 */
function css(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

/**
 * 아래에서 떠오르는 먼지 낱알들. 모듈 스코프에서 한 번만 만든다. 다시 그려질
 * 때마다 자리가 바뀌면 먼지가 순간이동한다.
 *
 * 크기 분포는 방 안의 DustMotes와 같은 세제곱 편향이다. 대부분 작고 또렷하고 가끔
 * 크고 흐린 것이 섞여야 먼지로 읽힌다. 다 같은 크기면 눈이 패턴으로 읽어버린다.
 *
 * 값을 숫자가 아니라 **자릿수를 끊은 문자열**로 들고 있는 이유는 hydration이다.
 * 브라우저는 style 속성을 파싱해 다시 적을 때 소수를 제 자릿수로 반올림하는데,
 * 서버가 쓴 `90.68751597696973%`가 `90.6875%`로 돌아오면 React는 서버와 클라이언트가
 * 다른 것을 그렸다고 본다. 미리 끊어 두면 왕복해도 같은 글자다.
 */
const DUST = Array.from({ length: 34 }, (_, index) => {
  const bulk = hashUnit(index) ** 3;
  const size = 1.5 + bulk * 5;

  return {
    id: `mote-${index}`,
    left: `${css(hashUnit(index + 100) * 100, 3)}%`,
    // 아래에 몰지 않고 화면 전체에 흩는다. 모션을 끈 판에서는 이 자리가 그대로 그림이 된다.
    bottom: `${css(hashUnit(index + 200) * 92, 3)}%`,
    size: `${css(size, 2)}px`,
    /** 낱알 자신보다 넓게 번지는 헤일로. 점이 아니라 빛으로 보이게 하는 값이다. */
    blur: `${css(size * 2.5, 2)}px`,
    /** 큰 알갱이일수록 흐리다. 초점이 안 맞은 빛(보케)으로 읽히게 하는 값이다. */
    peak: css(0.5 - bulk * 0.3, 3),
    rise: `${css(26 + hashUnit(index + 300) * 30, 2)}vh`,
    drift: `${css((hashUnit(index + 400) - 0.5) * 90, 2)}px`,
    duration: `${css(11 + hashUnit(index + 500) * 13, 2)}s`,
    // 음수 지연: 처음부터 제 궤도 중간에 떠 있다. 0이면 전부 바닥에서 동시에 출발한다.
    delay: `${css(-hashUnit(index + 600) * 24, 2)}s`,
  };
});

/**
 * 밑에서 떠오르는 먼지 레이어: 부팅 커튼과 타이틀 화면이 함께 쓴다.
 *
 * 방 안에서 창빛에 걸린 먼지(DustMotes)를 DOM으로 옮긴 것이다. 기다리는 화면과
 * 들어갈 방이 같은 공기를 쓰게 하는 층이라, 3D 캔버스가 아직 없는 화면에서도
 * 돌아야 해서 DOM이다.
 *
 * count로 낱알 수만 조절한다. 배치는 결정적이라, 수를 줄이면 앞쪽 낱알이
 * 그대로 남고 뒤쪽이 빠진다 (화면마다 먼지 자리가 달라지지 않는다).
 */
export function RisingDust({ count = 34 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {DUST.slice(0, Math.max(0, Math.min(count, DUST.length))).map((mote) => (
        <span
          key={mote.id}
          className="boot-dust animate-boot-dust absolute rounded-full bg-memory"
          /*
           * `satisfies`가 아니라 캐스트다. style은 CSSProperties로 문맥이 잡혀 있어서,
           * 리터럴 안의 커스텀 속성(--dust-*)이 satisfies에 닿기 전에 먼저 걸린다.
           */
          style={
            {
              left: mote.left,
              bottom: mote.bottom,
              width: mote.size,
              height: mote.size,
              animationDuration: mote.duration,
              animationDelay: mote.delay,
              "--dust-blur": mote.blur,
              "--dust-peak": mote.peak,
              "--dust-rise": mote.rise,
              "--dust-drift": mote.drift,
            } as DustStyle
          }
        />
      ))}
    </div>
  );
}
