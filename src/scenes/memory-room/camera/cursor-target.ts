import type { Object3D } from "three";

/**
 * 커서의 꺾쇠가 감쌀 3D 오브젝트 (ui/CustomCursor ↔ use-glow-hover 사이의 다리).
 *
 * 스토어를 거치지 않는다. 프레임마다 바뀌는 화면 좌표를 상태로 굴리면 리렌더가 프레임
 * 수만큼 난다. 호버가 켜지는 컴포넌트가 `object`를 놓고, 캔버스 안의 CursorTargetProjector가
 * 프레임마다 그 오브젝트가 화면에서 차지하는 사각형(`screen`)을 옮겨 적고, 캔버스 밖의
 * 커서가 rAF에서 그 사각형을 읽는다.
 */
export interface CursorTargetState {
  /** 지금 커서가 얹힌, 만질 수 있는 오브젝트. 없으면 null. */
  object: Object3D | null;
  /** 그 오브젝트의 화면상 사각형(px). 캔버스가 아직 투영하지 않았으면 null. */
  screen: { left: number; top: number; right: number; bottom: number } | null;
  /** 마지막으로 호버가 켜진 시각 (performance.now). 윤곽선이 한 번 밝아지는 기준점. */
  hoverAt: number;
}

export const cursorTarget: CursorTargetState = { object: null, screen: null, hoverAt: 0 };

/** 호버가 켜졌다. 같은 오브젝트가 다시 켜져도 밝아지는 순간은 새로 센다. */
export function setCursorTargetObject(object: Object3D): void {
  cursorTarget.object = object;
  cursorTarget.hoverAt = performance.now();
}

/** 호버가 꺼졌다. 그 사이 다른 오브젝트가 들어왔으면 그쪽은 건드리지 않는다. */
export function clearCursorTargetObject(object: Object3D): void {
  if (cursorTarget.object !== object) return;
  cursorTarget.object = null;
  cursorTarget.screen = null;
}

/**
 * 호버가 켜진 뒤 흐른 시간에 따른 윤곽선의 여분 밝기 (0~1). 켜지는 순간 1에서 시작해
 * 0.6초 남짓이면 잦아든다. 꺾쇠가 물건을 감싸는 것과 같은 박자다.
 */
export function hoverGlowPulse(now: number, hoverAt: number): number {
  if (hoverAt <= 0 || now < hoverAt) return 0;
  const pulse = Math.exp((-(now - hoverAt) / 1000) * 5);
  return pulse < 0.01 ? 0 : pulse;
}
