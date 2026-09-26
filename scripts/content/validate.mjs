import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./load.mjs";
import {
  BASE_LOCALE,
  CUT_KEYS,
  CUT_RATIOS,
  CUT_SFX,
  EXPRESSIONS,
  FROM_PHASES,
  ICONS,
  ID_PATTERN,
  LOCALES,
  MEMORY_KEYS,
  PHASE_KEYS,
  SPEAKERS,
  STAGE_IDS,
  VISIT_KEYS,
} from "./schema.mjs";

/**
 * 해금 조건 한 칸을 읽는다: `radio`(같은 차수) 또는 `computer@3`(그 기억의 3차 조사).
 *
 * 차수를 적지 않으면 **기다리는 쪽과 같은 차수**를 본다. 그 기억에 그 차수가 없으면
 * 그 아래로 가장 가까운 차수다 (2차에서 3차 전용 기억은 없으니, 3차 조사가 2차만 있는
 * 앰플을 기다리면 앰플의 2차다). 게임(src/data/visits.ts)이 같은 규칙을 쓴다.
 *
 * @returns {{id: string, visit: number | undefined}}
 */
export function parseDependency(entry) {
  const [id, visit] = String(entry).split("@");
  return { id, visit: visit === undefined ? undefined : Number(visit) };
}

/** 기억이 가진 차수 번호들 (1·2·3). */
function visitsOf(memory) {
  return VISIT_KEYS.map((key, index) => (memory?.[key] ? index + 1 : 0)).filter(Boolean);
}

/** 해금 조건 한 칸이 가리키는 실제 차수. 없으면 undefined. */
export function resolveDependencyVisit(memory, requestedVisit, dependentVisit) {
  const visits = visitsOf(memory);
  if (requestedVisit !== undefined)
    return visits.includes(requestedVisit) ? requestedVisit : undefined;
  return visits.filter((visit) => visit <= dependentVisit).at(-1) ?? visits[0];
}

/**
 * 콘텐츠 검증: 저장/생성 전에 걸러야 할 것들.
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

    /*
     * 페이즈가 하나도 없으면 아무 바퀴에서도 못 여는 기억이다. 반대로 phase1이
     * 없고 phase2만 있는 기억은 허용한다. 1바퀴 내내 잠겨 있다가 2바퀴에 처음
     * 열리는 물건(컴퓨터)이 그렇다. 그런 기억은 1바퀴 수집 개수에서도 빠진다
     * (src/data/memory-room.ts의 PHASE1_MEMORIES).
     */
    if (VISIT_KEYS.every((key) => memory[key] === undefined)) {
      issues.push(`${id}: 조사 차수가 하나도 없다. 어느 바퀴에서도 못 여는 기억은 만들 수 없다.`);
    }
    // 3차는 2차를 마친 뒤의 되짚기라 2차 없이 설 수 없다
    if (memory.phase3 !== undefined && memory.phase2 === undefined) {
      issues.push(`${id}.phase3: 2차(phase2)가 없는데 3차만 있다.`);
    }

    for (const phase of VISIT_KEYS) {
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
        memories,
        memoryIds,
        scriptIds,
        cutsceneIds: new Set(Object.keys(cutscenes)),
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
      issues.push(`scripts.${id}: 아무 데서도 가리키지 않는다. 죽은 대사는 남기지 않는다.`);
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
      for (const key of Object.keys(cut)) {
        if (!CUT_KEYS.includes(key)) {
          issues.push(`${where}: 모르는 키 "${key}" (쓸 수 있는 키: ${CUT_KEYS.join(", ")})`);
        }
      }
      if (cut.page !== undefined) {
        if (!(Number.isInteger(cut.page) && cut.page > 0)) {
          issues.push(`${where}.page: 1부터 세는 정수여야 한다.`);
        }
        if (cut.image === undefined)
          issues.push(`${where}.page: 웹툰 칸은 그림(image)이 있어야 선다.`);
        if (!CUT_RATIOS.includes(cut.ratio)) {
          issues.push(`${where}.ratio: 웹툰 칸은 ${CUT_RATIOS.join(" / ")} 중 하나여야 한다.`);
        }
        if (Array.isArray(cut.lines) && cut.lines.length > 1) {
          issues.push(`${where}: 웹툰 칸의 말풍선은 한 줄이다.`);
        }
      } else if (cut.ratio !== undefined) {
        issues.push(`${where}.ratio: 페이지(page)가 있는 웹툰 칸에만 쓴다.`);
      }
      if (cut.sfx !== undefined && !CUT_SFX.includes(cut.sfx)) {
        issues.push(`${where}.sfx: "${cut.sfx}"는 허용 목록에 없다 (${CUT_SFX.join(", ")}).`);
      }
      /*
       * 컷씬 일러스트는 아직 리포에 없어도 된다. 없으면 회색 판이 자리를 지키고
       * 대사만 흐른다. 그래서 경로 모양만 보고 실재 여부는 묻지 않는다.
       */
      if (cut.image !== undefined) {
        // 같은 파일을 새 그림으로 바꾸면 ?v=를 올린다: 서비스 워커가 에셋을 캐시 우선으로 읽는다
        if (
          typeof cut.image !== "string" ||
          !/^\/assets\/images\/[^?]+\.webp(\?v=[\w.-]+)?$/.test(cut.image)
        ) {
          issues.push(`${where}.image: /assets/images/**.webp(?v=버전) 형태여야 한다.`);
        }
      }
      if (cut.narration !== undefined && typeof cut.narration !== "boolean") {
        issues.push(`${where}.narration: true/false여야 한다.`);
      }
      if (cut.black !== undefined && typeof cut.black !== "boolean") {
        issues.push(`${where}.black: true/false여야 한다.`);
      }
      // 검정 화면은 그림의 자리를 비우는 컷이다. 그림이나 웹툰 칸과 같이 서지 않는다
      if (cut.black === true && (cut.image !== undefined || cut.page !== undefined)) {
        issues.push(`${where}.black: 검정 화면 컷에는 image·page를 같이 쓸 수 없다.`);
      }
      if (cut.narration === true && Array.isArray(cut.lines) && cut.lines.length === 0) {
        issues.push(`${where}.narration: 내레이션 컷은 대사가 있어야 한다.`);
      }
      if (cut.holdMs !== undefined && !(Number.isFinite(cut.holdMs) && cut.holdMs > 0)) {
        issues.push(`${where}: holdMs는 0보다 큰 숫자여야 한다.`);
      }
      // 대사 없는 컷은 정적(holdMs)으로만 설 수 있다. 둘 다 없으면 넘길 방법이 없다
      if (Array.isArray(cut.lines) && cut.lines.length === 0) {
        if (!(cut.holdMs > 0)) issues.push(`${where}: 대사가 없는 컷은 holdMs가 있어야 넘어간다.`);
      } else {
        validateLines(cut.lines, where, issues);
      }
    }
    validateWebtoonPages(id, cuts, issues);
  }

  for (const stageId of STAGE_IDS) {
    const stage = stages[stageId];
    if (!isPlainObject(stage)) {
      issues.push(`stages.${stageId}: 없다. 독백 구간은 ${STAGE_IDS.join("/")} 전부 있어야 한다.`);
      continue;
    }
    validateText(stage.monologue, `stages.${stageId}.monologue`, issues);
  }
  for (const stageId of Object.keys(stages)) {
    if (!STAGE_IDS.includes(stageId)) issues.push(`stages.yaml: 모르는 독백 구간 "${stageId}".`);
  }

  for (const cycle of findUnlockCycles(memories)) {
    issues.push(`해금 조건이 순환한다 (${cycle}): 여기 묶인 조사는 아무도 못 연다.`);
  }

  return issues;
}

function validatePhase(context) {
  const {
    id,
    phase,
    config,
    memories,
    memoryIds,
    scriptIds,
    cutsceneIds,
    minigameIds,
    usedScriptIds,
    issues,
  } = context;
  const where = `${id}.${phase}`;
  const visit = VISIT_KEYS.indexOf(phase) + 1;

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
      for (const entry of config.unlockAfter) {
        const dependency = parseDependency(entry);
        const target = memories.find((memory) => memory?.id === dependency.id);
        if (!memoryIds.includes(dependency.id)) {
          issues.push(`${where}.unlockAfter: "${dependency.id}"라는 기억이 없다.`);
        } else if (
          dependency.visit !== undefined &&
          resolveDependencyVisit(target, dependency.visit, visit) === undefined
        ) {
          issues.push(
            `${where}.unlockAfter: "${dependency.id}"에는 ${dependency.visit}차 조사가 없다.`,
          );
        } else if (dependency.id === id) {
          issues.push(`${where}.unlockAfter: 자기 자신을 기다린다. 영원히 안 열린다.`);
        }
      }
    }
  }

  if (config.from !== undefined) {
    if (phase === "phase1") {
      issues.push(`${where}.from: 1차 조사는 늘 p1에 열린다. from은 2차부터 쓴다.`);
    } else if (!FROM_PHASES.includes(config.from)) {
      issues.push(`${where}.from: ${FROM_PHASES.join("/")} 중 하나여야 한다.`);
    }
  } else if (phase !== "phase1") {
    issues.push(`${where}.from: 2차 이후 조사는 어느 페이즈부터 열리는지 적어야 한다.`);
  }
  if (config.side !== undefined && typeof config.side !== "boolean") {
    issues.push(`${where}.side: true/false여야 한다.`);
  }
  if (config.cutscene !== undefined && !cutsceneIds.has(config.cutscene)) {
    issues.push(`${where}.cutscene: cutscenes.yaml에 "${config.cutscene}"가 없다.`);
  }

  if (config.replayStill !== undefined) validateAssetPath(config.replayStill, where, issues);
}

/**
 * 해금 조건이 순환하면 그 조사들은 아무도 못 연다. 차수를 넘나드는 조건
 * (`computer@3`)이 있어서 그래프의 마디는 "기억 · 차수" 한 쌍이다. 같은 기억의
 * N차는 늘 N-1차 뒤라 그 간선도 함께 잇는다.
 */
export function findUnlockCycles(memories) {
  const valid = memories.filter((memory) => isPlainObject(memory));
  const byId = new Map(valid.map((memory) => [memory.id, memory]));
  const graph = new Map();
  for (const memory of valid) {
    const visits = visitsOf(memory);
    for (const visit of visits) {
      const config = memory[VISIT_KEYS[visit - 1]];
      const edges = [];
      const previous = visits.filter((other) => other < visit).at(-1);
      if (previous !== undefined) edges.push(`${memory.id}@${previous}`);
      for (const entry of Array.isArray(config?.unlockAfter) ? config.unlockAfter : []) {
        const dependency = parseDependency(entry);
        const target = byId.get(dependency.id);
        if (!target) continue;
        const resolved = resolveDependencyVisit(target, dependency.visit, visit);
        if (resolved !== undefined) edges.push(`${dependency.id}@${resolved}`);
      }
      graph.set(`${memory.id}@${visit}`, edges);
    }
  }

  const cycles = [];
  const state = new Map();
  const walk = (node, trail) => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "walking") {
      cycles.push([...trail.slice(trail.indexOf(node)), node].join(" → "));
      return;
    }
    state.set(node, "walking");
    for (const next of graph.get(node) ?? []) {
      if (graph.has(next)) walk(next, [...trail, node]);
    }
    state.set(node, "done");
  };

  for (const node of graph.keys()) walk(node, []);
  return cycles;
}

/**
 * 웹툰 컷씬(page가 붙은 컷)의 모양. 페이지는 1부터 차례로 늘고, 페이지 안에서 3:4 칸은
 * 둘씩 나란히 한 줄을 이룬다. 페이지 없는 컷은 맨 뒤에만 설 수 있다: 웹툰이 걷힌 뒤
 * 방에서 흐르는 한마디(생존자 방송 뒤 도해의 반응)다.
 */
function validateWebtoonPages(id, cuts, issues) {
  const paged = cuts.map((cut) => isPlainObject(cut) && cut.page !== undefined);
  if (!paged.some(Boolean)) return;
  const where = `cutscenes.${id}`;
  const firstLoose = paged.indexOf(false);
  if (firstLoose !== -1 && paged.slice(firstLoose).some(Boolean)) {
    issues.push(`${where}: 페이지 없는 컷은 웹툰 칸들 뒤에만 올 수 있다.`);
  }
  let page = 0;
  let tallRun = 0;
  for (const [index, cut] of cuts.entries()) {
    if (!paged[index]) break;
    if (cut.page !== page) {
      if (tallRun % 2 !== 0) issues.push(`${where}: ${page}페이지의 3:4 칸이 짝이 안 맞는다.`);
      if (cut.page !== page + 1)
        issues.push(`${where}.cut${index + 1}: 페이지는 1부터 차례로 는다.`);
      page = cut.page;
      tallRun = 0;
    }
    if (cut.ratio === "3:4") tallRun += 1;
    else if (tallRun % 2 !== 0) {
      issues.push(`${where}.cut${index + 1}: 앞의 3:4 칸이 짝 없이 혼자 남았다.`);
      tallRun = 0;
    }
  }
  if (tallRun % 2 !== 0) issues.push(`${where}: ${page}페이지의 3:4 칸이 짝이 안 맞는다.`);
}

function validateLore(memory, issues) {
  const { id, lore } = memory;
  if (!isPlainObject(lore)) {
    issues.push(`${id}.lore: 없다. 수첩에 남길 기록은 모든 기억에 필요하다.`);
    return;
  }
  validateText(lore.title, `${id}.lore.title`, issues);

  /*
   * 기록은 페이즈와 1:1이다. 그 바퀴가 있으면 그때의 문장도 있어야 하고(되짚었는데
   * 앞 바퀴 문장이 다시 뜨면 안 된다), 없는 바퀴의 문장은 아무 데서도 안 뜬다.
   */
  for (const phase of VISIT_KEYS) {
    if (memory[phase] !== undefined) {
      validateText(lore[phase], `${id}.lore.${phase}`, issues);
    } else if (lore[phase] !== undefined) {
      issues.push(`${id}.lore.${phase}: ${phase}가 없는 기억인데 그 바퀴 기록만 남아 있다.`);
    }
    // 그 차수부터 바뀌는 제목 (예: 라디오 2차의 "은강고"). 없으면 title을 쓴다
    const titleKey = `${phase}Title`;
    if (lore[titleKey] !== undefined) {
      if (memory[phase] === undefined) {
        issues.push(`${id}.lore.${titleKey}: ${phase}가 없는 기억인데 그 바퀴 제목만 남아 있다.`);
      } else {
        validateText(lore[titleKey], `${id}.lore.${titleKey}`, issues);
      }
    }
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

/**
 * 텍스트 묶음인지. 기준 언어(ko)는 반드시 있어야 하고, 나머지 언어는 비어 있어도
 * 막지 않는다. 빈 번역은 countTranslationTodos가 따로 센다.
 */
function validateText(value, where, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${where}: ko/en/ja를 담은 항목이 아니다.`);
    return;
  }
  if (!hasText(value[BASE_LOCALE])) issues.push(`${where}: ${BASE_LOCALE} 문장이 비어 있다.`);
  for (const locale of LOCALES) {
    const text = value[locale];
    if (text !== undefined && text !== null && typeof text !== "string") {
      issues.push(`${where}: ${locale} 값이 문자열이 아니다.`);
    }
  }
}

function hasText(text) {
  return typeof text === "string" && text.trim() !== "";
}

/**
 * 아직 번역이 비어 있는 자리 (언어 · 위치). 막지는 않고 알리기만 한다.
 *
 * @returns {string[]} "en scripts.radio-intro.line1" 같은 목록
 */
export function countTranslationTodos(content) {
  const todos = [];
  const visit = (value, where) => {
    if (!isPlainObject(value)) return;
    for (const locale of LOCALES) {
      if (locale !== BASE_LOCALE && !hasText(value[locale])) todos.push(`${locale} ${where}`);
    }
  };
  for (const memory of content.memories ?? []) {
    if (!isPlainObject(memory?.lore)) continue;
    visit(memory.lore.title, `${memory.id}.lore.title`);
    for (const key of VISIT_KEYS) {
      visit(memory.lore[key], `${memory.id}.lore.${key}`);
      visit(memory.lore[`${key}Title`], `${memory.id}.lore.${key}Title`);
    }
  }
  for (const [id, lines] of Object.entries(content.scripts ?? {})) {
    for (const [index, line] of (lines ?? []).entries())
      visit(line, `scripts.${id}.line${index + 1}`);
  }
  for (const [id, cuts] of Object.entries(content.cutscenes ?? {})) {
    for (const [cutIndex, cut] of (cuts ?? []).entries()) {
      for (const [index, line] of (cut?.lines ?? []).entries()) {
        visit(line, `cutscenes.${id}.cut${cutIndex + 1}.line${index + 1}`);
      }
    }
  }
  for (const [id, stage] of Object.entries(content.stages ?? {}))
    visit(stage?.monologue, `stages.${id}`);
  return todos;
}

/** public/ 아래 실재하는 파일을 가리키는지. 없는 그림은 회색 판으로 떨어진다. */
function validateAssetPath(value, where, issues) {
  if (typeof value !== "string" || !value.startsWith("/assets/")) {
    issues.push(`${where}: 에셋 경로는 /assets/ 로 시작해야 한다 (${JSON.stringify(value)}).`);
    return;
  }
  const filePath = value.split(/[?#]/, 1)[0];
  if (!existsSync(path.join(REPO_ROOT, "public", filePath))) {
    issues.push(`${where}: public${value} 파일이 리포에 없다.`);
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
