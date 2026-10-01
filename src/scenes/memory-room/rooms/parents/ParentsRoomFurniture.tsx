"use client";

import { InteriorBox as Box, InteriorCylinder as Cylinder } from "../../shared/InteriorPrimitives";
import { PARENTS_COLLIDERS } from "../../world/layout";
import type { RoomPalette } from "../../world/palette";

const [bed, wardrobe, desk] = PARENTS_COLLIDERS;

function ParentsBed({ palette }: { palette: RoomPalette }) {
  const width = bed.maxX - bed.minX;
  const depth = bed.maxZ - bed.minZ;
  return (
    <group
      name="parents-upholstered-bed"
      position={[(bed.minX + bed.maxX) / 2, 0, (bed.minZ + bed.maxZ) / 2]}
    >
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}:${z}`}
            position={[x * (width / 2 - 0.27), 0.13, z * (depth / 2 - 0.28)]}
            size={[0.15, 0.25, 0.15]}
            color={palette.frame}
          />
        )),
      )}
      <Box
        position={[0.025, 0.3, 0]}
        size={[width - 0.15, 0.27, depth - 0.1]}
        color={palette.wood}
        radius={0.04}
      />
      <Box
        position={[0.04, 0.49, 0]}
        size={[width - 0.3, 0.23, depth - 0.25]}
        color={palette.linen}
        radius={0.085}
      />
      <Box
        position={[0.04, 0.616, 0]}
        size={[width - 0.33, 0.035, depth - 0.27]}
        color={palette.trim}
        radius={0.014}
      />
      <Box
        position={[0.04, 0.65, 0]}
        size={[width - 0.35, 0.065, depth - 0.28]}
        color={palette.linen}
        radius={0.025}
      />
      {/* Low wooden headboard and two upholstered inserts, clear of the wall face. */}
      <Box
        position={[-width / 2 + 0.19, 0.75, 0]}
        size={[0.15, 1.36, depth - 0.12]}
        color={palette.wood}
        radius={0.045}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[-width / 2 + 0.285, 1.02, side * 0.92]}
            size={[0.08, 0.63, 1.72]}
            color={palette.sage}
            radius={0.033}
          />
          <Box
            position={[-width / 2 + 0.66, 0.78, side * 0.91]}
            size={[0.66, 0.24, 1.27]}
            color={palette.linen}
            radius={0.1}
            rotation={[0, side * 0.045, 0]}
          />
          <Box
            position={[-width / 2 + 0.67, 0.791, side * 0.91]}
            size={[0.62, 0.218, 1.3]}
            color={palette.trim}
            radius={0.09}
            rotation={[0, side * 0.045, 0]}
          />
          <Box
            position={[-width / 2 + 0.66, 0.801, side * 0.91]}
            size={[0.62, 0.215, 1.25]}
            color={palette.linen}
            radius={0.09}
            rotation={[0, side * 0.045, 0]}
          />
        </group>
      ))}
      <Box
        position={[0.38, 0.752, 0]}
        size={[1.68, 0.18, depth - 0.25]}
        color={palette.fabric}
        radius={0.075}
      />
      <Box
        position={[-0.32, 0.862, 0]}
        size={[0.36, 0.08, depth - 0.22]}
        color={palette.trim}
        radius={0.035}
      />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          position={[0.43, 0.58, side * (depth / 2 - 0.085)]}
          size={[1.58, 0.38, 0.08]}
          color={palette.fabric}
          radius={0.035}
        />
      ))}
      {/* A folded throw at the foot gives the bedding a second textile weight. */}
      <Box
        position={[0.91, 0.87, 0]}
        size={[0.43, 0.075, depth - 0.2]}
        color={palette.sage}
        radius={0.03}
      />
      {[-1.7, -1.35, -1, -0.65, -0.3, 0.05, 0.4, 0.75, 1.1, 1.45, 1.7].map((z) => (
        <Box
          key={z}
          position={[0.91, 0.911, z]}
          size={[0.4, 0.008, 0.016]}
          color={palette.linen}
          radius={0.003}
        />
      ))}
    </group>
  );
}

function Wardrobe({ palette }: { palette: RoomPalette }) {
  const width = wardrobe.maxX - wardrobe.minX - 0.08;
  const depth = wardrobe.maxZ - wardrobe.minZ - 0.12;
  return (
    <group
      name="parents-paneled-wardrobe"
      position={[
        (wardrobe.minX + wardrobe.maxX) / 2,
        0,
        (wardrobe.minZ + wardrobe.maxZ) / 2 + 0.025,
      ]}
    >
      <Box position={[0, 0.1, 0]} size={[width - 0.14, 0.2, depth - 0.08]} color={palette.frame} />
      <Box
        position={[0, 1.4, -0.01]}
        size={[width - 0.08, 2.5, depth - 0.06]}
        color={palette.wood}
      />
      <Box position={[0, 2.69, 0]} size={[width, 0.1, depth]} color={palette.wood} />
      <Box position={[0, 0.26, 0]} size={[width, 0.1, depth]} color={palette.wood} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[(side * width) / 4, 1.48, depth / 2 - 0.008]}
            size={[width / 2 - 0.055, 2.3, 0.05]}
            color={palette.wood}
            radius={0.012}
          />
          <Box
            position={[(side * width) / 4, 1.63, depth / 2 + 0.022]}
            size={[width / 2 - 0.22, 1.76, 0.012]}
            color={palette.linen}
            radius={0.005}
          />
          <Box
            position={[(side * width) / 4, 1.63, depth / 2 + 0.033]}
            size={[width / 2 - 0.26, 1.72, 0.012]}
            color={palette.wood}
            radius={0.005}
          />
          <Box
            position={[side * 0.12, 1.48, depth / 2 + 0.055]}
            size={[0.032, 0.27, 0.035]}
            color={palette.amber}
            radius={0.012}
            metalness={0.65}
            roughness={0.3}
          />
          <Box
            position={[(side * width) / 4, 0.5, depth / 2 + 0.023]}
            size={[width / 2 - 0.22, 0.018, 0.017]}
            color={palette.frame}
            radius={0.006}
          />
        </group>
      ))}
    </group>
  );
}

function ResearchDesk({ palette }: { palette: RoomPalette }) {
  const width = desk.maxX - desk.minX;
  const depth = desk.maxZ - desk.minZ;
  return (
    <group
      name="parents-research-desk"
      position={[(desk.minX + desk.maxX) / 2, 0, (desk.minZ + desk.maxZ) / 2]}
    >
      <Box
        position={[0, 1.07, -0.03]}
        size={[width - 0.08, 0.1, depth - 0.1]}
        color={palette.wood}
        radius={0.035}
      />
      <Box
        position={[0, 0.92, 0.02]}
        size={[width - 0.23, 0.2, depth - 0.24]}
        color={palette.wood}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}:${z}`}
            position={[x * (width / 2 - 0.17), 0.51, z * (depth / 2 - 0.17)]}
            size={[0.105, 1.02, 0.105]}
            color={palette.wood}
          />
        )),
      )}
      {[-0.49, 0.49].map((x) => (
        <group key={x}>
          <Box
            position={[x, 0.93, -depth / 2 + 0.096]}
            size={[0.91, 0.16, 0.055]}
            color={palette.wood}
            radius={0.012}
          />
          <Box
            position={[x, 0.93, -depth / 2 + 0.06]}
            size={[0.2, 0.025, 0.035]}
            color={palette.amber}
            metalness={0.6}
          />
        </group>
      ))}
      <Box
        position={[-0.48, 1.128, -0.015]}
        size={[0.91, 0.012, 0.54]}
        color={palette.sage}
        radius={0.005}
      />
      {/* Desk lamp: weighted base, slender stem, tapered metal shade. No extra room light. */}
      <group position={[width / 2 - 0.35, 1.13, depth / 2 - 0.3]}>
        <Cylinder
          position={[0, 0.025, 0]}
          radius={0.15}
          height={0.04}
          color={palette.frame}
          metalness={0.5}
        />
        <Cylinder
          position={[0, 0.24, 0]}
          radius={0.022}
          height={0.43}
          color={palette.trim}
          metalness={0.7}
        />
        <Cylinder
          position={[0, 0.5, -0.07]}
          radius={0.2}
          topRadius={0.085}
          height={0.18}
          color={palette.sage}
          metalness={0.25}
        />
        <Cylinder
          position={[0, 0.405, -0.07]}
          radius={0.176}
          height={0.008}
          color={palette.linen}
        />
      </group>
      <Cylinder position={[0.27, 1.215, 0.07]} radius={0.065} height={0.17} color={palette.trim} />
      {[-0.027, 0.025].map((x) => (
        <Cylinder
          key={x}
          position={[0.27 + x, 1.35, 0.07]}
          radius={0.009}
          height={0.2}
          color={palette.frame}
          rotation={[0, 0, x * 3]}
        />
      ))}
      <Box
        position={[0.16, 1.139, -0.23]}
        size={[0.23, 0.016, 0.09]}
        color={palette.frame}
        radius={0.007}
        rotation={[0, -0.12, 0]}
      />
    </group>
  );
}

export function ParentsRoomFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="parents-room-furniture">
      <ParentsBed palette={palette} />
      <Wardrobe palette={palette} />
      <ResearchDesk palette={palette} />
    </group>
  );
}
