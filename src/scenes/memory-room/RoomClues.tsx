"use client";

import type { ReactNode } from "react";
import type { ClueId } from "@/data/room-clues";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CLUE_PROPS, DRAWER_NOTE } from "./layout";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

/** 쪽지에 그려 넣는 잉크 줄의 z 오프셋. 종이 한가운데를 비켜 위아래로 하나씩. */
const NOTE_INK_LINES: readonly number[] = [-0.035, 0.02];

/**
 * 들여다볼 수 있는 종이 한 장. 기억도 트리거도 아닌 배경 오브젝트라 표식(마름모·
 * 고리)을 달지 않고, 전등 스위치와 같은 곁가지 등급 글로우만 준다 — 진행에 끼지
 * 않는 물건이 이야기인 척하면 금빛 비중이 진행과 무관하게 차 버린다 (DESIGN.md).
 *
 * 누르면 스토어에 열린 단서를 적고, Canvas 밖의 ClueOverlay가 그걸 보고 펼친다.
 */
function ClueProp({
  clue,
  /** 다가왔는지 재는 기준점 (월드 x·z). */
  near,
  radius,
  enabled = true,
  children,
}: {
  clue: ClueId;
  near: readonly [number, number];
  radius: number;
  /** false면 만질 수도 빛날 수도 없다 (닫힌 서랍 속 쪽지). */
  enabled?: boolean;
  children: ReactNode;
}) {
  const openClue = useMemoryRoomStore((state) => state.openClue);
  const { hovered, handlers } = useGlowHover(enabled);
  const nearPlayer = useNearPlayer(near[0], near[1], radius);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name={`clue-${clue}`}
      {...handlers}
      onClick={(event) => {
        if (!enabled) return;
        // 뒤에 있는 책상·서랍 몸통까지 같이 눌리면 안 된다
        event.stopPropagation();
        playSound("open");
        openClue(clue);
      }}
    >
      <MemoryGlowSelection
        selectionKey={`clue-${clue}`}
        tier="prop"
        enabled={enabled && (hovered || nearPlayer)}
      >
        {children}
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 원래 있던 장식을 그대로 단서로 쓰는 자리들 — 선반의 책 한 권, 캐비닛 위 시계.
 *
 * 2바퀴 미궁 문제(카드·회전)의 규칙을 들고 있다. 문제 화면에는 규칙이 한 줄도
 * 없으므로, 방을 뒤진 사람만 그림을 읽을 수 있다 (src/data/room-clues.ts).
 *
 * 새 도형을 만들지 않고 children으로 받는다 — 이 물건들은 이미 방에 놓여 있고,
 * 여기서 다시 그리면 같은 책이 두 권 서게 된다.
 */
export function ShelfBookClue({ children }: { children: ReactNode }) {
  return (
    <ClueProp
      clue="shelf-book"
      near={CLUE_PROPS.shelfBook.near}
      radius={CLUE_PROPS.shelfBook.interactionRadius}
    >
      {children}
    </ClueProp>
  );
}

export function DeskClockClue({ children }: { children: ReactNode }) {
  return (
    <ClueProp
      clue="desk-clock"
      near={CLUE_PROPS.deskClock.near}
      radius={CLUE_PROPS.deskClock.interactionRadius}
    >
      {children}
    </ClueProp>
  );
}

/**
 * 협탁 서랍 속 접힌 쪽지. 서랍 부품과 같은 그룹에 있어 서랍과 함께 밀려 나온다.
 *
 * 닫혀 있는 동안에는 협탁 몸통 안에 완전히 잠겨 보이지 않는다 — 그래도 광선은
 * 몸통을 뚫고 들어오므로(r3f는 가려진 대상에도 클릭을 흘린다) `open`으로 한 번 더
 * 막는다. 안 막으면 닫힌 서랍을 눌렀을 때 쪽지가 먼저 열린다.
 *
 * 좌표는 서랍 부품과 같은 월드 프레임(닫힌 상태 기준)이다.
 */
export function DrawerNoteClue({ palette, open }: { palette: RoomPalette; open: boolean }) {
  return (
    <ClueProp
      clue="drawer-note"
      near={DRAWER_NOTE.near}
      radius={DRAWER_NOTE.interactionRadius}
      enabled={open}
    >
      <group position={DRAWER_NOTE.position} rotation={DRAWER_NOTE.rotation}>
        <mesh castShadow>
          <boxGeometry args={DRAWER_NOTE.size} />
          <meshStandardMaterial color={palette.linen} roughness={0.9} />
        </mesh>
        {/* 적힌 글씨 대신 잉크 두 줄 — 이게 없으면 흰 조각으로만 읽힌다 */}
        {NOTE_INK_LINES.map((offsetZ) => (
          <mesh key={offsetZ} position={[0, DRAWER_NOTE.size[1] / 2 + 0.002, offsetZ]}>
            <boxGeometry args={[DRAWER_NOTE.size[0] * 0.62, 0.002, 0.012]} />
            <meshStandardMaterial color={palette.frame} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </ClueProp>
  );
}
