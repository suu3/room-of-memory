/** 네 귀퉁이 금장식 위치. */
const CORNERS = [
  "left-1.5 top-1.5",
  "right-1.5 top-1.5",
  "bottom-1.5 left-1.5",
  "bottom-1.5 right-1.5",
];

/**
 * 사진을 감싸는 액자. 몰딩(scene-olive) → 금테(memory) → 매트(bone) 순으로 겹쳐
 * 실제 액자의 단면을 흉내낸다. 네 귀퉁이 금장식이 "벽에 걸린 물건" 느낌을 만든다.
 * 닦기 화면과 성공 후 확대 화면이 같은 액자를 써야 사진이 액자째 커진 것처럼 보인다.
 */
export function PhotoFrame({ children }: { children: React.ReactNode }) {
  return (
    // max-w-full이 없으면 사진 원본 폭(최대 620px)이 그대로 액자 폭이 되어
    // 좁은 화면에서 패널 밖으로 삐져나간다.
    <div className="relative mx-auto w-fit max-w-full rounded-md bg-scene-olive p-3.5 shadow-panel ring-1 ring-night/70">
      {/* 몰딩 안쪽 그늘: 나무 두께가 보이는 선 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1.5 rounded-sm ring-1 ring-night/35"
      />
      {/* 금테 */}
      <div className="rounded-sm bg-memory p-px">
        {/* 매트 */}
        <div className="bg-bone p-2.5">
          {/*
            사진이 앉는 자리. 바탕을 깔아 두는 게 중요하다. 비워 두면 사진이
            붙기 전까지 액자 한가운데가 투명한 구멍이 되어 뒤의 방이 그대로
            비치고, 그림이 뒤늦게 툭 채워지면서 깜빡인 것처럼 보인다.
          */}
          <div className="relative block bg-bone ring-1 ring-night/45">{children}</div>
        </div>
      </div>
      {CORNERS.map((position) => (
        <span
          key={position}
          aria-hidden
          className={`pointer-events-none absolute size-2.5 rotate-45 bg-memory ring-1 ring-night/60 ${position}`}
        />
      ))}
    </div>
  );
}
