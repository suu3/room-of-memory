import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./load.mjs";
import {
  EXPRESSIONS,
  ICONS,
  ID_PATTERN,
  LOCALES,
  MEMORY_KEYS,
  PHASE_KEYS,
  SPEAKERS,
  STAGE_IDS,
} from "./schema.mjs";

/**
 * 콘텐츠 검증 — 저장/생성 전에 걸러야 할 것들.
 *
 * 어드민이 저장할 때와 `pnpm content:build`가 돌 때 같은 함수를 쓴다. 그래야
 * 어드민에서 통과한 것이 CI에서 떨어지는 일이 없다.
 *
 * 여기서 잡는 것은 "데이터끼리 어긋난 것"이다. 이야기가 좋은지는 안 본다.
 *
 * @returns {string[]} 사람이 읽을 수 있는 문제 목록. 비어 있으면 통과.
 */
export function validateContent(content, { minigameIds = [] } = {}) {
  const issues = [];
  const { memories, scripts, cutscenes, stages } = content;

  if (!Array.isArray(memories) || memories.length === 0) {
    issues.push("memories.yaml: 기억이 하나도 없다.");
    return issues;
  }
  if (!isPlainObject(scripts)) issues.push("scripts.yaml: scripts가 객체가 아니다.");
  if (!isPlainObject(cutscenes)) issues.push("cutscenes.yaml: cutscenes가 객체가 아니다.");
  if (!isPlainObject(stages)) issues.push("stages.yaml: stages가 객체가 아니다.");
  if (issues.length > 0) return issues;

  const memoryIds = memories.map((memory) => memory?.id);
  const scriptIds = new Set(Object.keys(scripts));
  const usedScriptIds = new Set();

  for (const [index, memory] of memories.entries()) {
    const where = `memories.yaml #${index + 1}`;

    if (!isPlainObject(memory)) {
      issues.push(`${where}: 항목이 객체가 아니다.`);
      continue;
    }
    for (const key of Object.keys(memory)) {
      if (!MEMORY_KEYS.includes(key)) {
        issues.push(`${where}: 모르는 키 "${key}" (쓸 수 있는 키: ${MEMORY_KEYS.join(", ")})`);
      }
    }

    const id = memory.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      issues.push(`${where}: id가 없거나 kebab-case가 아니다 (${JSON.stringify(id)}).`);
      continue;
    }
    if (memoryIds.indexOf(id) !== index) issues.push(`memories.yaml: id "${id}"가 중복된다.`);

    if (!ICONS.includes(memory.icon)) {
      issues.push(`${id}: icon "${memory.icon}"은 허용 목록에 없다 (scripts/content/schema.mjs).`);
    }

    validateLore(memory, issues);

    if (!isPlainObject(memory.phase1)) {
      issues.push(`${id}: phase1은 필수다 — 최초 수집이 없는 기억은 만들 수 없다.`);
    }

    for (const phase of ["phase1", "phase2"]) {
      const config = memory[phase];
      if (config === undefined) continue;
      if (!isPlainObject(config)) {
        issues.push(`${id}.${phase}: 객체가 아니다.`);
        continue;
      }
      validatePhase({
        id,
        phase,
        config,
        memoryIds,
        scriptIds,
        minigameIds,
        usedScriptIds,
        issues,
      });
    }
  }

  for (const [id, lines] of Object.entries(scripts)) {
    if (!ID_PATTERN.test(id)) issues.push(`scripts.yaml: id "${id}"가 kebab-case가 아니다.`);
    validateLines(lines, `scripts.${id}`, issues);
    if (!usedScriptIds.has(id)) {
      issues.push(`scripts.${id}: 아무 데서도 가리키지 않는다 — 죽은 대사는 남기지 않는다.`);
    }
  }

  for (const [id, cuts] of Object.entries(cutscenes)) {
    if (!ID_PATTERN.test(id)) issues.push(`cutscenes.yaml: id "${id}"가 kebab-case가 아니다.`);
    if (!Array.isArray(cuts) || cuts.length === 0) {
      issues.push(`cutscenes.${id}: 컷이 하나도 없다.`);
      continue;
    }
    for (const [index, cut] of cuts.entries()) {
      const where = `cutscenes.${id}.cut${index + 1}`;
      if (!isPlainObject(cut)) {
        issues.push(`${where}: 컷이 객체가 아니다.`);
        continue;
      }
      /*
       * 컷씬 일러스트는 아직 리포에 없어도 된다 — 없으면 회색 판이 자리를 지키고
       * 대사만 흐른다. 그래서 경로 모양만 보고 실재 여부는 묻지 않는다.
       */
      if (cut.image !== undefined) {
        if (typeof cut.image !== "string" || !/^\/assets\/images\/.+\.webp$/.test(cut.image)) {
          issues.push(`${where}.image: /assets/images/**.webp 형태여야 한다.`);
        }
      }
      if (cut.holdMs !== undefined && !(Number.isFinite(cut.holdMs) && cut.holdMs > 0)) {
        issues.push(`${where}: holdMs는 0보다 큰 숫자여야 한다.`);
      }
      validateLines(cut.lines, where, issues);
    }
  }

  for (const stageId of STAGE_IDS) {
    const stage = stages[stageId];
    if (!isPlainObject(stage)) {
      issues.push(`stages.${stageId}: 없다 — 방 단계는 ${STAGE_IDS.join("/")} 셋 다 있어야 한다.`);
      continue;
    }
    for (const field of ["monologue", "dialogue"]) {
      validateText(stage[field], `stages.${stageId}.${field}`, issues);
    }
  }
  for (const stageId of Object.keys(stages)) {
    if (!STAGE_IDS.includes(stageId)) issues.push(`stages.yaml: 모르는 단계 "${stageId}".`);
  }

  for (const phase of ["phase1", "phase2"]) {
    for (const cycle of findUnlockCycles(memories, phase)) {
      issues.push(`${phase}: 해금 조건이 순환한다 (${cycle}) — 여기 묶인 기억은 아무도 못 연다.`);
    }
  }

  return issues;
}

function validatePhase(context) {
  const { id, phase, config, memoryIds, scriptIds, minigameIds, usedScriptIds, issues } = context;
  const where = `${id}.${phase}`;

  for (const key of Object.keys(config)) {
    if (!PHASE_KEYS.includes(key)) {
      issues.push(`${where}: 모르는 키 "${key}" (쓸 수 있는 키: ${PHASE_KEYS.join(", ")})`);
    }
  }

  for (const field of ["script", "resultScript"]) {
    const scriptId = config[field];
    if (scriptId === undefined) continue;
    usedScriptIds.add(scriptId);
    if (!scriptIds.has(scriptId)) {
      issues.push(`${where}.${field}: scripts.yaml에 "${scriptId}"가 없다.`);
    }
  }

  if (config.minigame !== undefined && !minigameIds.includes(config.minigame)) {
    issues.push(
      `${where}.minigame: "${config.minigame}"이 레지스트리(src/minigames/index.ts)에 없다.`,
    );
  }
  if (config.resultScript !== undefined && config.minigame === undefined) {
    issues.push(`${where}: resultScript는 미니게임의 결과 대사라 minigame 없이는 못 쓴다.`);
  }

  if (config.unlockAfter !== undefined) {
    if (!Array.isArray(config.unlockAfter)) {
      issues.push(`${where}.unlockAfter: 목록이어야 한다.`);
    } else {
      for (const dependency of config.unlockAfter) {
        if (!memoryIds.includes(dependency)) {
          issues.push(`${where}.unlockAfter: "${dependency}"라는 기억이 없다.`);
        } else if (dependency === id) {
          issues.push(`${where}.unlockAfter: 자기 자신을 기다린다 — 영원히 안 열린다.`);
        }
      }
    }
  }

  if (config.replayStill !== undefined) validateAssetPath(config.replayStill, where, issues);
}

/** 같은 페이즈 안에서 해금 조건이 순환하면 그 기억들은 아무도 못 연다. */
export function findUnlockCycles(memories, phase) {
  const graph = new Map(
    memories
      .filter((memory) => isPlainObject(memory[phase]))
      .map((memory) => [memory.id, memory[phase].unlockAfter ?? []]),
  );
  const cycles = [];
  const state = new Map();

  const walk = (id, trail) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "walking") {
      cycles.push([...trail.slice(trail.indexOf(id)), id].join(" → "));
      return;
    }
    state.set(id, "walking");
    for (const dependency of graph.get(id) ?? []) {
      if (graph.has(dependency)) walk(dependency, [...trail, id]);
    }
    state.set(id, "done");
  };

  for (const id of graph.keys()) walk(id, []);
  return cycles;
}

function validateLore(memory, issues) {
  const { id, lore } = memory;
  if (!isPlainObject(lore)) {
    issues.push(`${id}.lore: 없다 — 수첩에 남길 기록은 모든 기억에 필요하다.`);
    return;
  }
  validateText(lore.title, `${id}.lore.title`, issues);
  validateText(lore.phase1, `${id}.lore.phase1`, issues);

  // 2바퀴 대상이면 그때의 기록도 있어야 한다 — 되짚었는데 1바퀴 문장이 다시 뜨면 안 된다
  if (memory.phase2 !== undefined) validateText(lore.phase2, `${id}.lore.phase2`, issues);
  else if (lore.phase2 !== undefined) {
    issues.push(`${id}.lore.phase2: phase2가 없는 기억인데 2바퀴 기록만 남아 있다.`);
  }
}

function validateLines(lines, where, issues) {
  if (!Array.isArray(lines) || lines.length === 0) {
    issues.push(`${where}: 대사가 한 줄도 없다.`);
    return;
  }
  for (const [index, line] of lines.entries()) {
    const at = `${where}.line${index + 1}`;
    if (!isPlainObject(line)) {
      issues.push(`${at}: 줄이 객체가 아니다.`);
      continue;
    }
    if (!SPEAKERS.includes(line.speaker)) {
      issues.push(`${at}: 화자 "${line.speaker}"는 허용 목록에 없다 (${SPEAKERS.join(", ")}).`);
    }
    if (line.expression !== undefined && !EXPRESSIONS.includes(line.expression)) {
      issues.push(`${at}: 표정 "${line.expression}"은 ${EXPRESSIONS.join("/")} 중 하나여야 한다.`);
    }
    validateText(line, at, issues);
  }
}

/** ko/en/ja가 전부 채워진 텍스트 묶음인지. */
function validateText(value, where, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${where}: ko/en/ja를 담은 항목이 아니다.`);
    return;
  }
  for (const locale of LOCALES) {
    const text = value[locale];
    if (typeof text !== "string" || text.trim() === "") {
      issues.push(`${where}: ${locale} 번역이 비어 있다.`);
    }
  }
}

/** public/ 아래 실재하는 파일을 가리키는지. 없는 그림은 회색 판으로 떨어진다. */
function validateAssetPath(value, where, issues) {
  if (typeof value !== "string" || !value.startsWith("/assets/")) {
    issues.push(`${where}: 에셋 경로는 /assets/ 로 시작해야 한다 (${JSON.stringify(value)}).`);
    return;
  }
  if (!existsSync(path.join(REPO_ROOT, "public", value))) {
    issues.push(`${where}: public${value} 파일이 리포에 없다.`);
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
