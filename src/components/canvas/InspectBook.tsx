"use client";

import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { type Group, MeshStandardMaterial, PlaneGeometry } from "three";
import type { RoomPalette } from "@/scenes/memory-room/palette";
import type { BookInspectObject } from "./InspectTurntable";
import { pageShowing, ReadTimer, SHADOW_GAP, ZOOM_DAMP } from "./inspect-math";
import { canvasSize, useFaceTextures } from "./inspect-textures";

/** 쪽 그림의 해상도. 열 장을 한꺼번에 굽는다: 손글씨 한 줄이면 512로 족하다. */
const PAGE_RESOLUTION = 512;
/** 낱장이 넘어가는 빠르기. */
const FLIP_DAMP = 9;
/** 넘어가는 중인 장이 이보다 덜 남았으면 다 넘어간 것으로 친다 (rad). */
const SETTLED = 0.03;
/** 겹쳐 놓인 낱장 사이의 틈 (월드). 위 장이 아래 장에 파고들지 않을 만큼만. */
const SHEET_GAP = 0.0016;
/** 뒤표지가 쪽보다 이만큼 크다. */
const COVER_MARGIN = 0.02;

/**
 * 장을 넘기는 책 (InspectTurntable의 `book`).
 *
 * 책등(x=0)을 축으로 낱장들이 매달려 있다. `pageRef`가 넘긴 장 수다: 그보다 앞의 장은
 * 왼쪽(-π)에, 나머지는 오른쪽(0)에 눕는다. 0번 낱장이 앞표지라 처음엔 덮여 있고, 한 장
 * 넘기면 펼쳐진다. 뒤표지는 넘어가지 않는 판이다. 찾을 쪽이 보이는 채로 장이 다 눕고
 * 잠깐 지나면 읽은 것으로 친다.
 */
export function InspectBook({
  object,
  zoomRef,
  pageRef,
  onFound,
  palette,
  font,
}: {
  object: BookInspectObject;
  zoomRef: MutableRefObject<number>;
  pageRef?: MutableRefObject<number>;
  onFound: () => void;
  palette: RoomPalette;
  font: string;
}) {
  const frameRef = useRef<Group>(null);
  const sheetRefs = useRef<(Group | null)[]>([]);
  const readRef = useRef(new ReadTimer());
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const [pageWidth, pageHeight, thickness] = object.size;
  const sheets = object.pages.length / 2;
  const showingAt = pageShowing(object.target);

  const size = useMemo(
    () => canvasSize(pageWidth, pageHeight, PAGE_RESOLUTION),
    [pageWidth, pageHeight],
  );
  const textures = useFaceTextures(object.pages, size, palette, font);
  const materials = useMemo(
    () => textures.map((texture) => new MeshStandardMaterial({ map: texture, roughness: 0.9 })),
    [textures],
  );
  const coverMaterials = useMemo(() => {
    const board = new MeshStandardMaterial({ color: palette[object.cover], roughness: 0.8 });
    const inside = new MeshStandardMaterial({ color: palette.linen, roughness: 0.9 });
    // BoxGeometry의 면 순서: +x, -x, +y, -y, +z(안쪽 면지), -z(겉)
    return { board, inside, box: [board, board, board, board, inside, board] };
  }, [palette, object.cover]);
  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
      coverMaterials.board.dispose();
      coverMaterials.inside.dispose();
    },
    [materials, coverMaterials],
  );
  const page = useMemo(() => new PlaneGeometry(pageWidth, pageHeight), [pageWidth, pageHeight]);
  useEffect(() => () => page.dispose(), [page]);

  useFrame((_, delta) => {
    const frame = frameRef.current;
    if (!frame) return;
    const ease = 1 - Math.exp(-ZOOM_DAMP * delta);
    frame.scale.setScalar(frame.scale.x + (zoomRef.current - frame.scale.x) * ease);

    const turned = pageRef?.current ?? 0;
    const flipEase = 1 - Math.exp(-FLIP_DAMP * delta);
    let settled = true;
    sheetRefs.current.forEach((sheet, index) => {
      if (!sheet) return;
      const target = index < turned ? -Math.PI : 0;
      sheet.rotation.y += (target - sheet.rotation.y) * flipEase;
      if (Math.abs(target - sheet.rotation.y) > SETTLED) settled = false;
    });
    if (readRef.current.tick(settled && turned === showingAt, delta)) onFoundRef.current();
  });

  const boardWidth = pageWidth + COVER_MARGIN;
  const boardHeight = pageHeight + COVER_MARGIN;
  return (
    <group ref={frameRef}>
      <ContactShadows
        position={[0, -boardHeight / 2 - SHADOW_GAP, 0]}
        opacity={0.7}
        scale={boardWidth * 3}
        blur={2.4}
        far={boardHeight}
      />
      {/* 뒤표지: 오른쪽에 고정된 판. 낱장이 다 넘어가면 그 면지가 남는다 */}
      <mesh material={coverMaterials.box} position={[boardWidth / 2, 0, -thickness / 2]}>
        <boxGeometry args={[boardWidth, boardHeight, thickness]} />
      </mesh>
      {/* 책등 */}
      <mesh material={coverMaterials.board} position={[0, 0, -thickness / 2]}>
        <boxGeometry args={[thickness * 0.6, boardHeight, thickness]} />
      </mesh>
      {/*
        낱장: 책등에 매달린 그룹마다 앞면과 뒷면 한 장씩. 위에 있을 장일수록 z가 크고,
        -π로 넘어가면 국소 z가 뒤집혀 왼쪽에서는 늦게 넘긴 장이 위에 놓인다.
      */}
      {Array.from({ length: sheets }, (_, index) => {
        const z = (sheets - index) * SHEET_GAP + 0.002;
        return (
          <group
            // biome-ignore lint/suspicious/noArrayIndexKey: 낱장은 자리 그 자체라 인덱스가 곧 정체성이다.
            key={index}
            ref={(node) => {
              sheetRefs.current[index] = node;
            }}
          >
            <mesh
              geometry={page}
              material={materials[index * 2]}
              position={[pageWidth / 2, 0, z]}
            />
            <mesh
              geometry={page}
              material={materials[index * 2 + 1]}
              position={[pageWidth / 2, 0, z - 0.0004]}
              rotation={[0, Math.PI, 0]}
            />
          </group>
        );
      })}
    </group>
  );
}
