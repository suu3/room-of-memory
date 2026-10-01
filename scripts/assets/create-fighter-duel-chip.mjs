/**
 * 게임기(fighter-duel) 8비트 루프. Rebuild: node scripts/assets/create-fighter-duel-chip.mjs (ffmpeg 필요)
 *
 * NES식 파트 넷을 코드로 합성한다: 펄스 25% 리드, 삼각파 베이스, 12.5% 펄스 아르페지오(둘째 바퀴),
 * LFSR 노이즈 드럼. 150BPM · Am–F–G–E 8마디 × 2바퀴 = 25.6초, 꼬리를 머리로 감아 이음새가 없다.
 * 방 TV 스피커에서 나는 소리로 들리게 250Hz~3.2kHz 밖을 깎아 Opus로 굽는다.
 *
 * 게임이 BGM에 거는 루프 접기(foldLoopTail)를 타지 않는 곡이다 (startOverlayMusic).
 * 마디 길이에 딱 맞춰 구웠으므로 그대로 이어 돌린다.
 */
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(root, "public/assets/audio/bgm/mg-fighter-duel-chip.ogg");

const SR = 44100;
const BPM = 150;
const STEP = 60 / BPM / 4; // 16분음표
const BARS = 8;
const LOOPS = 2;
// 루프 길이에 딱 맞춘다. 끝을 넘는 꼬리는 머리로 감아서 이음새가 없다
const total = Math.round(STEP * 16 * BARS * LOOPS * SR);
const buf = new Float32Array(total);

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function pulse(t, f, duty) {
  const p = (t * f) % 1;
  return p < duty ? 1 : -1;
}
function tri(t, f) {
  const p = (t * f) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

function note(startSec, lenSec, midi, { type, vol, duty = 0.25, vib = 0 }) {
  const f0 = hz(midi);
  const s0 = Math.floor(startSec * SR);
  const n = Math.floor(lenSec * SR);
  const rel = Math.floor(0.03 * SR);
  for (let i = 0; i < n + rel; i++) {
    const t = i / SR;
    const f = f0 * (1 + (t > 0.12 ? vib * Math.sin(2 * Math.PI * 6 * t) : 0));
    let env = i < n ? 1 - 0.35 * Math.min(1, t / 0.25) : 0.65 * (1 - (i - n) / rel);
    env = Math.max(0, Math.round(env * 15) / 15); // NES식 4비트 음량 계단
    const v = type === "tri" ? tri(t, f) : pulse(t, f, duty);
    buf[(s0 + i) % total] += v * vol * env;
  }
}

let noiseReg = 1;
function noiseBit() {
  const b = (noiseReg ^ (noiseReg >> 1)) & 1;
  noiseReg = (noiseReg >> 1) | (b << 14);
  return noiseReg & 1 ? 1 : -1;
}
function drum(startSec, kind) {
  const s0 = Math.floor(startSec * SR);
  if (kind === "k") {
    const n = Math.floor(0.12 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 150 * Math.exp(-t * 30) + 45;
      buf[(s0 + i) % total] += tri(t, f) * 0.55 * (1 - i / n);
    }
    return;
  }
  const len = kind === "s" ? 0.14 : 0.035;
  const vol = kind === "s" ? 0.28 : 0.1;
  const hold = kind === "s" ? 3 : 1; // 노이즈 주기(낮을수록 치직)
  const n = Math.floor(len * SR);
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (i % hold === 0) v = noiseBit();
    buf[(s0 + i) % total] += v * vol * (1 - i / n) ** 2;
  }
}

// 코드: Am F G E / Am F G E
const roots = [57, 53, 55, 52, 57, 53, 55, 52];
const chords = [
  [69, 72, 76],
  [65, 69, 72],
  [67, 71, 74],
  [64, 68, 71],
];

// [step, midi, len]
const A = [
  [0, 76, 2],
  [2, 81, 2],
  [4, 76, 2],
  [6, 72, 2],
  [8, 74, 1],
  [9, 76, 3],
  [12, 72, 2],
  [14, 69, 2],
];
const B = [
  [0, 72, 2],
  [2, 77, 2],
  [4, 76, 2],
  [6, 72, 2],
  [8, 74, 4],
  [12, 72, 2],
  [14, 74, 2],
];
const C = [
  [0, 79, 3],
  [3, 77, 1],
  [4, 76, 2],
  [6, 74, 2],
  [8, 71, 2],
  [10, 74, 2],
  [12, 79, 2],
  [14, 74, 2],
];
const D = [
  [0, 76, 4],
  [4, 80, 2],
  [6, 83, 2],
  [8, 80, 2],
  [10, 76, 2],
  [12, 71, 4],
];
const D2 = [
  [0, 76, 2],
  [2, 80, 2],
  [4, 83, 2],
  [6, 86, 2],
  [8, 88, 6],
];
const melody = [A, B, C, D, A, B, C, D2];

for (let loop = 0; loop < LOOPS; loop++) {
  for (let bar = 0; bar < BARS; bar++) {
    const barT = (loop * BARS + bar) * 16 * STEP;
    // 리드 (펄스 25%)
    for (const [s, m, l] of melody[bar]) {
      note(barT + s * STEP, l * STEP * 0.9, m, {
        type: "pulse",
        vol: 0.16,
        duty: 0.25,
        vib: 0.006,
      });
    }
    // 베이스 (삼각파 옥타브 왕복)
    for (let s = 0; s < 16; s += 2) {
      const m = roots[bar] - 12 + (s % 4 === 2 ? 12 : 0);
      note(barT + s * STEP, STEP * 1.6, m, { type: "tri", vol: 0.3 });
    }
    // 둘째 바퀴: 12.5% 펄스 아르페지오
    if (loop === 1) {
      const ch = chords[bar % 4];
      for (let s = 0; s < 16; s++) {
        note(barT + s * STEP, STEP * 0.8, ch[s % 3] + 12, {
          type: "pulse",
          vol: 0.05,
          duty: 0.125,
        });
      }
    }
    // 드럼
    for (let s = 0; s < 16; s++) {
      const t = barT + s * STEP;
      if (s === 0 || s === 8 || s === 10) drum(t, "k");
      if (s === 4 || s === 12) drum(t, "s");
      if (s % 2 === 0) drum(t, "h");
    }
  }
}

function writeWav(path, data) {
  let peak = 0;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  const g = 0.89 / peak;
  const out = Buffer.alloc(44 + data.length * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data.length * 2, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++)
    out.writeInt16LE(Math.round(data[i] * g * 32767), 44 + i * 2);
  writeFileSync(path, out);
}

// TV 스피커: 하이패스 250Hz + 로우패스 3.2kHz (1차 두 번씩)
function lp(d, fc) {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  return d.map((x) => (y += a * (x - y)));
}
function hp(d, fc) {
  const low = lp(d, fc);
  return d.map((x, i) => x - low[i]);
}
// 필터 상태도 이음새를 넘도록 두 바퀴 흘린 뒤 뒤 바퀴만 쓴다
const twice = new Float32Array(total * 2);
twice.set(buf);
twice.set(buf, total);
const tv = lp(lp(hp(hp(twice, 250), 250), 3200), 3200).slice(total);
const wav = path.join(tmpdir(), "mg-fighter-duel-chip.wav");
writeWav(wav, tv);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  wav,
  "-c:a",
  "libopus",
  "-b:a",
  "64k",
  OUT,
]);
rmSync(wav);
console.log(`${(total / SR).toFixed(1)}s → ${path.relative(root, OUT)}`);
