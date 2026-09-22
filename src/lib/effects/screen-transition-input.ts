/**
 * 화면 전환 이펙트(ScreenTransition)에 캔버스 안 다른 컴포넌트가 값을 흘리는 통로.
 *
 * cursor-target과 같은 문법: 모듈 스코프 값 하나. 재구성 전환(WireframeReveal)이 노이즈
 * 결의 양을 매 프레임 써넣고 ScreenTransitionDriver가 읽는다. 스토어를 거치면 프레임마다
 * 리렌더가 난다.
 */
export interface ScreenTransitionInputState {
  /** 노이즈 결의 양 (0~1). 면으로 돌아온 화면 위에 남았다가 잦아든다. */
  settle: number;
}

export const screenTransitionInput: ScreenTransitionInputState = { settle: 0 };

export function setScreenTransitionSettle(value: number): void {
  screenTransitionInput.settle = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
}
