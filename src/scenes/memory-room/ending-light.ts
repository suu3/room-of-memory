import type { Mesh } from "three";

/**
 * 엔딩에 현관문 개구부 밖에 서는 빛 판 (docs/visual-experiments.md 11장 "GodRays → 현관문").
 *
 * 컴포저(MemoryGlowRoot)의 GodRays 이펙트는 광원 메시를 손에 들어야 만들어지는데, 그 메시는
 * 거실 껍데기(LivingRoomShell의 FrontDoor) 깊숙이 있다. cursor-target과 같은 문법으로
 * 모듈 값 하나에 올려 두고, 컴포저는 엔딩이 시작될 때 여기서 꺼낸다.
 */
export const endingLight: { mesh: Mesh | null } = { mesh: null };

export function setEndingLightMesh(mesh: Mesh | null): void {
  endingLight.mesh = mesh;
}
