import { formatSource } from "./format.mjs";
import { LOCALES } from "./schema.mjs";

/**
 * 콘텐츠 → 생성물.
 *
 * 두 갈래로 나간다:
 *   1. src/data/generated/content.ts — 흐름 데이터. 본문은 안 들어가고 textKey만 담는다
 *      (.claude/rules/visual-novel.md — 대사 본문은 시나리오 데이터에 넣지 않는다).
 *   2. src/i18n/locales/<lng>/memory-room.json — 본문. 손으로 쓰는 부분(characters,
 *      memories 이름)은 같은 폴더의 memory-room.base.json에서 그대로 얹는다.
 *
 * 생성물은 리포에 커밋된다 — 프로덕션 빌드가 YAML을 몰라도 되게 하려는 것이다.
 * YAML과 어긋나면 `pnpm content:check`(그리고 content.generated 테스트)가 잡는다.
 */
export function emitAll(content, bases) {
  return {
    module: emitModule(content),
    locales: Object.fromEntries(
      LOCALES.map((locale) => [locale, emitLocale(content, bases[locale], locale)]),
    ),
  };
}

const HEADER = `/**
 * 이 파일은 생성물이다 — 직접 고치지 말 것.
 *
 * 원본은 content/*.yaml, 생성은 \`pnpm content:build\` (dev 서버의 /admin에서
 * 저장해도 같은 것이 돈다). 손으로 고치면 다음 생성 때 그대로 덮인다.
 */
`;

function emitModule(content) {
  const { memories, scripts, cutscenes } = content;
  const icons = [...new Set(memories.map((memory) => memory.icon))].sort();

  const lines = [
    HEADER,
    // import 순서는 Biome의 organizeImports가 정렬한 결과와 같아야 한다 — 포맷터는
    // 줄바꿈만 손보지 순서는 안 고쳐서, 어긋나면 lint가 생성물을 걸고넘어진다
    `import { ${icons.join(", ")} } from "@phosphor-icons/react";`,
    'import type { MemoryIcon } from "@/components/ui/icons";',
    'import type { Cutscene, DialogueScript, MemoryPhaseConfig } from "@/types/interaction";',
    "",
    "/** 기억 id — content/memories.yaml에 적힌 순서 그대로. 패널에도 이 순서로 뜬다. */",
    `export const MEMORY_IDS = [${memories.map((m) => JSON.stringify(m.id)).join(", ")}] as const;`,
    "",
    "export type MemoryId = (typeof MEMORY_IDS)[number];",
    "",
    "export interface MemoryItem {",
    "  id: MemoryId;",
    "  /** 수집 패널에 표시할 아이콘 (Phosphor 또는 호환 커스텀) */",
    "  icon: MemoryIcon;",
    "  /** Phase 1: 최초 수집 클릭. 모든 아이템 필수. */",
    "  phase1: MemoryPhaseConfig;",
    "  /** Phase 2: 전원 수집 후 재클릭. 있는 아이템만 재클릭 대상. */",
    "  phase2?: MemoryPhaseConfig;",
    "}",
    "",
    "export const MEMORIES: MemoryItem[] = [",
  ];

  for (const memory of memories) {
    lines.push("  {");
    lines.push(`    id: ${JSON.stringify(memory.id)},`);
    lines.push(`    icon: ${memory.icon},`);
    for (const phase of ["phase1", "phase2"]) {
      if (!memory[phase]) continue;
      lines.push(`    ${phase}: ${phaseLiteral(memory[phase])},`);
    }
    lines.push("  },");
  }

  lines.push("];", "");
  lines.push("/** 대사 스크립트 레지스트리 — 본문은 i18n 리소스(memoryRoom.scripts.*)에 있다. */");
  lines.push("export const SCRIPTS: Record<string, DialogueScript> = {");
  for (const [id, scriptLines] of Object.entries(scripts)) {
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    id: ${JSON.stringify(id)},`);
    lines.push("    lines: [");
    for (const line of lineLiterals(scriptLines, `scripts.${id}`)) lines.push(`      ${line},`);
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("};", "");

  lines.push("export const CUTSCENES: Record<string, Cutscene> = {");
  for (const [id, cuts] of Object.entries(cutscenes)) {
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    id: ${JSON.stringify(id)},`);
    lines.push("    cuts: [");
    for (const [index, cut] of cuts.entries()) {
      const cutKey = `cutscenes.${id}.cut${index + 1}`;
      lines.push("      {");
      if (cut.image !== undefined) lines.push(`        image: ${JSON.stringify(cut.image)},`);
      if (cut.holdMs !== undefined) lines.push(`        holdMs: ${cut.holdMs},`);
      lines.push("        lines: [");
      for (const line of lineLiterals(cut.lines, cutKey)) lines.push(`          ${line},`);
      lines.push("        ],");
      lines.push("      },");
    }
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("};", "");

  return formatSource("src/data/generated/content.ts", lines.join("\n"));
}

function phaseLiteral(config) {
  const interaction = [
    config.script !== undefined ? `scriptId: ${JSON.stringify(config.script)}` : null,
    config.minigame !== undefined ? `minigameId: ${JSON.stringify(config.minigame)}` : null,
    config.resultScript !== undefined
      ? `resultScriptId: ${JSON.stringify(config.resultScript)}`
      : null,
  ].filter(Boolean);

  const fields = [
    interaction.length > 0 ? `interaction: { ${interaction.join(", ")} }` : null,
    config.unlockAfter !== undefined
      ? `unlockAfter: [${config.unlockAfter.map((id) => JSON.stringify(id)).join(", ")}]`
      : null,
    config.replayStill !== undefined ? `replayStill: ${JSON.stringify(config.replayStill)}` : null,
  ].filter(Boolean);

  return fields.length > 0 ? `{ ${fields.join(", ")} }` : "{}";
}

function lineLiterals(lines, keyPrefix) {
  return lines.map((line, index) => {
    const fields = [
      `speaker: ${JSON.stringify(line.speaker)}`,
      `textKey: ${JSON.stringify(`${keyPrefix}.line${index + 1}`)}`,
    ];
    if (line.expression !== undefined && line.expression !== "neutral") {
      fields.push(`expression: ${JSON.stringify(line.expression)}`);
    }
    return `{ ${fields.join(", ")} }`;
  });
}

/**
 * 한 언어의 memory-room.json. base(손으로 쓰는 부분) 위에 생성 섹션을 얹는다.
 *
 * 키는 기존 것을 그대로 유지한다 — scripts.<id>.line<N>, lore.<id>.phase<N>은
 * store와 테스트가 문자열로 조립해서 쓰기 때문에 형태를 바꾸면 조용히 깨진다.
 */
function emitLocale(content, base, locale) {
  const { memories, scripts, cutscenes, stages } = content;
  const pick = (text) => text[locale];

  const resource = {
    ...structuredClone(base ?? {}),
    stages: Object.fromEntries(
      Object.entries(stages).map(([id, stage]) => [
        id,
        { monologue: pick(stage.monologue), dialogue: pick(stage.dialogue) },
      ]),
    ),
    scripts: Object.fromEntries(
      Object.entries(scripts).map(([id, lines]) => [id, numberedLines(lines, pick)]),
    ),
    lore: Object.fromEntries(
      memories.map((memory) => [
        memory.id,
        {
          title: pick(memory.lore.title),
          phase1: pick(memory.lore.phase1),
          ...(memory.lore.phase2 ? { phase2: pick(memory.lore.phase2) } : {}),
        },
      ]),
    ),
    cutscenes: Object.fromEntries(
      Object.entries(cutscenes).map(([id, cuts]) => [
        id,
        Object.fromEntries(
          cuts.map((cut, index) => [`cut${index + 1}`, numberedLines(cut.lines, pick)]),
        ),
      ]),
    ),
  };

  return `${JSON.stringify(resource, null, 2)}\n`;
}

function numberedLines(lines, pick) {
  return Object.fromEntries(lines.map((line, index) => [`line${index + 1}`, pick(line)]));
}
