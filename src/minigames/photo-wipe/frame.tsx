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
    <div className="relative mx-auto w-fit rounded-md bg-scene-olive p-3.5 shadow-panel ring-1 ring-night/70">
      {/* 몰딩 안쪽 그늘 — 나무 두께가 보이는 선 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1.5 rounded-sm ring-1 ring-night/35"
      />
      {/* 금테 */}
      <div className="rounded-sm bg-memory p-px">
        {/* 매트 */}
        <div className="bg-bone p-2.5">
          <div className="relative block ring-1 ring-night/45">{children}</div>
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
