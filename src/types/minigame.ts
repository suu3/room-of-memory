/**
 * Minigame contract: every minigame is a self-contained component that
 * reports its outcome through `onComplete`. The VN engine (not the minigame)
 * decides what the result means: which node comes next, which flags get set.
 */

import type { ParseKeys } from "i18next";

/** common 네임스페이스에서 유효한 번역 키만 허용. */
export type CommonTextKey = ParseKeys<"common">;

/**
 * 난이도. 스토어의 Difficulty와 같은 값이지만 미니게임이 스토어에 기대지 않도록
 * 호스트가 props로 내려준다. 스킵 게이트는 여전히 useSkipEligible 한 곳이 맡고,
 * 이 값은 판 자체의 수치(대역 폭·바늘 속도·안타 수·피해량)에만 쓴다.
 */
export type MinigameDifficulty = "easy" | "normal";

export interface MinigameResult {
  /** Did the player clear it? Failure is a valid outcome, not an error. */
  cleared: boolean;
  /** Optional score for minigames with gradations. */
  score?: number;
  /**
   * 미니게임이 자기 화면에서 성공 연출(파티클·결과 대사)을 이미 보여줬다는 표시.
   * 호스트는 파티클을 한 번 더 터뜨리지 않는다.
   */
  celebrated?: boolean;
}

export interface MinigameProps {
  /** Call exactly once when the minigame ends (clear, fail, or skip). */
  onComplete: (result: MinigameResult) => void;
  /**
   * 인터랙션이 시작된 게임 페이즈. 1차/2차 조사에서 같은 미니게임을 다르게
   * 연출할 때만 쓴다 (액자는 2차에서 그늘이 걷힌 사진이 나온다).
   * 스토어의 GamePhase와 같은 값이지만, 미니게임이 스토어에 의존하지 않도록
   * 호스트가 props로 내려준다. 기본값은 1. 3은 3차 조사(컴퓨터 로고 매칭)다.
   */
  gamePhase?: 1 | 2 | 3;
  /** 난이도. 기본값 "easy". 수치를 난이도로 가르는 미니게임만 읽는다. */
  difficulty?: MinigameDifficulty;
  /**
   * 지금 손에 든 물건 (src/data/items.ts의 ItemId). 기본값은 빈손.
   *
   * 방탈출 축의 문제는 "저쪽에서 가져온 것"에 따라 화면이 달라진다 (피아노 악보의
   * 지워진 마디는 찢어진 조각을 들고 있을 때만 드러난다). gamePhase·difficulty와
   * 같은 이유로 props다: 미니게임이 스토어를 직접 읽으면 판 하나가 게임 전체를 안다.
   */
  carrying?: readonly string[];
  /**
   * Player asked to skip (accessibility requirement: every minigame must
   * call onComplete({ cleared: true }) when skipped).
   */
  onSkip?: () => void;
  /**
   * 지금 화면이 무엇인가. 기본값 "play".
   *
   * "result"는 판이 끝나고 결과 대사가 그 위에 뜬 상태다. 미니게임 화면은 남지만
   * 더는 게임이 아니다. 이 단계에서 계속 애니메이션이 돌고 입력을 먹으면 대사가
   * 게임 위에 얹힌 것처럼 보이고, 키 입력이 대사 진행과 충돌한다. 결과 화면을
   * 따로 그리는 미니게임은 이 값을 보고 판을 멈춘 그림(정지 화면)으로 바꾼다.
   */
  stage?: "play" | "result";
  /**
   * 판이 끝나 결과가 확정됐음을 알린다. onComplete보다 먼저 부른다.
   *
   * 승부가 난 뒤에도 연출(파티클, 마지막 타구, 결과 자세)을 보여주느라 onComplete가
   * 수백 ms~2초 뒤에 나가는 미니게임이 있다. 그 사이에 딤드 영역을 잘못 누르면
   * 호스트가 "아직 minigame 단계"로 보고 취소해 버려서, 다 이긴 판이 수집도 안 된 채
   * 사라졌다. 이걸 부르면 호스트가 바깥 클릭과 Esc를 막는다.
   *
   * 연출 없이 즉시 onComplete를 부르는 미니게임은 부를 필요가 없다.
   */
  onSettled?: () => void;
}

/**
 * How the minigame renders. "canvas" mounts inside the r3f <Canvas> of the
 * current scene; "overlay" mounts as a DOM layer above it. A minigame is one
 * or the other, never both.
 */
export type MinigameMode = "canvas" | "overlay";

/**
 * 화면에 어떻게 얹히는가.
 *
 * "panel"은 제목·조작법·스킵이 달린 미니게임 카드다. "bare"는 그 껍데기 없이
 * 오브젝트만 떠오른다. 방탈출처럼 "물건을 집어서 들여다보는" 인터랙션은
 * 시작 카드도 패널도 없어야 게임이 아니라 탐색으로 읽힌다.
 */
export type MinigamePresentation = "panel" | "bare";

export interface MinigameDefinition {
  id: string;
  mode: MinigameMode;
  /** 기본값 "panel". */
  presentation?: MinigamePresentation;
  /** Component registered in src/minigames/index.ts. */
  component: React.ComponentType<MinigameProps>;
  /** 시작 카드(게임 마운트 전)에 보여줄 제목/조작법 키. */
  titleKey: CommonTextKey;
  helpKey: CommonTextKey;
  /**
   * 시작 카드에서 조작법 아래에 한 줄씩 펼쳐 보여줄 플레이 방법.
   *
   * 한 줄 요약(helpKey)으로 규칙이 다 서는 게임은 비워 둔다. 그런 게임에 목록을
   * 붙이면 집는 데 3초 걸릴 인터랙션이 설명서를 읽는 일이 된다. 상성·페인트처럼
   * 모르면 첫 판을 통째로 버리게 되는 규칙이 있는 게임만 채운다.
   * 조작 안내와 같은 잣대로 `_touch` 변형이 있으면 그쪽이 쓰인다.
   */
  rulesKeys?: readonly CommonTextKey[];
  /**
   * 실패 결과 카드에 실을 한 줄 (캐릭터 톤). 비우면 공통 문구(minigame.result.failDefault).
   * 실패가 없는 미니게임(탐색형)은 채울 이유가 없다.
   */
  failKey?: CommonTextKey;
  /**
   * 판이 도는 동안 방 곡 대신 틀 루프 (src/lib/assets.ts의 경로).
   *
   * 화면 속 세계(게임기)처럼 방 밖의 소리가 나는 판만 채운다. 방 안에서 하는 일은
   * 방 곡이 눌린 채 계속 흐르는 게 맞다. 이 곡은 밝기 곡선을 받지 않는다: 가라앉는
   * 방과 멀쩡한 게임 소리의 대비가 곧 "외면"이다.
   */
  music?: string;
}
