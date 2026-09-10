# react-three-fiber 규칙

## 경계

- `<Canvas>`는 반드시 클라이언트 컴포넌트(`"use client"`)에서 렌더. 페이지에서는 `next/dynamic` + `ssr: false`로 로드.
- Canvas 안에는 three 객체만, Canvas 밖에는 DOM만. 대사창/선택지 같은 UI는 drei `<Html>`이 아니라 Canvas 밖 오버레이(`src/components/ui/`)로 만든다. VN UI는 항상 화면 고정이므로 DOM이 접근성/폰트 렌더링에서 낫다.

## 성능 (필수)

- `useFrame` 안에서 `setState` 금지. ref를 직접 변이하거나 zustand의 transient subscribe(`store.subscribe`)를 쓴다.
- 루프 안에서 `new Vector3()` 등 객체 생성 금지: 모듈 스코프나 `useMemo`로 재사용.
- `useMemo` 안에서 ref를 세팅하지 않는다 (예: 모델을 clone하며 특정 메쉬를 `ref.current`에 담기). 개발 모드 StrictMode는 useMemo를 두 번 부르고 두 번째 결과를 버리므로 ref가 화면에 없는 복제본을 가리킨다. 필요한 메쉬는 useMemo의 반환값에 함께 담는다 (BedModel의 blanket).
- 머티리얼/지오메트리는 컴포넌트 간 공유 가능하면 `useMemo` 또는 모듈 스코프로 공유.
- 모델 로드는 `useGLTF`(drei), 프리로드는 `useGLTF.preload(path)`. 씬 전환에 쓰는 모델은 반드시 preload.
- 언마운트되는 커스텀 지오메트리/머티리얼/텍스처는 dispose 확인 (r3f 자동 dispose에 의존하되, 수동 생성분은 직접).
- 포스트프로세싱 이펙트는 `@react-three/postprocessing`의 `<EffectComposer>` 하나로 통합. 이펙트 개수는 성능 예산 안에서(모바일 기준 60fps 목표).

## 구조

- 씬은 `src/scenes/<ChapterId>Scene.tsx` 하나가 소유. 카메라 이동, 트리거 애니메이션은 씬이 시나리오의 `StageDirection`(camera/trigger 키)을 해석하는 방식으로 구현: 시나리오 데이터에 좌표를 넣지 않는다.
- 카메라 연출은 named position 맵(예: `{ desk: {...}, window: {...} }`)을 씬 안에 정의하고 lerp/damp로 전환.
- `three`의 클래스를 직접 import할 때는 `three` 루트에서 (`import { Vector3 } from "three"`).
