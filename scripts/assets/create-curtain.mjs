/**
 * 커튼 천 glb를 만든다. 재생성: node scripts/assets/create-curtain.mjs
 *
 * 침대 이불(room-bed.glb의 shape key `folded`)과 같은 방식으로, 커튼도 **shape key로
 * 여닫는다**. 파일에는 닫힌 자세(Basis)와 젖힌 자세(shape key `open`)가 들어 있고,
 * 게임은 젖힘 진행도를 morph influence에 그대로 쓴다. 코드가 천을 옮기지 않으므로
 * 블렌더에서 만든 커튼으로 바꿔 끼울 때도 코드는 그대로다 (docs/model-export.md).
 *
 * 파일 규약 (게임이 기대하는 것):
 *  - 노드 이름 `left` · `right`: 창문 왼쪽·오른쪽 커튼 한 장씩. 재질은 없어도 된다
 *    (코드가 팔레트의 fabric으로 입힌다). COLOR_0이 있으면 머리단·밑단 음영으로 곱한다.
 *  - 두 노드 모두 shape key `open` 하나: 0이면 닫혀 창을 덮고, 1이면 바깥쪽 끝에
 *    뭉쳐 창이 드러난다. 바깥쪽 매달린 끝은 움직이지 않는다 (커튼봉 끝에 걸려 있다).
 *  - 원점: 창 가운데 x, **밑단 y=0**, 천의 z 중심. 놓는 자리는 curtain-model.ts.
 *
 * 외부 메쉬·텍스처 없음. 주름은 식으로 새긴다: 일곱 주름, 밑단으로 갈수록 커지는
 * 대각 잔주름, 무게로 처진 밑단.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Box3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { CURTAIN_X } from "../../src/scenes/memory-room/curtain-motion.ts";

// GLTFExporter는 브라우저 FileReader로 바이너리를 읽는다. 지오메트리만 내보내니 이 둘로 충분하다.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);

const NAME = "room-curtain";
/** 게임이 찾는 shape key 이름 (curtain-model.ts의 CURTAIN_OPEN_KEY와 같아야 한다). */
const OPEN_KEY = "open";
/** 커튼봉 걸이 높이·창 가운데. RoomFurniture의 커튼 그룹이 있던 자리와 같다. */
const HANG_Y = 2.5;
const WINDOW_CENTER_X = 1.15;

const WIDTH = 1.9;
const GATHERED_WIDTH = 0.36;
const HEIGHT = 2.9;

const css = readFileSync("src/app/globals.css", "utf8");
const fabricColor = css.match(/--color-scene-fabric:\s*([^;]+);/)?.[1];
if (!fabricColor) throw new Error("Missing scene token fabric");

/**
 * 한 쪽 커튼. 닫힌 자세를 기본 위치로, 젖힌 자세를 morph target `open`으로 새긴다.
 * 두 자세 모두 창 가운데(WINDOW_CENTER_X)를 원점으로 한 좌표라, 젖힘에 따른 이동까지
 * shape key 하나에 들어간다.
 */
function buildCloth(side) {
  const geometry = new PlaneGeometry(WIDTH, HEIGHT, 64, 32);
  const gathered = geometry.clone();
  const uv = geometry.getAttribute("uv");
  const direction = side === "left" ? 1 : -1;
  const colors = new Float32Array(uv.count * 3);

  for (const [surface, progress] of [
    [geometry, 0],
    [gathered, 1],
  ]) {
    const positions = surface.getAttribute("position");
    const centerX = (progress ? CURTAIN_X[side].open : CURTAIN_X[side].closed) - WINDOW_CENTER_X;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = 1 - uv.getY(i);
      // 일곱 주름. 아래로 갈수록 대각 잔주름이 커진다 (밑단이 자유로워서).
      const phase = u * Math.PI * 14 + direction * 0.2 * Math.sin(v * 6 + u * 4) * v;
      const amplitude = 0.072 + v * 0.023 + progress * 0.036;
      const wrinkle = Math.sin(u * 73 + v * 16 * direction) * Math.sin(v * Math.PI) * 0.012;
      const hem = Math.sin(u * Math.PI * 7) ** 2;
      const y = HEIGHT / 2 - v * HEIGHT - hem * (0.015 + v * v * 0.037);
      // 폭이 줄면서 중심이 옮겨가면 바깥쪽 매달린 끝은 제자리에 남는다.
      const x = centerX + (u - 0.5) * (WIDTH + (GATHERED_WIDTH - WIDTH) * progress);
      const z = 0.075 + amplitude * Math.cos(phase) + wrinkle + 0.021 * v * v * Math.sin(u * 11);
      positions.setXYZ(i, x, y, z);
      // 박음질한 머리단과 무게 단 밑단: 색은 코드가 입히는 fabric에 곱해지는 음영이다.
      const shade = v < 0.07 || v > 0.95 ? 0.87 : 1;
      colors.set([shade, shade, shade], i * 3);
    }
    surface.computeVertexNormals();
  }

  geometry.deleteAttribute("uv");
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const openPositions = gathered.getAttribute("position").clone();
  openPositions.name = OPEN_KEY;
  const openNormals = gathered.getAttribute("normal").clone();
  openNormals.name = OPEN_KEY;
  geometry.morphAttributes.position = [openPositions];
  geometry.morphAttributes.normal = [openNormals];
  gathered.dispose();

  const material = new MeshStandardMaterial({
    color: new Color(fabricColor),
    roughness: 0.98,
    metalness: 0,
    side: DoubleSide,
    vertexColors: true,
  });
  material.name = "fabric";
  const mesh = new Mesh(geometry, material);
  mesh.name = side;
  mesh.updateMorphTargets();
  return mesh;
}

const group = new Group();
group.name = NAME;
group.userData = {
  provenance: "Original procedural geometry for room-of-memory",
  source: "scripts/assets/create-curtain.mjs",
};
const cloths = ["left", "right"].map(buildCloth);
for (const cloth of cloths) group.add(cloth);

/*
 * 밑면을 y=0, x·z 중심을 원점으로. 닫힌 자세(기본 위치)로 잰다. 젖힌 자세는 x로 대칭이고
 * z는 주름이 조금 깊어질 뿐이라 중심이 같다. 놓는 자리는 이 이동량에서 나온다 (아래 출력).
 *
 * geometry.translate()는 morph 위치를 안 옮긴다 (three r185의 applyMatrix4는 position만).
 * 두 자세를 같이 옮기지 않으면 젖힐 때 커튼이 옛 원점으로 떨어진다.
 */
const bounds = new Box3();
for (const cloth of cloths) {
  bounds.union(new Box3().setFromBufferAttribute(cloth.geometry.getAttribute("position")));
}
const center = bounds.getCenter(new Vector3());
for (const cloth of cloths) {
  const { geometry } = cloth;
  for (const attribute of [
    geometry.getAttribute("position"),
    ...geometry.morphAttributes.position,
  ]) {
    for (let i = 0; i < attribute.count; i++) {
      attribute.setXYZ(
        i,
        attribute.getX(i) - center.x,
        attribute.getY(i) - bounds.min.y,
        attribute.getZ(i) - center.z,
      );
    }
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

mkdirSync(".next/curtain", { recursive: true });
const file = `.next/curtain/${NAME}.glb`;
writeFileSync(file, Buffer.from(await new GLTFExporter().parseAsync(group, { binary: true })));
execFileSync(process.execPath, ["scripts/prepare-model.mjs", file, NAME], { stdio: "inherit" });

console.log("\n▸ 놓는 자리 (curtain-model.ts의 CURTAIN_MODEL_ORIGIN과 같아야 한다)");
console.log(
  `  x=${(WINDOW_CENTER_X + center.x).toFixed(4)} (창 가운데) · y=${(HANG_Y + bounds.min.y).toFixed(4)} (밑단) · z=커튼 z + ${center.z.toFixed(4)}`,
);
