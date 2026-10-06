// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AnimationMixer, Box3, Raycaster, type SkinnedMesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { createPlayerRig, disposePlayerRig, updatePlayerRig } from "./player-animation";
import {
  PLAYER_TARGET_HEIGHT,
  SIT_CONTACT_Y,
  SIT_CONTACT_Z,
  SIT_LEG_Z,
  SIT_TORSO_HALF_WIDTH,
} from "./player-rig";

const bytes = readFileSync(resolve("public/assets/models/player-blocky.glb"));
const jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

describe("shipped player GLB", () => {
  it("ships the decimated Tripo chibi mesh with lightweight eyelids", () => {
    // 원본 190만 삼각형을 줄이고, 빠진 소매·옆구리 면과 밀착 밴드·눈꺼풀을 포함한다.
    const triangles = asset.meshes.reduce(
      (total: number, mesh: { primitives: { indices: number }[] }) =>
        total +
        mesh.primitives.reduce(
          (sum, primitive) => sum + asset.accessors[primitive.indices].count / 3,
          0,
        ),
      0,
    );
    expect(triangles).toBeGreaterThan(30_000);
    expect(triangles).toBeLessThan(60_000);
  });
  it("embeds the skin image and required clips without external texture paths", () => {
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
    expect(asset.extensionsRequired).toContain("EXT_meshopt_compression");
    expect(asset.animations.map((clip: { name: string }) => clip.name).sort()).toEqual([
      "Idle",
      "Sit",
      "SitDown",
      "StandUp",
      "Walk",
    ]);
    /*
     * 이미지는 이름이 아니라 **모양**으로 확인한다. 블렌더에서 다시 내보낼 때마다 이미지
     * 이름이 바뀌는데(CH1.FACE → CH1 …), 정작 지켜야 하는 건 "밖으로 나간 경로 없이
     * 파일 안에 webp로 들어 있는가"다. 외부 경로가 하나라도 남으면 그 텍스처는 배포에서
     * 404가 되고 모델이 흰 판으로 뜬다.
     */
    expect(asset.images.length).toBeGreaterThan(0);
    for (const image of asset.images as {
      name: string;
      uri?: string;
      bufferView?: number;
      mimeType?: string;
    }[]) {
      expect(image.uri, image.name).toBeUndefined();
      expect(image.bufferView, image.name).toBeTypeOf("number");
      expect(image.mimeType, image.name).toBe("image/webp");
    }
    // 색을 입은 면이 실제로 그 이미지를 가리키는가 (webp는 확장으로 붙는다)
    const baseColor = (
      asset.materials as { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
    )
      .map((entry) => entry.pbrMetallicRoughness?.baseColorTexture?.index)
      .filter((index): index is number => index !== undefined);
    expect(baseColor.length).toBeGreaterThan(0);
    for (const index of baseColor) {
      const texture = asset.textures[index];
      const source = texture.extensions?.EXT_texture_webp?.source ?? texture.source;
      expect(asset.images[source], `texture ${index}`).toBeDefined();
    }
    expect(asset.nodes.some((node: { name: string }) => node.name === "head")).toBe(true);
    expect(asset.nodes.some((node: { name: string }) => node.name === "shin.L")).toBe(true);
    const targets = asset.meshes.flatMap(
      (mesh: { extras?: { targetNames?: string[] } }) => mesh.extras?.targetNames ?? [],
    );
    expect(targets).toContain("eyeBlinkLeft");
    expect(targets).toContain("eyeBlinkRight");
    for (const side of ["Left", "Right"]) {
      const highlight = asset.nodes.find(
        (node: { name: string }) => node.name === `EyeHighlight${side}`,
      );
      expect(highlight, `eye highlight ${side}`).toBeDefined();
      expect(asset.meshes[highlight.mesh].extras.targetNames).toContain(`eyeBlink${side}`);
      const lid = asset.nodes.find((node: { name: string }) => node.name === `Eyelid${side}`);
      const surface = asset.meshes[lid.mesh].primitives[0];
      expect(asset.materials[surface.material].alphaMode).toBe("BLEND");
      expect(asset.accessors[surface.attributes.COLOR_0].type).toBe("VEC4");
    }
    for (const name of ["eye.L", "eye.R"]) {
      expect(
        asset.nodes.some((node: { name: string }) => node.name === name),
        name,
      ).toBe(true);
    }
  });

  /*
   * 실제 GLB(880KB)를 Meshopt로 풀고 스킨·애니메이션까지 돈다. 로컬에서 2.5초, CI 러너에서는
   * 기본 5초를 넘긴다 (CI #141이 이것 하나로 빨갔다). 느린 테스트가 맞으니 시간을 넉넉히 준다.
   */
  it("decodes the real compressed skin, stays at room scale, and animates both knees", {
    timeout: 30_000,
  }, async () => {
    // Node has no image decoder. Only skip texture loading; use the actual mesh,
    // inverse bind matrices, compressed buffers and animation data unchanged.
    const model = structuredClone(asset);
    model.images = [];
    model.textures = [];
    model.materials = [{}];
    for (const mesh of model.meshes) {
      for (const primitive of mesh.primitives) primitive.material = 0;
    }
    const rawJson = Buffer.from(JSON.stringify(model));
    const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20);
    rawJson.copy(json);
    const binary = bytes.subarray(20 + jsonLength);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + json.length + binary.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const buffer = Buffer.concat([header, json, binary]);
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
      "",
    );
    const blinkRig = createPlayerRig(gltf.scene, gltf.animations);
    // 허리띠가 허벅지를 따라 접히면 조끼 아래가 벌어지고 엉덩이에 뾰족한 면이 생긴다.
    // 실제 바지 윗부분이 앉는 중에도 골반 기준 자리를 지키는지 확인한다.
    let trousersName = "";
    gltf.scene.traverse((object) => {
      const association = gltf.parser.associations.get(object);
      if (association?.meshes === undefined || association.primitives === undefined) return;
      const primitive = asset.meshes[association.meshes].primitives[association.primitives];
      if (asset.materials[primitive.material]?.name === "tripo_part_1_material")
        trousersName = object.name;
    });
    const trousers = blinkRig.root.getObjectByName(trousersName) as SkinnedMesh;
    const hips = blinkRig.root.getObjectByName("hips");
    if (!trousers?.isSkinnedMesh || !hips) throw new Error("Missing trousers or hips");
    updatePlayerRig(blinkRig, 0, 0, 0);
    blinkRig.root.updateMatrixWorld(true);
    const waistband: { index: number; relative: Vector3 }[] = [];
    for (let index = 0; index < trousers.geometry.attributes.position.count; index++) {
      const point = trousers
        .getVertexPosition(index, new Vector3())
        .applyMatrix4(trousers.matrixWorld);
      if (point.y > 0.535) waistband.push({ index, relative: hips.worldToLocal(point) });
    }
    // 불투명한 바지의 겹친 뒷면이 검은 찢김처럼 보이지 않아야 한다.
    const pantsMaterial = asset.materials.find(
      (material: { name: string }) => material.name === "tripo_part_1_material",
    );
    expect(pantsMaterial.doubleSided, "pants must render the outer cloth surface").not.toBe(true);
    const pantsColors = trousers.geometry.getAttribute("color");
    expect(
      pantsColors,
      "painted dark rips must be replaced by continuous cloth color",
    ).toBeDefined();
    expect(waistband.length).toBeGreaterThan(100);
    for (const sitting of [0.5, 1, 0]) {
      updatePlayerRig(blinkRig, 0, 0, 0, sitting);
      blinkRig.root.updateMatrixWorld(true);
      let drift = 0;
      for (const { index, relative } of waistband) {
        const point = trousers
          .getVertexPosition(index, new Vector3())
          .applyMatrix4(trousers.matrixWorld);
        drift = Math.max(drift, hips.worldToLocal(point).distanceTo(relative));
      }
      expect(drift, `waistband must stay under the shirt at sit=${sitting}`).toBeLessThan(0.005);
      // 양면 렌더링을 끈 뒤에도 양쪽 골반에 겉면이 남아 있어야 한다.
      // 실제 앉기 전환을 통과한 표면에 광선을 쏘아 빈틈을 검사한다.
      const hipPosition = hips.getWorldPosition(new Vector3());
      trousers.computeBoundingSphere();
      const surfaceRay = new Raycaster();
      for (const side of [-1, 1]) {
        for (const dy of [-0.02, 0, 0.02]) {
          for (const dz of [0.01, 0.025, 0.04]) {
            surfaceRay.set(
              new Vector3(side, hipPosition.y + dy, hipPosition.z + dz),
              new Vector3(-side, 0, 0),
            );
            const hit = surfaceRay.intersectObject(trousers)[0];
            expect(
              hit,
              `outer hip coverage side=${side}, sit=${sitting}, ${dy}, ${dz}`,
            ).toBeDefined();
            expect(hit.point.x * side).toBeGreaterThan(0.06);
          }
        }
      }
    }
    blinkRig.blink.next = 2.8;
    updatePlayerRig(blinkRig, 0, 0, 2.89);
    for (const part of ["EyelidLeft", "EyelidRight", "EyeHighlightLeft", "EyeHighlightRight"]) {
      const animated = blinkRig.root.getObjectByName(part) as SkinnedMesh;
      const cached = gltf.scene.getObjectByName(part) as SkinnedMesh;
      expect(animated.morphTargetInfluences?.[0], part).toBeGreaterThan(0.95);
      expect(animated.castShadow, `${part} must not cast a border on the face`).toBe(false);
      expect(cached.morphTargetInfluences?.[0], `${part} cached source`).toBe(0);
      if (part.startsWith("Eyelid")) {
        const color = animated.geometry.getAttribute("color");
        const alpha = Array.from({ length: color.count }, (_, index) => color.getW(index));
        expect(Math.min(...alpha), "lid edge must fade into skin").toBeLessThan(0.05);
        expect(Math.max(...alpha), "lid center must cover the painted iris").toBeGreaterThan(0.95);
      }
    }
    updatePlayerRig(blinkRig, 0, 0, 0.2);
    expect(blinkRig.blink.eyelids.every(({ influences, index }) => influences[index] === 0)).toBe(
      true,
    );
    // Match the original primitive/material through loader associations. The Node loader
    // skips images above, but the skin and the generator's material partition are real.
    let vestName = "";
    let collarName = "";
    let repairedCheek = false;
    let forehead: SkinnedMesh | undefined;
    gltf.scene.traverse((object) => {
      const association = gltf.parser.associations.get(object);
      if (
        association?.meshes === undefined ||
        !("primitives" in association) ||
        typeof association.primitives !== "number"
      )
        return;
      const primitive = asset.meshes[association.meshes].primitives[association.primitives];
      const materialName = asset.materials[primitive.material].name;
      if (materialName === "tripo_part_2_material_ForeheadRepair") forehead = object as SkinnedMesh;
      if (materialName === "tripo_part_2_material") {
        const face = object as SkinnedMesh;
        const position = face.geometry.getAttribute("position");
        const before = new Vector3();
        const during = new Vector3();
        let movement = 0;
        for (let index = 0; index < position.count; index += 7) {
          face.morphTargetInfluences?.fill(0);
          face.getVertexPosition(index, before);
          face.morphTargetInfluences?.fill(0.5);
          face.getVertexPosition(index, during);
          movement = Math.max(movement, before.distanceTo(during));
        }
        face.morphTargetInfluences?.fill(0);
        expect(movement, "painted eyes must stay fixed while eyelids close").toBeLessThan(0.00005);
      }
      if (materialName === "tripo_part_3_material") vestName = object.name;
      if (materialName === "tripo_part_6_material") collarName = object.name;
      if (materialName.startsWith("tripo_part_")) {
        const geometry = (object as SkinnedMesh).geometry;
        const colors = geometry.getAttribute("color");
        const indices = geometry.getIndex();
        const used = indices ? Array.from(new Set(indices.array)) : [];
        if (materialName.endsWith("Repair")) {
          if (materialName.endsWith("_CheekRepair")) repairedCheek = true;
          expect(colors, "repaired skin must retain its blended colors").toBeDefined();
          expect(used.length).toBeGreaterThan(0);
          const red = used.map((index) => colors.getX(index));
          const mean = red.reduce((sum, value) => sum + value, 0) / red.length;
          expect(mean).toBeGreaterThan(0.1);
          expect(mean).toBeLessThan(0.9);
          expect(Math.max(...red) - Math.min(...red)).toBeGreaterThan(0.05);
        } else if (
          ["tripo_part_1_material", "tripo_part_3_material", "tripo_part_6_material"].includes(
            materialName,
          ) &&
          !asset.materials[primitive.material].pbrMetallicRoughness?.baseColorTexture
        ) {
          // 조끼 옆선의 흰 텍스처 번짐을 없앤 색은 정점에 구워 둔다.
          expect(colors).toBeDefined();
          const brightness = used.map(
            (index) => (colors.getX(index) + colors.getY(index) + colors.getZ(index)) / 3,
          );
          // 옷 안쪽의 검은 그림자는 보존하되, 색상 레이어 전체가 검게 초기화되면 잡는다.
          const mean = brightness.reduce((sum, value) => sum + value, 0) / brightness.length;
          expect(mean).toBeGreaterThan(materialName === "tripo_part_1_material" ? 0.005 : 0.03);
          expect(mean).toBeLessThan(0.7);
        } else if (colors) {
          // Blender joins parts without color layers as black unless explicitly whitened.
          for (const index of used) {
            expect(colors.getX(index), materialName).toBeCloseTo(1, 4);
            expect(colors.getY(index), materialName).toBeCloseTo(1, 4);
            expect(colors.getZ(index), materialName).toBeCloseTo(1, 4);
          }
        }
      }
    });
    expect(vestName).not.toBe("");
    expect(repairedCheek).toBe(true);
    if (!forehead) throw new Error("Missing continuous forehead beneath the hair");
    gltf.scene.updateMatrixWorld(true);
    const skinRay = new Raycaster();
    for (const x of [-0.15, -0.08, 0, 0.08, 0.15]) {
      for (const y of [1.16, 1.19, 1.23, 1.27]) {
        skinRay.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
        expect(
          skinRay.intersectObject(forehead).length,
          `forehead coverage at ${x}, ${y}`,
        ).toBeGreaterThan(0);
      }
    }
    const collar = blinkRig.root.getObjectByName(collarName) as SkinnedMesh;
    const collarEdges = new Map<string, number>();
    const collarIndex = collar.geometry.index;
    if (!collarIndex) throw new Error("Missing collar surface");
    for (let i = 0; i < collarIndex.count; i += 3) {
      for (let side = 0; side < 3; side++) {
        const a = collarIndex.getX(i + side);
        const b = collarIndex.getX(i + ((side + 1) % 3));
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        collarEdges.set(key, (collarEdges.get(key) ?? 0) + 1);
      }
    }
    expect(
      [...collarEdges.values()].every((count) => count === 2),
      "collar rim must have thickness and no torn boundary",
    ).toBe(true);
    const collarSkin = collar.geometry.attributes;
    for (let i = 0; i < collarSkin.position.count; i++) {
      for (let slot = 0; slot < 4; slot++) {
        if (collarSkin.skinWeight.getComponent(i, slot) < 0.001) continue;
        const bone = collar.skeleton.bones[collarSkin.skinIndex.getComponent(i, slot)];
        expect(bone.name, "collar must not follow raised arms").not.toMatch(
          /shoulder|upper_arm|forearm/,
        );
      }
    }
    const vest = blinkRig.root.getObjectByName(vestName) as SkinnedMesh;
    blinkRig.root.updateMatrixWorld(true);
    // 떨어진 덮개로 가리지 않는다. 팔을 들면 드러나는 조끼 양옆은 닫힌 표면이어야 한다.
    const edgeCounts = new Map<string, { count: number; a: Vector3; b: Vector3 }>();
    const vestPoints = Array.from({ length: vest.geometry.attributes.position.count }, (_, i) =>
      vest.getVertexPosition(i, new Vector3()).applyMatrix4(vest.matrixWorld),
    );
    const keys = vestPoints.map((p) =>
      p
        .toArray()
        .map((n) => Math.round(n * 100_000))
        .join(","),
    );
    const triangles = vest.geometry.index;
    if (!triangles) throw new Error("Missing vest indices");
    for (let i = 0; i < triangles.count; i += 3) {
      for (let side = 0; side < 3; side++) {
        const a = triangles.getX(i + side);
        const b = triangles.getX(i + ((side + 1) % 3));
        if (keys[a] === keys[b]) continue;
        const key = [keys[a], keys[b]].sort().join("|");
        const edge = edgeCounts.get(key);
        if (edge) edge.count++;
        else edgeCounts.set(key, { count: 1, a: vestPoints[a], b: vestPoints[b] });
      }
    }
    const openSides = [...edgeCounts.values()].filter(
      ({ count, a, b }) =>
        count === 1 && [a, b].every((p) => Math.abs(p.x) > 0.1 && p.y > 0.59 && p.y < 0.8),
    );
    expect(openSides, "vest side seams must share the garment boundary").toHaveLength(0);
    const sideEdges = [...edgeCounts.values()].filter(({ a, b }) =>
      [a, b].every((p) => Math.abs(p.x) > 0.1 && p.y > 0.59 && p.y < 0.8),
    );
    expect(sideEdges.length).toBeGreaterThan(100);
    expect(
      Math.max(...sideEdges.map(({ a, b }) => a.distanceTo(b))),
      "knit sides must use small surface triangles, not long folded repair fans",
    ).toBeLessThan(0.04);

    const resting = new Map<number, Vector3>();
    for (let index = 0; index < vest.geometry.attributes.position.count; index += 17) {
      resting.set(index, vest.getVertexPosition(index, new Vector3()));
    }
    const hand = blinkRig.root.getObjectByName("handL");
    if (!hand) throw new Error("Missing hand");
    const handBefore = hand.getWorldPosition(new Vector3());
    updatePlayerRig(blinkRig, 0, 0, 0, 0, 1);
    blinkRig.root.updateMatrixWorld(true);
    expect(hand.getWorldPosition(new Vector3()).distanceTo(handBefore)).toBeGreaterThan(0.1);
    const raised = new Vector3();
    for (const [index, before] of resting) {
      expect(vest.getVertexPosition(index, raised).distanceTo(before)).toBeLessThan(0.00001);
    }
    disposePlayerRig(blinkRig);
    // The replacement carries the user's baked base-color image, verified above.
    // The previous model's vertex-color palette is no longer the source of color.
    const mixer = new AnimationMixer(gltf.scene);
    const idleClip = gltf.animations.find((clip) => clip.name === "Idle");
    const walkClip = gltf.animations.find((clip) => clip.name === "Walk");
    if (!idleClip || !walkClip) throw new Error("Missing locomotion clips");
    const idle = mixer.clipAction(idleClip);
    idle.play();
    mixer.setTime(0);
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(gltf.scene, true);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(PLAYER_TARGET_HEIGHT, 2);
    expect(bounds.min.y).toBeCloseTo(0, 2);
    idle.stop();
    const walk = mixer.clipAction(walkClip);
    walk.play();
    const knees = ["shinL", "shinR"].map((name) => {
      const bone = gltf.scene.getObjectByName(name);
      if (!bone) throw new Error(`Missing knee: ${name}`);
      return bone;
    });
    // GLTFLoader sanitizes dots in node names for PropertyBinding.
    expect(knees.every(Boolean)).toBe(true);
    mixer.setTime(0);
    const start = knees.map((bone) => bone.quaternion.clone());
    mixer.setTime(walk.getClip().duration * 0.25);
    expect(knees.every((bone, index) => bone.quaternion.angleTo(start[index]) > 0.01)).toBe(true);
    for (const clip of gltf.animations) {
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.setTime(clip.duration * 0.5);
      gltf.scene.updateMatrixWorld(true);
      const poseBounds = new Box3().setFromObject(gltf.scene, true);
      expect(poseBounds.min.y, clip.name).toBeGreaterThan(-0.03);
      if (clip.name === "Sit") expect(poseBounds.max.y).toBeLessThan(1.45);
      const point = new Vector3();
      gltf.scene.traverse((object) => {
        const mesh = object as SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
          mesh.getVertexPosition(index, point);
          expect(Number.isFinite(point.lengthSq())).toBe(true);
          expect(point.length()).toBeLessThan(3);
        }
      });
    }

    /*
     * 앉는 자리(seats.ts)는 전부 이 포즈의 실측값에서 나온다. 좌면 높이도, 앞뒤 위치도.
     * 리그를 다시 내보내면서 앉은 자세가 바뀌면 방 안의 의자 여덟 개가 한꺼번에 어긋나므로,
     * 코드가 들고 있는 수치를 실제 GLB에 대고 확인한다.
     */
    mixer.stopAllAction();
    const sitClip = gltf.animations.find((clip) => clip.name === "Sit");
    if (!sitClip) throw new Error("Missing Sit clip");
    mixer.clipAction(sitClip).play();
    mixer.setTime(sitClip.duration * 0.5);
    gltf.scene.updateMatrixWorld(true);
    const sit = { contactY: Infinity, contactBack: Infinity, legBack: Infinity, torso: 0 };
    const vertex = new Vector3();
    // 좌면에 닿는 부분(엉덩이·허벅지)과 늘어지는 부분(무릎 아래)은 높이로 못 가른다.
    // 정강이가 허벅지 높이까지 올라온다. 각 정점이 가장 많이 매달린 본으로 가른다.
    const CONTACT_BONES = new Set(["hips", "thighL", "thighR"]);
    const LEG_BONES = new Set(["shinL", "shinR", "footL", "footR", "toeL", "toeR"]);
    gltf.scene.traverse((object) => {
      const mesh = object as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight, position } = mesh.geometry.attributes;
      for (let index = 0; index < position.count; index++) {
        mesh.getVertexPosition(index, vertex);
        vertex.applyMatrix4(mesh.matrixWorld);
        let bone = 0;
        let weight = -1;
        for (let slot = 0; slot < 4; slot++) {
          if (skinWeight.getComponent(index, slot) <= weight) continue;
          weight = skinWeight.getComponent(index, slot);
          bone = skinIndex.getComponent(index, slot);
        }
        const name = mesh.skeleton.bones[bone]?.name ?? "";
        if (CONTACT_BONES.has(name)) {
          sit.contactY = Math.min(sit.contactY, vertex.y);
          sit.contactBack = Math.min(sit.contactBack, vertex.z);
        } else if (LEG_BONES.has(name)) {
          sit.legBack = Math.min(sit.legBack, vertex.z);
        }
        if (vertex.y < 0.7) sit.torso = Math.max(sit.torso, Math.abs(vertex.x));
      }
    });
    expect(sit.contactY).toBeCloseTo(SIT_CONTACT_Y, 2);
    expect(sit.contactBack).toBeCloseTo(SIT_CONTACT_Z.back, 2);
    expect(sit.legBack).toBeCloseTo(SIT_LEG_Z.back, 2);
    expect(sit.torso).toBeLessThanOrEqual(SIT_TORSO_HALF_WIDTH);
  });
});
