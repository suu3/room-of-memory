/**
 * 캔버스 밖(미니게임 DOM)이 캔버스 안의 필름 룩(색수차·그레인)에 값을 흘리는 통로.
 *
 * 스토어를 거치지 않는다. 라디오 바늘은 매 프레임 움직이는데, 그 값을 상태로 굴리면
 * 프레임 수만큼 리렌더가 난다. cursor-target·event-pulse와 같은 문법: 모듈 스코프의
 * 값 하나를 쓰는 쪽이 매 프레임 써넣고 FilmLookDriver의 useFrame이 읽는다.
 *
 * `static`은 잡음의 양(0~1). 라디오 튜닝 거리(frequency-tune의 staticLevel)가 들어온다.
 * 상한은 film-look.ts가 잡는다: 여기 1을 넣어도 화면은 번쩍이지 않는다 (DESIGN.md의
 * "TV 정지 화면식 static 금지"는 세기의 문제라, 사건 펄스와 같은 상한 안에 둔다).
 */
export interface FilmLookInputState {
  static: number;
}

export const filmLookInput: FilmLookInputState = { static: 0 };

export function setFilmLookStatic(level: number): void {
  filmLookInput.static = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
}

/** 판을 닫을 때 부른다. 남은 값이 다음 화면에 새지 않게. */
export function clearFilmLookInput(): void {
  filmLookInput.static = 0;
}
