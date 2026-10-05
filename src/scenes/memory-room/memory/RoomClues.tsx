"use client";

import type { ReactNode } from "react";
import type { ClueId } from "@/data/room-clues";
import { playSound } from "@/lib/audio";
import {
  clueUnlocked,
  selectDrawerCodeRead,
  selectOnboardingStep,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { MemoryGlowSelection } from "../effects/MemoryOutlineGlow";
import { MirrorReflection } from "../effects/MirrorReflection";
import { useGlowHover } from "../effects/use-glow-hover";
import { useNearPlayer } from "../player/use-near-player";
import { CLUE_PROPS, MIRROR_PLACEMENT } from "../world/layout";
import type { RoomPalette } from "../world/palette";
import { useSideCue } from "./side-cue";

/**
 * 들여다볼 수 있는 종이 한 장. 기억도 트리거도 아닌 배경 오브젝트라 표식(마름모·
 * 고리)을 달지 않고, 전등 스위치와 같은 곁가지 등급 글로우만 준다. 진행에 끼지
 * 않는 물건이 이야기인 척하면 금빛 비중이 진행과 무관하게 차 버린다 (DESIGN.md).
 *
 * 누르면 스토어에 열린 단서를 적고, Canvas 밖의 ClueOverlay가 그걸 보고 펼친다.
 */
export function ClueProp({
  clue,
  /** 다가왔는지 재는 기준점 (월드 x·z). */
  near,
  radius,
  enabled = true,
  beckon = false,
  children,
}: {
  clue: ClueId;
  near: readonly [number, number];
  radius: number;
  /** false면 만질 수도 빛날 수도 없다 (아빠 메일을 읽기 전의 선반 책). */
  enabled?: boolean;
  /**
   * 가까이 가지 않아도 기억처럼 금빛으로 부른다. 조사가 가리키는 다음 자리(아빠 메일 뒤의
   * 거꾸로 꽂힌 책)에만 준다. 찾고 나면 부르는 쪽이 끈다.
   */
  beckon?: boolean;
  children: ReactNode;
}) {
  const openClue = useMemoryRoomStore((state) => state.openClue);
  // 1인칭 구간에서는 어떤 단서도 만질 수 없다. 어둠 속에서 빛나는 건 스위치뿐이어야 한다
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const active = enabled && !firstPerson;
  const { hovered, handlers } = useGlowHover(active);
  const nearPlayer = useNearPlayer(near[0], near[1], radius);
  const cue = useSideCue();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name={`clue-${clue}`}
      {...handlers}
      onClick={(event) => {
        if (!active) return;
        // 뒤에 있는 책상·서랍 몸통까지 같이 눌리면 안 된다
        event.stopPropagation();
        playSound("open");
        openClue(clue);
      }}
    >
      <MemoryGlowSelection
        selectionKey={`clue-${clue}`}
        tier={beckon ? "memory" : "prop"}
        enabled={active && (beckon || cue || hovered || nearPlayer)}
      >
        {children}
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 눌러 볼 수 있는 물건: 단서처럼 화면을 펼치지 않고 누르는 쪽(onPress)이 할 일을 정한다.
 * 칫솔컵(혼잣말 한 줄)·협탁 서랍(혼잣말 또는 자물쇠)이 쓴다. 곁가지 등급 글로우,
 * 다가가면 켜진다는 문법은 ClueProp과 같다. `beckon`이면 기억처럼 금빛으로 부른다.
 */
export function TouchProp({
  name,
  near,
  radius,
  enabled = true,
  beckon = false,
  onPress,
  children,
}: {
  name: string;
  near: readonly [number, number];
  radius: number;
  enabled?: boolean;
  /** 가까이 가지 않아도 금빛으로 부른다 (번호를 안 뒤의 협탁 서랍). */
  beckon?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  const active = enabled && !firstPerson;
  const { hovered, handlers } = useGlowHover(active);
  const nearPlayer = useNearPlayer(near[0], near[1], radius);
  const cue = useSideCue();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name={`prop-${name}`}
      {...handlers}
      onClick={(event) => {
        if (!active) return;
        event.stopPropagation();
        onPress();
      }}
    >
      <MemoryGlowSelection
        selectionKey={`prop-${name}`}
        tier={beckon ? "memory" : "prop"}
        enabled={active && (beckon || cue || hovered || nearPlayer)}
      >
        {children}
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 원래 있던 장식을 그대로 단서로 쓰는 자리: 선반의 책 한 권. 3페이즈 서랍 자물쇠 번호(쪽지의 세 자리)를
 * 든다 (src/data/room-clues.ts).
 *
 * 새 도형을 만들지 않고 children으로 받는다. 이 책은 이미 방에 놓여 있고,
 * 여기서 다시 그리면 같은 책이 두 권 서게 된다.
 */
export function ShelfBookClue({ children }: { children: ReactNode }) {
  // 아빠 메일("선반 정리 좀 해라.")을 읽기 전에는 그냥 선반의 책이다. 읽은 뒤에는 "11"을
  // 찾을 때까지 금빛으로 부른다 (v4.1 3장: 메일 → 선반 금빛 → 책)
  const unlocked = useMemoryRoomStore((state) => clueUnlocked(state, "shelf-book"));
  const found = useMemoryRoomStore(selectDrawerCodeRead);
  return (
    <ClueProp
      clue="shelf-book"
      near={CLUE_PROPS.shelfBook.near}
      radius={CLUE_PROPS.shelfBook.interactionRadius}
      enabled={unlocked}
      beckon={unlocked && !found}
    >
      {children}
    </ClueProp>
  );
}

/**
 * 책상 위 문제집 더미. 집어 들면 화면 가운데에서 돌려볼 수 있고, 뒤표지에 이름이
 * 적혀 있다 (src/data/room-clues.ts의 DISCOVERY_IDS). 앞면만 보고 내려놓으면 모른다.
 *
 * 불을 켠 직후에는 이것만 금빛으로 부른다 (store의 onboardingStep). 돌려 보는 조작을
 * 처음 배우는 자리라 기억보다 먼저 온다. 이름을 찾으면 부르기를 끈다.
 */
export function WorkbookClue({ children }: { children: ReactNode }) {
  const first = useMemoryRoomStore(selectOnboardingStep) === "workbook";
  return (
    <ClueProp
      clue="workbook"
      near={CLUE_PROPS.workbook.near}
      radius={CLUE_PROPS.workbook.interactionRadius}
      beckon={first}
    >
      {children}
    </ClueProp>
  );
}

/**
 * 문 쪽 왼벽의 전신거울. 누르면 거울 속 자기를 돌려보는 화면이 뜬다 (ClueOverlay).
 *
 * 유리는 시점과 상관없이 늘 비춘다 (MirrorReflection). 씬을 한 번 더 그리는 반사라
 * 3인칭에서는 두 프레임에 한 번만 다시 그려 값을 줄이고, 1인칭에서는 얼굴을 들이대는
 * 자리라 매 프레임 그린다. 벽에 붙은 물건이라 RoomShell의 왼벽(CulledWall) 안에 선다.
 */
export function MirrorClue({ palette }: { palette: RoomPalette }) {
  const { frameSize, glassSize, lean } = MIRROR_PLACEMENT;
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;
  return (
    <ClueProp
      clue="mirror"
      near={MIRROR_PLACEMENT.near}
      radius={MIRROR_PLACEMENT.interactionRadius}
    >
      {/* 바깥 그룹은 거울이 **선 자리**(밑동). 로컬 +z가 방 안쪽(월드 +x)을 본다 */}
      <group position={MIRROR_PLACEMENT.position} rotation={MIRROR_PLACEMENT.rotation}>
        {/*
          밑동을 축으로 뒤로 눕힌다. 축이 밑동에 있어야 발이 바닥에 붙은 채 윗변만
          벽으로 간다. 거울 한가운데를 축으로 돌리면 발이 바닥을 파고든다.
        */}
        <group rotation={[-lean, 0, 0]}>
          <mesh position={[0, frameSize[1] / 2, frameSize[2] / 2]} castShadow>
            <boxGeometry args={frameSize} />
            <meshStandardMaterial color={palette.wood} roughness={0.55} />
          </mesh>
          <group position={[0, frameSize[1] / 2, frameSize[2] + glassSize[2] / 2]}>
            <MirrorReflection
              width={glassSize[0]}
              height={glassSize[1]}
              offset={glassSize[2] / 2}
              palette={palette}
              firstPerson={firstPerson}
            />
          </group>
        </group>
      </group>
    </ClueProp>
  );
}
