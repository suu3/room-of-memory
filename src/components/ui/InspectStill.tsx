"use client";

/**
 * 3D 인스펙트 판을 찍어 둔 한 장 (src/lib/still-capture.ts).
 *
 * InspectView와 같은 무대 틀에 선다. 판이 멈춘 그림으로 바뀌는 순간 모양이 튀지 않도록
 * 테두리·그림자·높이를 맞춘다. 그림 자체에 무대 바탕이 구워져 있어 잘라 채워도(cover)
 * 가장자리가 바탕으로만 잘린다.
 */
export function InspectStill({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`inspect-stage relative overflow-hidden rounded-lg border border-line shadow-panel ${className}`}
    >
      {/* biome-ignore lint/performance/noImgElement: data URL이라 최적화 파이프라인이 할 일이 없다. */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block h-64 w-full select-none object-cover sm:h-80"
      />
    </div>
  );
}
