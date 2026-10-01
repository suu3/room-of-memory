#!/usr/bin/env node
/**
 * 블렌더에서 내보낸 glb를 리포에 넣을 수 있는 형태로 굽고 검사한다.
 *
 *   pnpm model:prep <입력.glb> [넣을-이름]
 *
 * 하는 일:
 *
 *  1. **압축.** 블렌더 내보내기는 압축이 안 붙어 나온다 (플레이어 모델이 2.0MB로
 *     들어왔다). Meshopt를 씌우면 4분의 1 안팎으로 줄고, 그 과정에서 **쓰지 않는
 *     데이터가 걸러진다**. 실제로 안 쓰는 스킨이 하나 더 붙어 나온 적이 있고, 그게
 *     붙어 있으면 SkeletonUtils.clone이 그쪽에 물려 애니메이션이 통째로 어긋난다.
 *  2. **검사.** 게임 쪽 규약(밑면이 y=0, 텍스처는 파일 안에, 5MB 이하)을 실제 로더로
 *     확인한다. 어긋나면 블렌더에서 무엇을 고쳐야 하는지 적어 준다 (docs/models/model-export.md).
 *  3. **배치.** 통과하면 public/assets/models/에 넣고, 그다음에 사람이 해야 할 일
 *     (참조 URL의 ?v= 갱신, CREDITS 기록)을 알려 준다.
 *
 * 모양 자체는 손대지 않는다. 원점·축·크기는 블렌더에서 잡아야 하는 것이라, 여기서
 * 몰래 고치면 다음 내보내기 때 또 어긋난다. 여기서는 틀렸다고 말해 주기만 한다.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Box3, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const OUT_DIR = "public/assets/models";
/** .claude/rules/assets.md의 3D 모델 한도. */
const MAX_BYTES = 5 * 1024 * 1024;
/** 밑면이 이만큼 넘게 어긋나면 놓을 때 바닥에 박히거나 뜬다 (룸 단위, 대략 3cm). */
const BASE_TOLERANCE = 0.03;
/** x·z 중심이 이만큼 넘게 밀려 있으면 좌표를 준 자리에서 반쪽만큼 어긋나 앉는다. */
const CENTER_TOLERANCE = 0.15;

function fail(message, hints = []) {
  console.error(`\n✖ ${message}`);
  for (const hint of hints) console.error(`  - ${hint}`);
  console.error("\n  자세한 내보내기 설정: docs/models/model-export.md");
  process.exit(1);
}

/**
 * gltf-transform CLI 한 번. 프로젝트 의존성에 없는 도구라 pnpm dlx로 부른다.
 *
 * Windows의 pnpm은 .cmd 껍데기라 셸 없이는 실행되지 않는다(Node 20+). 셸을 쓰는 만큼
 * 경로는 직접 따옴표로 감싼다. 사람이 고르는 파일 경로에는 공백이 흔하다.
 */
function gltfTransform(args) {
  const quoted = args.map((arg) => (/[\s"]/.test(arg) ? `"${arg}"` : arg));
  return execSync(`pnpm dlx @gltf-transform/cli ${quoted.join(" ")}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** glb의 JSON 청크. 확장·이미지 경로처럼 로더가 감춰 버리는 것을 여기서 본다. */
function readGlbJson(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
    fail(`glb가 아니다: ${file}`, [
      "블렌더 내보내기에서 형식을 glTF Binary (.glb)로 고른다. .gltf+.bin 낱개는 커밋하지 않는다",
    ]);
  }
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}

/**
 * Node에는 이미지 디코더가 없어 텍스처가 든 모델은 GLTFLoader가 통째로 터진다. 검사에
 * 필요한 건 메쉬·본·애니메이션뿐이라 이미지·재질만 비운 사본을 읽는다
 * (player-model.test와 같은 방식). 압축 버퍼·스킨·클립은 그대로다.
 */
async function loadScene(file) {
  const bytes = readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  model.images = [];
  model.textures = [];
  model.materials = [{}];
  for (const mesh of model.meshes ?? []) {
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
  return loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
    "",
  );
}

const [input, requestedName] = process.argv.slice(2);
if (!input) fail("쓸 파일을 안 줬다: pnpm model:prep <입력.glb> [넣을-이름]");
if (!existsSync(input)) fail(`파일이 없다: ${input}`);

const name = (requestedName ?? path.basename(input, path.extname(input))).replace(/\.glb$/, "");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  fail(`이름은 kebab-case여야 한다: ${name}`, [
    "예: rabbit-doll, ch1-radio, room-desk-lamp (챕터/용도를 접두사로)",
  ]);
}

const work = mkdtempSync(path.join(tmpdir(), "model-prep-"));
const compressed = path.join(work, `${name}.glb`);

try {
  const source = readGlbJson(input);
  const skinned = (source.skins?.length ?? 0) > 0 || (source.animations?.length ?? 0) > 0;
  const morphed = (source.meshes ?? []).some((mesh) =>
    mesh.primitives.some((primitive) => (primitive.targets?.length ?? 0) > 0),
  );

  /*
   * 본이 있는 모델은 meshopt만 씌운다. optimize는 메쉬를 합치고(join) 줄이는데(simplify),
   * 스킨·애니메이션이 걸린 메쉬에서는 그게 본과의 대응을 흔든다. 소품은 반대로 합쳐야
   * 드로우콜이 준다.
   *
   * shape key(morph target)가 있는 모델도 같다. 이불·커튼처럼 shape key를 따로 움직여야
   * 하는 부품이 재질이 같다고 한 메쉬로 합쳐지면 이름이 사라지고 한 몸으로만 움직인다.
   */
  const keepParts = skinned || morphed;
  /*
   * 밑면을 y=0으로 내린다. 게임은 "놓을 면의 높이를 그대로 좌표로 준다"는 규약으로 도는데
   * (model-utils의 centerModelXZ 주석) 블렌더 원점은 대개 물건 한가운데 있다. 여기서
   * 맞춰 두면 배치 코드가 보정값을 들고 다니지 않아도 된다. 얼마나 움직였는지는 아래에서
   * 알려 준다.
   */
  const based = path.join(work, `${name}-based.glb`);
  gltfTransform(["center", input, based, "--pivot", "below"]);

  const mode = skinned
    ? "본 있음: meshopt만"
    : morphed
      ? "shape key 있음: meshopt만"
      : "소품: 합치고 meshopt";
  console.log(`\n▸ 압축 (${mode})`);
  const log = keepParts
    ? gltfTransform(["meshopt", based, compressed, "--level", "medium"])
    : gltfTransform([
        "optimize",
        based,
        compressed,
        "--compress",
        "meshopt",
        "--simplify",
        "false",
        /*
         * palette는 재질이 5개 이상이면 색을 작은 webp 아틀라스로 구워 재질을 하나로
         * 합친다. 드로우콜은 줄지만 색이 상수(baseColorFactor)에서 텍스처로 옮겨가서,
         * 방이 재질 색을 직접 만지는 연출(수집 완료 이미시브·팔레트 대조)에서 손댈
         * 자리가 사라진다. 소품 하나에 얻을 것보다 잃는 게 크다.
         */
        "--palette",
        "false",
        "--texture-compress",
        "webp",
      ]);
  for (const line of log.split("\n")) {
    // 걸러낸 것은 알려 준다. 쓰지 않는 스킨이 걸러졌다면 블렌더 쪽에도 남아 있다는 뜻이다.
    if (/prune|Removed|warn/i.test(line)) console.log(`  ${line.trim()}`);
  }

  const before = statSync(input).size;
  const after = statSync(compressed).size;
  console.log(`  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);

  const asset = readGlbJson(compressed);
  const gltf = await loadScene(compressed);
  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());

  const problems = [];
  const hints = [];

  if (after > MAX_BYTES) {
    problems.push(`${(after / 1024 / 1024).toFixed(1)}MB: 한도 5MB를 넘는다`);
    hints.push("텍스처 해상도를 줄이거나(2048 이하) 메쉬를 단순화한다");
  }

  const external = (asset.images ?? []).filter((image) => image.uri !== undefined);
  if (external.length > 0) {
    problems.push(`텍스처가 파일 밖을 가리킨다: ${external.map((i) => i.uri).join(", ")}`);
    hints.push("블렌더에서 File ▸ External Data ▸ Pack Resources 후 다시 내보낸다");
  }

  if (Math.abs(bounds.min.y) > BASE_TOLERANCE) {
    problems.push(`밑면이 y=${bounds.min.y.toFixed(3)}에 있다 (0이어야 한다)`);
    hints.push(
      "블렌더에서 물건을 바닥(z=0) 위에 올리고 원점을 발밑으로 내린다. 놓을 면의 높이를 그대로 좌표로 주는 규약이다",
    );
  }

  if (Math.abs(center.x) > CENTER_TOLERANCE || Math.abs(center.z) > CENTER_TOLERANCE) {
    // 소품은 FurnitureModel이 x·z를 자동으로 맞춰 주지만, 캐릭터 리그는 그 보정을 안 거친다.
    console.log(
      `  ! x·z 중심이 (${center.x.toFixed(2)}, ${center.z.toFixed(2)})로 밀려 있다. 캐릭터라면 블렌더에서 원점을 가운데로`,
    );
  }

  if (problems.length > 0)
    fail(`검사에 걸렸다 (${problems.length}개)`, [...problems, "", ...hints]);

  const clips = gltf.animations.map((clip) => `${clip.name}(${clip.duration.toFixed(2)}s)`);
  const bones = [];
  gltf.scene.traverse((object) => {
    if (object.isBone) bones.push(object.name);
  });

  console.log("\n▸ 검사 통과");
  console.log(
    `  크기(가로·높이·세로): ${size
      .toArray()
      .map((n) => n.toFixed(2))
      .join(" × ")}`,
  );
  console.log(
    `  밑면 y=${bounds.min.y.toFixed(3)} · 압축 ${asset.extensionsRequired?.join(", ") ?? "없음"}`,
  );
  if (bones.length > 0) console.log(`  본 ${bones.length}개`);
  if (clips.length > 0) console.log(`  애니메이션: ${clips.join(", ")}`);
  const shapeKeys = [];
  gltf.scene.traverse((object) => {
    for (const key of Object.keys(object.morphTargetDictionary ?? {})) {
      shapeKeys.push(`${object.name}.${key}`);
    }
  });
  if (shapeKeys.length > 0) console.log(`  shape key: ${shapeKeys.join(", ")}`);

  const destination = path.join(OUT_DIR, `${name}.glb`);
  const replacing = existsSync(destination);
  copyFileSync(compressed, destination);
  console.log(`\n▸ ${destination}`);
  console.log(`  scale 계산: 방에서 키를 H로 두려면 H / ${size.y.toFixed(2)}`);
  if (replacing) {
    console.log(
      "  ! 같은 이름을 덮어썼다. src/lib/assets.ts의 ?v=를 반드시 올린다. 안 올리면 서비스 워커가 옛 파일을 계속 내준다",
    );
  } else {
    console.log("  다음: src/lib/assets.ts에 경로 추가 · public/assets/CREDITS.md에 출처 기록");
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
