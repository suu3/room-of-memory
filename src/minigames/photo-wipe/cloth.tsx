/**
 * 사진을 닦는 행주 커서. 커서 자체가 행주라서 별도 스프라이트를 겹치지 않는다.
 * 색은 DESIGN.md 팔레트(scene-storm / memory / bone / night)에서 그대로 가져왔다.
 * 커서는 CSS 변수를 못 읽어서 데이터 URI 안에 값이 박혀야 한다.
 */
const CLOTH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
<g transform="rotate(-12 24 24)">
<path d="M9 32 L9 38 L21 41 L21 35 Z" fill="#1c2b33" stroke="#0b111a" stroke-width="1.5" stroke-linejoin="round"/>
<rect x="8" y="9" width="32" height="26" rx="2" fill="#2a3d48" stroke="#0b111a" stroke-width="1.5"/>
<path d="M9 10 H39 V21 Q24 25 9 21 Z" fill="#35505f"/>
<path d="M9 22 Q24 26 39 22" fill="none" stroke="#1c2b33" stroke-width="1.5"/>
<rect x="11.5" y="12.5" width="25" height="19" rx="1" fill="none" stroke="#b89a5e" stroke-width="1.6" stroke-dasharray="3 3"/>
<path d="M12 14 Q18 12.5 24 14" fill="none" stroke="#d8d0c2" stroke-width="1.2" opacity="0.5"/>
</g>
</svg>`;

const CLOTH_DATA_URI = `data:image/svg+xml,${encodeURIComponent(CLOTH_SVG)}`;

/** 캔버스 위 커서. 핫스팟은 행주 한가운데: 닦이는 원의 중심과 맞춘다. */
export const CLOTH_CURSOR = `url("${CLOTH_DATA_URI}") 24 24, crosshair`;
