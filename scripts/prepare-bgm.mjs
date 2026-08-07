#!/usr/bin/env node
/**
 * 받아온 BGM 원본을 리포에 넣을 수 있는 형태로 굽는다.
 *
 *   pnpm audio:bgm <입력파일> <daylight|second-light>
 *
 * 하는 일은 세 가지다:
 *
 *  1. **앞뒤 무음 트림.** 재생 코드가 꼬리 2.4초를 머리 위에 접어 루프를 만들기
 *     때문에(music.ts의 foldLoopTail), 끝에 무음이 붙어 있으면 그 무음이 루프
 *     시작점에 접혀 구멍이 된다. 여기서 잘라두지 않으면 방에서 규칙적으로 소리가
 *     빈다.
 *  2. **Ogg Vorbis 인코딩** (품질 4 ≒ 128kbps). 3MB 한도(.claude/rules/assets.md)
 *     안에 들어가야 한다 — 넘으면 품질을 한 단계 낮춰 다시 굽는다.
 *  3. **라우드니스 측정.** 두 곡에 같은 음량 커브가 걸리므로 둘의 기준 레벨이
 *     어긋나면 2바퀴에서 갑자기 커지거나 작아진다. 값만 보고하고 건드리지는
 *     않는다 — 맞출지는 듣고 판단할 일이다.
 *
 * 음악 자체는 손대지 않는다. 열화(로우패스·리버브·덕킹)는 전부 재생 시점에
 * 걸린다 (src/lib/audio/music-curve.ts).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

/** 넣을 수 있는 자리와 그 파일명 — src/lib/assets.ts의 bgm 후보 목록과 같아야 한다. */
const SLOTS = {
  daylight: "bgm-room-daylight.ogg",
  "second-light": "bgm-room-second-light.ogg",
};

const OUT_DIR = "public/assets/audio/bgm";
/** .claude/rules/assets.md의 BGM 한도. */
const MAX_BYTES = 3 * 1024 * 1024;
/** 무음으로 칠 문턱과, 트림 후 남길 여유. 딱 붙여 자르면 첫 음의 어택이 깎인다. */
const SILENCE_DB = "-50dB";
/** 앞에서부터 낮춰가며 3MB에 들어가는 첫 품질을 쓴다. 4가 대략 128kbps다. */
const QUALITY_STEPS = [4, 3, 2];

function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function probe(file, entries) {
  return execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", entries, "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  ).trim();
}

/**
 * loudnorm 측정 패스에서 통합 라우드니스(LUFS)와 다이내믹 폭(LRA)을 뽑는다.
 * 필터 리포트는 stdout이 아니라 **stderr**로 나온다 — spawnSync로 둘 다 받는다.
 */
function measureLoudness(file) {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const report = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const start = report.lastIndexOf("{");
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(report.slice(start, report.lastIndexOf("}") + 1));
    return { lufs: Number(parsed.input_i), lra: Number(parsed.input_lra) };
  } catch {
    return null;
  }
}

const [input, slot] = process.argv.slice(2);

if (!input || !SLOTS[slot]) {
  console.error(`사용법: pnpm audio:bgm <입력파일> <${Object.keys(SLOTS).join("|")}>`);
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`입력 파일이 없다: ${input}`);
  process.exit(1);
}

const output = path.join(OUT_DIR, SLOTS[slot]);
mkdirSync(OUT_DIR, { recursive: true });

const before = Number(probe(input, "format=duration"));

// 앞은 silenceremove, 뒤는 뒤집어서 같은 필터를 다시 — ffmpeg에 뒤쪽 전용 트림이 없다
const trim = [
  `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}:start_silence=0.05`,
  "areverse",
  `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}:start_silence=0.05`,
  "areverse",
].join(",");

let picked = null;
for (const quality of QUALITY_STEPS) {
  ffmpeg([
    "-i",
    input,
    "-vn",
    "-map_metadata",
    "-1",
    "-af",
    trim,
    "-c:a",
    "libvorbis",
    "-q:a",
    String(quality),
    "-ar",
    "44100",
    "-ac",
    "2",
    `${output}.tmp.ogg`,
  ]);
  const size = statSync(`${output}.tmp.ogg`).size;
  if (size <= MAX_BYTES) {
    picked = { quality, size };
    break;
  }
  console.warn(`  q${quality} → ${(size / 1024 / 1024).toFixed(2)}MB, 한도를 넘어 한 단계 낮춘다`);
  unlinkSync(`${output}.tmp.ogg`);
}

if (!picked) {
  console.error("3MB 안에 못 넣었다. 곡을 짧게 자르거나 다른 곡을 고를 것.");
  process.exit(1);
}

renameSync(`${output}.tmp.ogg`, output);

const after = Number(probe(output, "format=duration"));
const measured = measureLoudness(output);

console.log(`${output}`);
console.log(
  `  길이     ${after.toFixed(1)}s (원본 ${before.toFixed(1)}s, 무음 ${(before - after).toFixed(2)}s 트림)`,
);
console.log(
  `  크기     ${(picked.size / 1024 / 1024).toFixed(2)}MB (vorbis q${picked.quality}, 한도 3MB)`,
);
if (measured) {
  console.log(
    `  라우드니스 ${measured.lufs.toFixed(1)} LUFS — 두 곡이 3 LUFS 넘게 벌어지면 바퀴가 바뀔 때 한쪽이 튄다`,
  );
  console.log(
    `  다이내믹 ${measured.lra.toFixed(1)} LRA — 10을 넘으면 미니게임 중 18%로 눌렸을 때 조용한 대목이 사라진다`,
  );
}
console.log(`\n다음: public/assets/CREDITS.md에 출처·라이선스를 적고, 들어보고`);
console.log(`src/lib/audio/music-curve.ts의 컷오프·음량 범위를 다시 잡는다.`);
