/**
 * 창으로 드는 볕(MemoryRoomScene의 sun)이 그림자맵을 다시 그릴지.
 *
 * 세기가 0인 볕은 그림자맵을 다시 그리지 않는다. visible·castShadow를 끄면 안 된다: 보이는
 * 광원·그림자 개수는 셰이더에 박혀 있어서, 거실에 들어서는 순간(창이 없어 볕이 꺼진다)
 * 화면의 모든 재질이 한꺼번에 재컴파일돼 한참 멈췄다. 그래서 `shadow.autoUpdate`만 끈다.
 *
 * 단, 맵이 **아직 없으면** 꺼져 있어도 그려야 한다. three는 autoUpdate가 꺼진 광원을 맵을
 * 만들기도 전에 건너뛴다 (WebGLShadowMap). 새 게임은 볕 0으로 시작하므로 첫 프레임부터
 * 꺼 버리면 맵이 영영 안 생기고, 셰이더의 그림자 샘플러(sampler2DShadow)에 빈 일반 텍스처가
 * 묶여 그림자 받는 메쉬의 드로우콜이 전부 버려진다 ("Mismatch between texture format and
 * sampler type"). 바닥·벽·가구가 통째로 사라지고 창 하늘판만 남는 증상이 그것이다.
 */
export function sunShadowAutoUpdate(intensity: number, mapReady: boolean): boolean {
  return !mapReady || intensity > 0.01;
}
