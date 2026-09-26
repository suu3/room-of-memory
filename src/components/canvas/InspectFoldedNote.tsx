"use client";

import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { type Group, MeshStandardMaterial, PlaneGeometry } from "three";
import type { RoomPalette } from "@/scenes/memory-room/palette";
import type { FoldedNoteInspectObject } from "./InspectTurntable";
import { clampUnfoldDrag, ReadTimer, SHADOW_GAP, unfoldFromDrag, ZOOM_DAMP } from "./inspect-math";
import { canvasSize, type InspectFace, useFaceTexture } from "./inspect-textures";

/** 펼침이 이만큼 되면 안쪽을 읽은 것으로 친다. */
const OPEN_READ = 0.85;
/** 접힌 종이가 손을 따라오는 빠르기. 너무 빠르면 종이가 아니라 스위치다. */
const OPEN_DAMP = 10;
/** 윗반과 아랫반이 겹칠 때 서로 파고들지 않게 띄우는 거리 (월드). */
const LAYER = 0.004;

/** 종이의 위쪽 반 또는 아래쪽 반. uv를 그 반쪽으로 잘라 한 그림을 둘이 나눠 붙인다. */
function halfSheet(width: number, height: number, half: "top" | "bottom"): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height / 2);
  const uv = geometry.getAttribute("uv");
  const offset = half === "top" ? 0.5 : 0;
  for (let index = 0; index < uv.count; index++) {
    uv.setY(index, offset + uv.getY(index) * 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * 반으로 접힌 쪽지 (InspectTurntable의 `folded-note`).
 *
 * 아랫반은 바닥에 놓여 있고, 윗반은 접힌 자국(y=0)을 축으로 그 위에 엎어져 있다. 위로
 * 끌면(dragY 음수) 윗반이 일어나 펴진다. 겉은 빈 종이, 안쪽은 메모다. 돌려 봐도 되지만
 * (yaw) 뒷면에는 아무것도 없다: 이 물건의 답은 뒤가 아니라 안이다.
 */
export function InspectFoldedNote({
  object,
  yawRef,
  zoomRef,
  dragYRef,
  onFound,
  palette,
  font,
}: {
  object: FoldedNoteInspectObject;
  yawRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  dragYRef: MutableRefObject<number>;
  onFound: () => void;
  palette: RoomPalette;
  font: string;
}) {
  const groupRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const flapRef = useRef<Group>(null);
  const openRef = useRef(0);
  const readRef = useRef(new ReadTimer());
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const [width, height, depth] = object.size;

  const size = useMemo(() => canvasSize(width, height), [width, height]);
  const memoFace = useMemo<InspectFace>(() => ({ paint: object.memo }), [object.memo]);
  const paperFace = useMemo<InspectFace>(() => ({ paint: object.paper }), [object.paper]);
  const memo = useFaceTexture(memoFace, size, palette, font);
  const paper = useFaceTexture(paperFace, size, palette, font);

  const geometry = useMemo(
    () => ({ top: halfSheet(width, height, "top"), bottom: halfSheet(width, height, "bottom") }),
    [width, height],
  );
  useEffect(
    () => () => {
      geometry.top.dispose();
      geometry.bottom.dispose();
    },
    [geometry],
  );
  const materials = useMemo(
    () => ({
      memo: new MeshStandardMaterial({ map: memo, roughness: 0.8 }),
      paper: new MeshStandardMaterial({ map: paper, roughness: 0.85 }),
    }),
    [memo, paper],
  );
  useEffect(
    () => () => {
      materials.memo.dispose();
      materials.paper.dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const frame = frameRef.current;
    const flap = flapRef.current;
    if (!group || !frame || !flap) return;
    const ease = 1 - Math.exp(-ZOOM_DAMP * delta);
    frame.scale.setScalar(frame.scale.x + (zoomRef.current - frame.scale.x) * ease);
    group.rotation.y = yawRef.current;

    dragYRef.current = clampUnfoldDrag(dragYRef.current);
    const wanted = unfoldFromDrag(dragYRef.current);
    openRef.current += (wanted - openRef.current) * (1 - Math.exp(-OPEN_DAMP * delta));
    // 접힌 상태가 π(엎어짐), 펼친 상태가 0
    flap.rotation.x = Math.PI * (1 - openRef.current);
    if (readRef.current.tick(openRef.current > OPEN_READ, delta)) onFoundRef.current();
  });

  return (
    <group ref={frameRef}>
      {/* 접힌 채로 화면 가운데 오도록 종이를 반쪽만큼 올린다. 펼치면 위로 자란다 */}
      <ContactShadows
        position={[0, -height / 4 - SHADOW_GAP, 0]}
        opacity={0.7}
        scale={width * 2.6}
        blur={2.4}
        far={height / 2}
      />
      <group ref={groupRef} position={[0, height / 4, 0]}>
        {/* 아랫반: 안쪽(메모의 아랫부분)이 앞, 겉(빈 종이)이 뒤 */}
        <mesh geometry={geometry.bottom} material={materials.memo} position={[0, -height / 4, 0]} />
        <mesh
          geometry={geometry.bottom}
          material={materials.paper}
          position={[0, -height / 4, -depth]}
          rotation={[0, Math.PI, 0]}
        />
        {/*
          윗반: 접힌 자국(y=0)에 매달린 그룹. 엎어지면(π) 국소 z가 뒤집혀 아랫반 앞에 놓이고,
          그때 카메라를 보는 것은 겉면이다. 펼치면 안쪽이 앞으로 온다.
        */}
        <group ref={flapRef}>
          <mesh
            geometry={geometry.top}
            material={materials.memo}
            position={[0, height / 4, -LAYER]}
          />
          <mesh
            geometry={geometry.top}
            material={materials.paper}
            position={[0, height / 4, -LAYER - depth]}
            rotation={[0, Math.PI, 0]}
          />
        </group>
      </group>
    </group>
  );
}
