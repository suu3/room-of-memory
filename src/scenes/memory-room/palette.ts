/**
 * 씬이 쓰는 색. 전부 `globals.css`의 `--color-scene-*` 토큰에서 읽는다
 * (DESIGN.md > Colors > 3D 재질 팔레트).
 *
 * UI 토큰(ink·paper·ivory…)은 여기 없다 — 재질색은 조명과 톤매핑을 거쳐 화면에 닿아
 * UI 색과 같은 값을 공유하면 어느 한쪽이 틀어진다. 예외는 `memory`(기억 글로우·창빛의
 * 시그니처 앰버)와 `ember`(라디오 신호등) 두 광원색뿐이다.
 */
export interface RoomPalette {
  /** 기억 글로우·표식·창빛. UI의 앰버와 같은 토큰을 읽는다 — 시그니처 컬러라서. */
  memory: string;
  /** 라디오 신호등 — 재질이 아니라 빛이다. */
  ember: string;

  /* ── 재질 ── */
  /** 벽 (깊은 네이비) */
  wall: string;
  /** 포스터를 떼어낸 자국 — 벽보다 한 톤 밝다 */
  wallFaded: string;
  /** 바닥 (벽보다 밝은 슬레이트) */
  floor: string;
  /** 책상·의자·선반·침대 프레임 */
  wood: string;
  /** 가구 다리·문짝·기기 몸통 */
  frame: string;
  /** 침구·커튼·쿠션 */
  fabric: string;
  /** 러그 위 방석·베개·종이·사진 */
  linen: string;
  /** 걸레받이·창틀·손잡이 */
  trim: string;
  /** 앰버 — 트로피, 문 손잡이 */
  amber: string;
  /** 테라코타 — 달력 띠·안테나·실밥·운동화 */
  clay: string;
  /** 세이지 — 포스터 색면·수납상자·가방 */
  sage: string;

  /* ── 어둠 (창밖·받침·꺼진 화면) ── */
  storm: string;
  abyss: string;
  coal: string;
  deep: string;
  void: string;

  /* ── 광원 ── */
  /** 차가운 간접광 */
  daylight: string;
  /** 창으로 드는 볕 */
  sun: string;
}

const TOKEN_BY_KEY = {
  memory: "--color-memory",
  ember: "--color-ember",
  wall: "--color-scene-wall",
  wallFaded: "--color-scene-wall-faded",
  floor: "--color-scene-floor",
  wood: "--color-scene-wood",
  frame: "--color-scene-frame",
  fabric: "--color-scene-fabric",
  linen: "--color-scene-linen",
  trim: "--color-scene-trim",
  amber: "--color-scene-amber",
  clay: "--color-scene-clay",
  sage: "--color-scene-sage",
  storm: "--color-scene-storm",
  abyss: "--color-scene-abyss",
  coal: "--color-scene-coal",
  deep: "--color-scene-deep",
  void: "--color-scene-void",
  daylight: "--color-scene-daylight",
  sun: "--color-scene-sun",
} as const satisfies Record<keyof RoomPalette, string>;

/**
 * globals.css의 값을 그대로 옮긴 폴백. 개발 서버에서 CSS 청크가 캔버스보다 늦게 붙으면
 * 토큰이 빈 문자열로 읽히고, 그 값을 받은 캔버스 그라디언트(addColorStop)가 던져서
 * 방이 통째로 사라졌다. 토큰이 비어 있을 때만 쓰고, 값을 바꿀 때는 CSS와 같이 고친다.
 */
const FALLBACK: Record<keyof RoomPalette, string> = {
  memory: "#d5ae78",
  ember: "#b8655a",
  wall: "#34465e",
  wallFaded: "#3d5069",
  floor: "#626c7d",
  wood: "#998572",
  frame: "#354052",
  fabric: "#6c809e",
  linen: "#bab4a7",
  trim: "#a4a6a1",
  amber: "#bc9363",
  clay: "#a57565",
  sage: "#809289",
  storm: "#2a3d48",
  abyss: "#121c24",
  coal: "#17202a",
  deep: "#0f181e",
  void: "#060a10",
  daylight: "#c4d0de",
  sun: "#f3c98e",
};

export function resolveRoomPalette(): RoomPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (key: keyof RoomPalette) => {
    const value = styles.getPropertyValue(TOKEN_BY_KEY[key]).trim();
    if (value !== "") return value;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `씬 팔레트 토큰 ${TOKEN_BY_KEY[key]}이 비어 있어 폴백을 쓴다 — CSS가 아직 안 붙었는가?`,
      );
    }
    return FALLBACK[key];
  };

  return Object.fromEntries(
    (Object.keys(TOKEN_BY_KEY) as (keyof RoomPalette)[]).map((key) => [key, read(key)]),
  ) as Record<keyof RoomPalette, string>;
}
