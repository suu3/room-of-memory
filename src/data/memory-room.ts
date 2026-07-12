export interface MemoryItem {
  id: string;
  name: string;
  /** 씬 프레임 기준 핫스팟 위치 (%) */
  x: string;
  y: string;
  summary: string;
  /** 24x24 stroke 아이콘의 path d */
  iconPath: string;
}

export const MEMORIES: MemoryItem[] = [
  {
    id: "bat",
    name: "배트",
    x: "13%",
    y: "72%",
    summary: "3년을 함께 휘두른 배트",
    iconPath: "M4.5 19.5 14.5 9.5M14.5 9.5 19 3.8 20.4 5.2 14.5 9.5M3.6 17.2 6.8 20.4",
  },
  {
    id: "window",
    name: "창문",
    x: "80%",
    y: "30%",
    summary: "커튼 틈, 텅 빈 운동장",
    iconPath: "M4.8 3.8h14.4v16.4H4.8zM12 3.8v16.4M4.8 12h14.4",
  },
  {
    id: "radio",
    name: "라디오",
    x: "64%",
    y: "58%",
    summary: "매일 같은 생존 안내 방송",
    iconPath:
      "M3.6 9.4h16.8a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1v-8.2a1 1 0 0 1 1-1zM6.4 9.4 17 4.2M11.8 14.5a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0M14.8 12.8h3.6M14.8 16h3.6",
  },
  {
    id: "phone",
    name: "스마트폰",
    x: "44%",
    y: "69%",
    summary: "3월에 멈춘 단체 채팅방",
    iconPath:
      "M8 2.8h8a1.4 1.4 0 0 1 1.4 1.4v15.6A1.4 1.4 0 0 1 16 21.2H8a1.4 1.4 0 0 1-1.4-1.4V4.2A1.4 1.4 0 0 1 8 2.8zM10.6 18.2h2.8",
  },
  {
    id: "calendar",
    name: "달력",
    x: "55%",
    y: "22%",
    summary: "결승전 날짜에서 멈춤",
    iconPath:
      "M5 5.6h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1zM4 10h16M8.4 3.2v4M15.6 3.2v4M16.1 14.4a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0",
  },
  {
    id: "ball",
    name: "사인볼",
    x: "28%",
    y: "58%",
    summary: "마지막 연습 시합의 공",
    iconPath:
      "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M7.2 5.4c2.4 2.6 2.4 10.6 0 13.2M16.8 5.4c-2.4 2.6-2.4 10.6 0 13.2",
  },
];

export const MEMORY_GOAL = MEMORIES.length;

export interface RoomStage {
  id: string;
  monologue: string;
  dialogueLine: string;
  /** 방 배경 라디얼 그라디언트 (씬 라이팅 램프 토큰만 사용) */
  background: string;
  beamWidth: number;
  beamOpacity: number;
  washOpacity: number;
  vignetteOpacity: number;
}

/** 수집 개수 0~2 / 3~4 / 5~6에 대응하는 방의 밝기 3단계 */
export const ROOM_STAGES: RoomStage[] = [
  {
    id: "dark",
    monologue: "……오늘이, 며칠이더라.",
    dialogueLine: "방이 너무 조용해. 반짝이는 것들이… 나를 부르는 것 같아.",
    background:
      "radial-gradient(120% 90% at 50% 34%, var(--color-scene-slate) 0%, var(--color-scene-mist) 45%, var(--color-scene-deep) 100%)",
    beamWidth: 54,
    beamOpacity: 0.5,
    washOpacity: 0,
    vignetteOpacity: 0.75,
  },
  {
    id: "dim",
    monologue: "조금씩… 생각나기 시작했어.",
    dialogueLine: "이 방, 원래 이렇게 어둡지 않았어. 커튼 너머가… 궁금해졌어.",
    background:
      "radial-gradient(120% 90% at 55% 32%, var(--color-scene-storm) 0%, var(--color-scene-slate) 48%, var(--color-scene-abyss) 100%)",
    beamWidth: 150,
    beamOpacity: 0.7,
    washOpacity: 0.35,
    vignetteOpacity: 0.6,
  },
  {
    id: "gold",
    monologue: "가자. 9회말은, 지금부터야.",
    dialogueLine: "전부 기억났어. 배트 챙기고, 글러브도. …문을 열 시간이야.",
    background:
      "radial-gradient(120% 95% at 58% 30%, var(--color-scene-olive) 0%, var(--color-scene-dusk) 46%, var(--color-scene-coal) 100%)",
    beamWidth: 260,
    beamOpacity: 0.9,
    washOpacity: 1,
    vignetteOpacity: 0.42,
  },
];

export function stageIndexFromCount(count: number): number {
  if (count <= 2) return 0;
  if (count <= 4) return 1;
  return 2;
}
