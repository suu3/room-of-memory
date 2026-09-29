"use client";

/**
 * 대본·흐름 편집기: 로컬 dev 서버 전용.
 *
 * content/*.yaml을 통째로 받아 고치고 통째로 돌려준다. 저장은 서버가 검증을
 * 먼저 돌리고 통과할 때만 파일을 쓴다. 여기서 통과한 것이 CI에서 떨어지는 일이
 * 없도록 `pnpm content:build`와 같은 검증기를 쓴다.
 *
 * 기억 id는 여기서 못 고친다. id는 3D 씬의 오브젝트 이름, 에셋 파일명,
 * i18n의 memories.<id>.name까지 걸쳐 있어서 편집기 혼자 바꿀 수 있는 값이 아니다.
 *
 * 흐름 탭은 id만 세우지 않는다. 대사는 id가 아니라 본문으로 기억되는 것이라
 * 고른 스크립트의 줄을 그 자리에 펼쳐 두고, ①②③ 번호로 재생 순서를 박아 둔다.
 * 카드 앞의 번호는 목록 순번이 아니라 **열리는 차례**다. 같은 번호는 같이 열린다.
 */
import { useCallback, useEffect, useState } from "react";
import {
  CONTENT_LOCALES,
  type ContentCut,
  type ContentLine,
  type ContentMemory,
  type ContentOptions,
  type ContentPhase,
  type GameContent,
  type LocalizedText,
  type SaveResult,
} from "@/types/content";
import {
  Button,
  Card,
  CollapseAll,
  Field,
  faintClass,
  hintClass,
  LocalizedInput,
  labelClass,
  mutedClass,
  panelClass,
  Select,
  sunkenClass,
  TextInput,
  useCollapsible,
} from "./fields";

const TABS = [
  { id: "flow", label: "흐름" },
  { id: "scripts", label: "대사" },
  { id: "cutscenes", label: "컷씬" },
  { id: "lore", label: "기록 · 독백" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** 해금이 갈리는 단위. 1바퀴와 2바퀴는 서로 다른 그래프다. */
type Round = "phase1" | "phase2";

const EMPTY_TEXT: LocalizedText = { ko: "", en: "", ja: "" };

/** 미리보기는 기준 언어(ko)만 세운다. 셋을 다 세우면 흐름이 안 보인다. */
const PREVIEW_LOCALE = "ko";

export function ContentAdmin() {
  const [content, setContent] = useState<GameContent | null>(null);
  const [options, setOptions] = useState<ContentOptions | null>(null);
  const [tab, setTab] = useState<TabId>("flow");
  const [issues, setIssues] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/admin/api")
      .then((response) => response.json())
      .then((data: { content: GameContent; options: ContentOptions }) => {
        setContent(data.content);
        setOptions(data.options);
      })
      .catch((error: Error) => setIssues([`콘텐츠를 읽지 못했다: ${error.message}`]));
  }, []);

  const edit = useCallback((next: GameContent) => {
    setContent(next);
    setDirty(true);
    setStatus("");
  }, []);

  // 저장하지 않고 새로고침하면 편집분이 그대로 날아간다. 브라우저에 한 번 물어보게 한다
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!content) return;
    setSaving(true);
    setStatus("저장 중…");

    try {
      const response = await fetch("/admin/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(content),
      });
      const result = (await response.json()) as SaveResult;

      setIssues(result.issues);
      if (result.ok) {
        setDirty(false);
        setStatus(`저장 완료: ${result.written.length}개 파일. 게임 탭을 새로고침하면 반영된다.`);
      } else {
        setStatus("저장하지 않았다. 아래 문제를 고칠 것.");
      }
    } catch (error) {
      setIssues([`저장 요청이 실패했다: ${(error as Error).message}`]);
      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  if (!content || !options) {
    return (
      <p className={`p-8 ${mutedClass}`}>
        {issues.length > 0 ? issues.join("\n") : "content/*.yaml 읽는 중…"}
      </p>
    );
  }

  const scriptIds = Object.keys(content.scripts);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-medium text-2xl">대본 · 흐름 편집기</h1>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            content/*.yaml을 고친다. 저장하면 생성물(src/data/generated, i18n 리소스)까지 같이
            갱신된다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-[var(--admin-warn)] text-sm">저장 안 된 변경</span> : null}
          <Button tone="primary" onClick={save} disabled={saving || !dirty}>
            저장
          </Button>
        </div>
      </header>

      {status ? <p className={`text-sm ${mutedClass}`}>{status}</p> : null}

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-[var(--admin-warn-line)] bg-[var(--admin-warn-soft)] p-4 text-sm">
          {issues.map((issue) => (
            <li key={issue}>· {issue}</li>
          ))}
        </ul>
      ) : null}

      <nav className="flex gap-2 border-[var(--admin-line)] border-b">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === entry.id
                ? "border-[var(--admin-accent)] font-medium text-[var(--admin-accent)]"
                : `border-transparent ${mutedClass} hover:text-[var(--admin-ink)]`
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "flow" ? (
        <FlowTab content={content} options={options} scriptIds={scriptIds} onChange={edit} />
      ) : null}
      {tab === "scripts" ? (
        <ScriptsTab content={content} options={options} onChange={edit} />
      ) : null}
      {tab === "cutscenes" ? (
        <CutscenesTab content={content} options={options} onChange={edit} />
      ) : null}
      {tab === "lore" ? <LoreTab content={content} onChange={edit} /> : null}
    </div>
  );
}

/* ── 해금 차례 ────────────────────────────────────────────────────────── */

/**
 * 한 바퀴 안에서 각 기억이 몇 번째로 열리는지. **같은 번호는 동시에 열린다**.
 * unlockAfter가 없는 것들이 다 같이 1번이고, 1번만 기다리는 것이 2번이다.
 * 목록 순서(↑↓)와는 상관이 없다: 그건 기억 패널에 뜨는 차례일 뿐이다.
 *
 * 순환은 검증기(findUnlockCycles)가 저장에서 막지만, 편집 도중에는 한때 순환이
 * 생길 수 있다. 그 한때에 무한 재귀로 화면이 죽지 않도록 지나온 id는 다시 세지
 * 않는다.
 */
function unlockWaves(memories: ContentMemory[], round: Round): Map<string, number> {
  const inRound = memories.filter((memory) => memory[round]);
  const phaseById = new Map(inRound.map((memory) => [memory.id, memory[round] as ContentPhase]));
  const waves = new Map<string, number>();

  const waveOf = (id: string, trail: Set<string>): number => {
    const known = waves.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 1;

    // 이 바퀴에 없는 기억을 기다리는 것은 차례를 셀 수 없다. 그건 검증기가 잡는다
    const deps = (phaseById.get(id)?.unlockAfter ?? []).filter((dep) => phaseById.has(dep));
    const walked = new Set(trail).add(id);
    const wave = deps.length === 0 ? 1 : Math.max(...deps.map((dep) => waveOf(dep, walked))) + 1;

    waves.set(id, wave);
    return wave;
  };

  for (const memory of inRound) waveOf(memory.id, new Set());
  return waves;
}

/** 몇 번째로 열리는지. 같은 번호끼리 동시에 열린다. */
function WaveBadge({ wave, round }: { wave: number | undefined; round: Round }) {
  const label = round === "phase1" ? "1바퀴" : "2바퀴";

  if (wave === undefined) {
    return (
      <span
        title={`${label}에는 없는 기억이다`}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--admin-line)] text-xs ${faintClass}`}
      >
        -
      </span>
    );
  }

  return (
    <span
      title={`${label}에서 ${wave}번째로 열린다. 같은 번호끼리 동시에 열린다`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--admin-accent-line)] bg-[var(--admin-accent-soft)] font-medium text-[var(--admin-accent)] text-xs"
    >
      {wave}
    </span>
  );
}

/* ── 공용 조각 ────────────────────────────────────────────────────────── */

/** 카드 제목: 열리는 차례 · id · 수첩 제목. id만 있으면 무엇이었는지 매번 다시 떠올려야 한다. */
function MemoryTitle({ memory, wave }: { memory: ContentMemory; wave: number | undefined }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <WaveBadge wave={wave} round="phase1" />
      <span className="font-mono">{memory.id}</span>
      <span className={`truncate text-sm ${mutedClass}`}>{memory.lore.title[PREVIEW_LOCALE]}</span>
    </span>
  );
}

/** 고른 스크립트의 줄을 그 자리에 펼친다. 대사창에 실제로 흐를 순서 그대로. */
function ScriptPreview({ lines }: { lines: ContentLine[] | undefined }) {
  if (!lines || lines.length === 0) {
    return <p className={`mt-2 ${hintClass}`}>줄이 없는 스크립트다.</p>;
  }

  return (
    <ol className={`mt-2 flex flex-col gap-1.5 px-3 py-2 ${sunkenClass}`}>
      {lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 줄의 정체성은 순서 그 자체다
        <li key={index} className="flex gap-2 text-xs">
          <span className={`w-4 shrink-0 text-right ${faintClass}`}>{index + 1}</span>
          <span className={`w-20 shrink-0 font-mono ${mutedClass}`}>{line.speaker}</span>
          <span className="min-w-0">
            {line[PREVIEW_LOCALE]?.trim() || "(본문이 비어 있다. 저장이 막힌다)"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 스크립트 고르는 목록에도 첫 줄을 붙인다. id만으로는 어느 대사인지 안 갈린다. */
function scriptOptionLabel(id: string, scripts: GameContent["scripts"]): string {
  const first = scripts[id]?.[0]?.[PREVIEW_LOCALE]?.trim();
  if (!first) return id;
  const head = first.length > 34 ? `${first.slice(0, 34)}…` : first;
  return `${id}: ${head}`;
}

/** 접힌 카드에 남길 한 줄: 이 바퀴에 무엇이 붙어 있는지. */
function phaseDigest(phase: ContentPhase | undefined): string | null {
  if (!phase) return null;
  const parts = [
    phase.script ? "대사" : null,
    phase.minigame ? "미니게임" : null,
    phase.resultScript ? "결과 대사" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "바로 수집";
}

/* ── 대사 검색 ────────────────────────────────────────────────────────── */

/** 검색어를 비교할 모양으로. 대소문자만 접는다 (한글·가나는 그대로). */
function searchKey(query: string): string {
  return query.trim().toLowerCase();
}

/** 줄 하나가 검색어에 걸리는가. 세 언어 본문과 화자를 다 본다. 빈 검색어는 아무것도 안 건다. */
function lineMatches(line: ContentLine, key: string): boolean {
  if (!key) return false;
  if (line.speaker.toLowerCase().includes(key)) return true;
  return CONTENT_LOCALES.some((locale) => line[locale]?.toLowerCase().includes(key));
}

/** 줄 편집 칸의 테두리. 검색에 걸린 줄은 강조색으로 선다. */
function lineBoxClass(hit: boolean): string {
  return hit
    ? "rounded-sm border border-[var(--admin-accent)] bg-[var(--admin-accent-soft)] p-3"
    : "rounded-sm border border-[var(--admin-line)] p-3";
}

/** 검색칸 + 걸린 개수. 대사·컷씬 탭이 같이 쓴다. */
function SearchBar({
  value,
  onChange,
  result,
}: {
  value: string;
  onChange: (value: string) => void;
  result: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-64 flex-1">
        <TextInput
          value={value}
          placeholder="대사 검색: 본문(ko/en/ja) · 화자 · id"
          onChange={onChange}
        />
      </div>
      {result ? <span className={`text-sm ${mutedClass}`}>{result}</span> : null}
      {value ? <Button onClick={() => onChange("")}>지우기</Button> : null}
    </div>
  );
}

/* ── 흐름 ─────────────────────────────────────────────────────────────── */

function FlowTab({
  content,
  options,
  scriptIds,
  onChange,
}: {
  content: GameContent;
  options: ContentOptions;
  scriptIds: string[];
  onChange: (next: GameContent) => void;
}) {
  const cards = useCollapsible(false);

  const setMemory = (index: number, memory: ContentMemory) => {
    const memories = [...content.memories];
    memories[index] = memory;
    onChange({ ...content, memories });
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= content.memories.length) return;
    const memories = [...content.memories];
    [memories[index], memories[target]] = [memories[target], memories[index]];
    onChange({ ...content, memories });
  };

  const waves = {
    phase1: unlockWaves(content.memories, "phase1"),
    phase2: unlockWaves(content.memories, "phase2"),
  };
  const ids = content.memories.map((memory) => memory.id);

  return (
    <div className="flex flex-col gap-4">
      <div className={`${panelClass} p-4 text-sm ${mutedClass}`}>
        <p>
          카드 앞의 번호는{" "}
          <strong className="font-medium text-[var(--admin-ink)]">몇 번째로 열리는가</strong>다.{" "}
          <strong className="font-medium text-[var(--admin-ink)]">같은 번호는 동시에 열린다</strong>
          . 아래 &ldquo;먼저 조사해야 열림&rdquo;이 이 번호를 정한다. ↑↓는 번호가 아니라 기억 패널에
          뜨는 자리(총 {content.memories.length}개)를 바꾼다.
        </p>
        <p className="mt-2">
          기억 하나를 누르면{" "}
          <strong className="font-medium text-[var(--admin-ink)]">
            ① 대사 → ② 미니게임 → ③ 대사
          </strong>{" "}
          순으로 흐른다. 비운 칸은 건너뛰고, 셋 다 비면 누르는 즉시 수집된다. id는 3D 씬·에셋·i18n
          이름까지 걸쳐 있어 편집기에서 바꾸지 않는다.
        </p>
      </div>

      <div className="flex justify-end">
        <CollapseAll
          onExpand={() => cards.setAll(ids, true)}
          onCollapse={() => cards.setAll(ids, false)}
        />
      </div>

      {content.memories.map((memory, index) => (
        <Card
          key={memory.id}
          open={cards.isOpen(memory.id)}
          onToggle={() => cards.toggle(memory.id)}
          title={<MemoryTitle memory={memory} wave={waves.phase1.get(memory.id)} />}
          summary={
            <>
              {memory.phase1 ? `1바퀴 ${phaseDigest(memory.phase1)}` : "1바퀴 없음"}
              {memory.phase2 ? ` / 2바퀴 ${phaseDigest(memory.phase2)}` : ""}
            </>
          }
          actions={
            <>
              <span className={`text-xs ${mutedClass}`} title="기억 패널에 뜨는 자리">
                패널 {index + 1}
              </span>
              <Button onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </Button>
              <Button
                onClick={() => move(index, 1)}
                disabled={index === content.memories.length - 1}
              >
                ↓
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="max-w-xs">
              <Field label="아이콘">
                <Select
                  value={memory.icon}
                  options={options.icons}
                  onChange={(icon) => setMemory(index, { ...memory, icon: icon ?? memory.icon })}
                />
              </Field>
            </div>

            {/*
              1바퀴가 없는 기억은 2바퀴 전용이다. 1바퀴 내내 잠겨 있고 수집
              개수에서도 빠진다. 둘 다 없애면 저장이 막히므로 마지막 하나는
              제거 버튼이 안 뜬다.
            */}
            {memory.phase1 ? (
              <PhaseEditor
                label="1바퀴 (최초 수집)"
                round="phase1"
                phase={memory.phase1}
                memory={memory}
                memories={content.memories}
                waves={waves.phase1}
                scripts={content.scripts}
                options={options}
                scriptIds={scriptIds}
                onRemove={
                  memory.phase2
                    ? () => {
                        const { phase1: _dropped, lore, ...rest } = memory;
                        const { phase1: _loreDropped, ...loreRest } = lore;
                        setMemory(index, { ...rest, lore: loreRest });
                      }
                    : undefined
                }
                onChange={(phase1) => setMemory(index, { ...memory, phase1 })}
              />
            ) : (
              <Button
                onClick={() =>
                  setMemory(index, {
                    ...memory,
                    phase1: {},
                    lore: { ...memory.lore, phase1: { ...EMPTY_TEXT } },
                  })
                }
              >
                + 1바퀴 조사 추가
              </Button>
            )}

            {memory.phase2 ? (
              <PhaseEditor
                label="2바퀴 (재조사)"
                round="phase2"
                phase={memory.phase2}
                memory={memory}
                memories={content.memories}
                waves={waves.phase2}
                scripts={content.scripts}
                options={options}
                scriptIds={scriptIds}
                onRemove={
                  memory.phase1
                    ? () => {
                        const { phase2: _dropped, lore, ...rest } = memory;
                        const { phase2: _loreDropped, ...loreRest } = lore;
                        setMemory(index, { ...rest, lore: loreRest });
                      }
                    : undefined
                }
                onChange={(phase2) => setMemory(index, { ...memory, phase2 })}
              />
            ) : (
              <Button
                onClick={() =>
                  setMemory(index, {
                    ...memory,
                    phase2: {},
                    lore: { ...memory.lore, phase2: { ...EMPTY_TEXT } },
                  })
                }
              >
                + 2바퀴 조사 추가
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** 이 페이즈가 실제로 어떤 차례로 흐르는지 한 줄로: 비운 칸은 빠진 채로 보여준다. */
function FlowSummary({ phase }: { phase: ContentPhase }) {
  const steps = [
    "오브젝트 클릭",
    phase.script ? `① 대사창 · ${phase.script}` : null,
    phase.minigame ? `② 미니게임 · ${phase.minigame}` : null,
    phase.resultScript ? `③ 대사창 · ${phase.resultScript}` : null,
    "수집 완료",
  ].filter((step): step is string => step !== null);

  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-2 text-xs ${sunkenClass}`}
    >
      {steps.map((step, index) => (
        <span key={step} className="flex items-center gap-1.5">
          {index > 0 ? <span className={faintClass}>→</span> : null}
          <span className={index === 0 || index === steps.length - 1 ? mutedClass : ""}>
            {step}
          </span>
        </span>
      ))}
      {steps.length === 2 ? (
        <span className={mutedClass}>(대사도 미니게임도 없이 바로 수집된다)</span>
      ) : null}
    </div>
  );
}

/** ①②③ 번호 + 라벨 한 줄. 번호가 곧 재생 순서다. */
function StepLabel({ step, title, when }: { step: string; title: string; when: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 tracking-normal">
      <span className="font-medium text-[var(--admin-ink)] text-sm">
        {step} {title}
      </span>
      <span className={`text-xs ${mutedClass}`}>{when}</span>
    </span>
  );
}

function PhaseEditor({
  label,
  round,
  phase,
  memory,
  memories,
  waves,
  scripts,
  options,
  scriptIds,
  onChange,
  onRemove,
}: {
  label: string;
  round: Round;
  phase: ContentPhase;
  memory: ContentMemory;
  memories: ContentMemory[];
  waves: Map<string, number>;
  scripts: GameContent["scripts"];
  options: ContentOptions;
  scriptIds: string[];
  onChange: (phase: ContentPhase) => void;
  onRemove?: () => void;
}) {
  const set = (key: keyof ContentPhase, value: unknown) => {
    const next = { ...phase };
    if (value === undefined || value === "") delete next[key];
    else Object.assign(next, { [key]: value });
    onChange(next);
  };

  const toggleUnlock = (id: string) => {
    const current = phase.unlockAfter ?? [];
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    set("unlockAfter", next.length > 0 ? next : undefined);
  };

  const scriptLabel = (id: string) => scriptOptionLabel(id, scripts);
  const wave = waves.get(memory.id);
  const together =
    wave === undefined
      ? []
      : memories
          .filter((entry) => entry.id !== memory.id && waves.get(entry.id) === wave)
          .map((entry) => entry.id);

  return (
    <div className="rounded-sm border border-[var(--admin-line)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className={labelClass}>{label}</span>
          <WaveBadge wave={wave} round={round} />
          <span className="text-[var(--admin-ink)] text-xs">
            {wave === undefined ? "차례를 셀 수 없다" : `${wave}번째로 열림`}
          </span>
          {wave === undefined ? null : (
            <span className={`text-xs ${mutedClass}`}>
              {together.length > 0 ? `· 동시에: ${together.join(", ")}` : "· 혼자 열린다"}
            </span>
          )}
        </span>
        {onRemove ? (
          <Button tone="danger" onClick={onRemove}>
            {round === "phase1" ? "1바퀴" : "2바퀴"} 제거
          </Button>
        ) : null}
      </div>

      <FlowSummary phase={phase} />

      <div className="flex flex-col gap-4">
        <div>
          <Field
            label={<StepLabel step="①" title="대사창" when="게임 전: 누르는 즉시" />}
            hint="오브젝트를 누르면 이 대사부터 흐른다. 다 넘기면 미니게임으로 넘어간다."
          >
            <Select
              allowEmpty
              value={phase.script}
              options={scriptIds}
              labelOf={scriptLabel}
              onChange={(value) => set("script", value)}
            />
          </Field>
          {phase.script ? <ScriptPreview lines={scripts[phase.script]} /> : null}
        </div>

        <Field
          label={<StepLabel step="②" title="미니게임" when="대사 다음" />}
          hint="비우면 ① 대사가 끝나는 순간 수집된다."
        >
          <Select
            allowEmpty
            value={phase.minigame}
            options={options.minigameIds}
            onChange={(value) => set("minigame", value)}
          />
        </Field>

        <div>
          <Field
            label={<StepLabel step="③" title="대사창" when="게임 후: 클리어했을 때만" />}
            hint="미니게임 화면을 뒤에 남긴 채 뜬다. 실패하면 뜨지 않고 인터랙션이 닫힌다 (재도전 가능). 미니게임 없이는 저장이 막힌다."
          >
            <Select
              allowEmpty
              value={phase.resultScript}
              options={scriptIds}
              labelOf={scriptLabel}
              onChange={(value) => {
                // 결과 대사를 비우면 그 위의 곡도 같이 비운다. 남겨 두면 저장이 막힌다
                if (value) return set("resultScript", value);
                const { resultScript: _script, resultMusic: _music, ...rest } = phase;
                onChange(rest);
              }}
            />
          </Field>
          {phase.resultScript ? <ScriptPreview lines={scripts[phase.resultScript]} /> : null}
          {phase.resultScript ? (
            <div className="mt-2">
              <Field
                label="결과 대사 동안 트는 곡"
                hint="비우면 방 곡이 그대로 흐른다. title은 타이틀 곡이 돌아오는 자리라 회상이 가장 짙은 몇 곳에만 건다."
              >
                <Select
                  allowEmpty
                  emptyLabel="(방 곡)"
                  value={phase.resultMusic}
                  options={options.resultMusic}
                  onChange={(value) => set("resultMusic", value)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <span className={labelClass}>먼저 조사해야 열림: 고를수록 번호가 뒤로 밀린다</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {memories
            .filter((entry) => entry.id !== memory.id)
            .map((entry) => {
              const on = (phase.unlockAfter ?? []).includes(entry.id);
              const depWave = waves.get(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  title={
                    depWave === undefined
                      ? `${entry.id}에는 이 바퀴가 없다. 기다리면 영영 안 열린다`
                      : `${depWave}번째로 열리는 기억`
                  }
                  onClick={() => toggleUnlock(entry.id)}
                  className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-xs transition-colors ${
                    on
                      ? "border-[var(--admin-accent-line)] bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]"
                      : `border-[var(--admin-line-strong)] ${mutedClass} hover:text-[var(--admin-ink)]`
                  }`}
                >
                  <span className={faintClass}>{depWave ?? "-"}</span>
                  {entry.id}
                </button>
              );
            })}
        </div>
      </div>

      <div className="mt-4">
        <Field label="다시보기 스틸 (public 기준 경로, 비우면 방이 비친다)">
          <TextInput
            value={phase.replayStill ?? ""}
            placeholder="/assets/images/…"
            onChange={(value) => set("replayStill", value || undefined)}
          />
        </Field>
      </div>
    </div>
  );
}

/* ── 대사 ─────────────────────────────────────────────────────────────── */

/**
 * 어느 기억의 몇 번째 칸이 이 스크립트를 가리키는지. 검증기가 세는 것과 같은
 * 자리를 세므로, 여기서 비어 있으면 저장도 막힌다.
 */
function scriptUsage(content: GameContent): Record<string, string[]> {
  const usage: Record<string, string[]> = {};

  for (const memory of content.memories) {
    const mark = (id: string | undefined, round: string, slot: string) => {
      if (!id) return;
      usage[id] = [...(usage[id] ?? []), `${memory.id} · ${round} · ${slot}`];
    };
    for (const [round, phase] of [
      ["1바퀴", memory.phase1],
      ["2바퀴", memory.phase2],
      // 3차(되짚기)도 스크립트를 가리킨다. 빠뜨리면 멀쩡한 대사에 "안 붙었다"가 뜬다
      ["3바퀴", memory.phase3],
    ] as const) {
      if (!phase) continue;
      mark(phase.script, round, "① 게임 전");
      mark(phase.resultScript, round, "③ 게임 후");
    }
  }

  return usage;
}

function ScriptsTab({
  content,
  options,
  onChange,
}: {
  content: GameContent;
  options: ContentOptions;
  onChange: (next: GameContent) => void;
}) {
  const cards = useCollapsible(true);

  const setLines = (id: string, lines: ContentLine[]) =>
    onChange({ ...content, scripts: { ...content.scripts, [id]: lines } });

  const [query, setQuery] = useState("");
  const usage = scriptUsage(content);
  const key = searchKey(query);

  // id로 걸리면 스크립트째, 본문·화자로 걸리면 그 줄이 있는 스크립트가 남는다
  const matchesScript = (id: string, lines: ContentLine[], term: string) =>
    !term || id.toLowerCase().includes(term) || lines.some((line) => lineMatches(line, term));
  const entries = Object.entries(content.scripts).filter(([id, lines]) =>
    matchesScript(id, lines, key),
  );
  const ids = entries.map(([id]) => id);
  const hitLines = entries.reduce(
    (sum, [, lines]) => sum + lines.filter((line) => lineMatches(line, key)).length,
    0,
  );

  // 검색어가 바뀌면 걸린 카드를 펼친다. 줄을 찾으러 온 거라 접혀 있으면 한 번 더 눌러야 한다
  const search = (next: string) => {
    setQuery(next);
    const term = searchKey(next);
    if (!term) return;
    cards.setAll(
      Object.entries(content.scripts)
        .filter(([id, lines]) => matchesScript(id, lines, term))
        .map(([id]) => id),
      true,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${mutedClass}`}>
          제목 옆이 이 대사가 뜨는 자리다. 어디서도 가리키지 않는 스크립트는 저장이 막힌다. 자리를
          붙이는 것은 흐름 탭이다.
        </p>
        <CollapseAll
          onExpand={() => cards.setAll(ids, true)}
          onCollapse={() => cards.setAll(ids, false)}
        />
      </div>

      <SearchBar
        value={query}
        onChange={search}
        result={key ? `스크립트 ${entries.length}개 · 줄 ${hitLines}개` : null}
      />

      {key && entries.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>걸리는 대사가 없다.</p>
      ) : null}

      {entries.map(([id, lines]) => (
        <Card
          key={id}
          open={cards.isOpen(id)}
          onToggle={() => cards.toggle(id)}
          summary={`${lines.length}줄`}
          title={
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-mono">{id}</span>
              {(usage[id] ?? []).map((where) => (
                <span
                  key={where}
                  className={`rounded-sm border border-[var(--admin-line)] px-2 py-0.5 font-normal text-xs ${mutedClass}`}
                >
                  {where}
                </span>
              ))}
              {usage[id] ? null : (
                <span className="rounded-sm border border-[var(--admin-warn-line)] bg-[var(--admin-warn-soft)] px-2 py-0.5 font-normal text-[var(--admin-warn)] text-xs">
                  아직 아무 데도 안 붙었다. 저장이 막힌다
                </span>
              )}
            </span>
          }
        >
          <LinesEditor
            lines={lines}
            options={options}
            highlight={key}
            onChange={(next) => setLines(id, next)}
          />
        </Card>
      ))}
    </div>
  );
}

function LinesEditor({
  lines,
  options,
  highlight = "",
  onChange,
}: {
  lines: ContentLine[];
  options: ContentOptions;
  /** 검색어(searchKey). 걸린 줄의 테두리를 강조색으로 바꾼다 */
  highlight?: string;
  onChange: (lines: ContentLine[]) => void;
}) {
  const setLine = (index: number, line: ContentLine) => {
    const next = [...lines];
    next[index] = line;
    onChange(next);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => (
        // 줄에는 고유 id가 없다. 순서가 곧 정체성이라 인덱스를 키로 쓴다
        // biome-ignore lint/suspicious/noArrayIndexKey: 줄의 정체성은 순서 그 자체다
        <div key={index} className={lineBoxClass(lineMatches(line, highlight))}>
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <span className={`pb-2 font-mono text-xs ${mutedClass}`}>
              {index + 1}번째 줄 / {lines.length}
            </span>
            <div className="w-36">
              <Field label="화자">
                <Select
                  value={line.speaker}
                  options={options.speakers}
                  onChange={(speaker) => setLine(index, { ...line, speaker: speaker ?? "hero" })}
                />
              </Field>
            </div>
            <div className="w-36">
              <Field label="표정">
                <Select
                  allowEmpty
                  emptyLabel="neutral"
                  value={line.expression}
                  options={options.expressions}
                  onChange={(expression) =>
                    setLine(index, {
                      ...line,
                      expression: expression as ContentLine["expression"],
                    })
                  }
                />
              </Field>
            </div>
            <div>
              <Field label="회상">
                {/* 회상 속 그때의 말: 초상을 세우지 않는다 (DialogueScriptLine.recall) */}
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={line.recall === true}
                    onChange={(event) => {
                      const { recall: _dropped, ...rest } = line;
                      setLine(index, event.target.checked ? { ...rest, recall: true } : rest);
                    }}
                  />
                  초상 없음
                </label>
              </Field>
            </div>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </Button>
              <Button onClick={() => move(index, 1)} disabled={index === lines.length - 1}>
                ↓
              </Button>
              <Button
                tone="danger"
                disabled={lines.length === 1}
                onClick={() => onChange(lines.filter((_, at) => at !== index))}
              >
                삭제
              </Button>
            </div>
          </div>

          <LocalizedInput
            label="본문"
            value={line}
            onChange={(text) => setLine(index, { ...line, ...text })}
          />
        </div>
      ))}

      <div>
        <Button
          onClick={() =>
            onChange([...lines, { speaker: lines.at(-1)?.speaker ?? "hero", ...EMPTY_TEXT }])
          }
        >
          + 줄 추가
        </Button>
      </div>
    </div>
  );
}

/* ── 컷씬 ─────────────────────────────────────────────────────────────── */

function CutscenesTab({
  content,
  options,
  onChange,
}: {
  content: GameContent;
  options: ContentOptions;
  onChange: (next: GameContent) => void;
}) {
  const cards = useCollapsible(true);

  const setCuts = (id: string, cuts: ContentCut[]) =>
    onChange({ ...content, cutscenes: { ...content.cutscenes, [id]: cuts } });

  const [query, setQuery] = useState("");
  const key = searchKey(query);

  const matchesCutscene = (id: string, cuts: ContentCut[], term: string) =>
    !term ||
    id.toLowerCase().includes(term) ||
    cuts.some((cut) => cut.lines.some((line) => lineMatches(line, term)));
  const entries = Object.entries(content.cutscenes).filter(([id, cuts]) =>
    matchesCutscene(id, cuts, key),
  );
  const ids = entries.map(([id]) => id);
  const hitLines = entries.reduce(
    (sum, [, cuts]) =>
      sum +
      cuts.reduce(
        (each, cut) => each + cut.lines.filter((line) => lineMatches(line, key)).length,
        0,
      ),
    0,
  );

  const search = (next: string) => {
    setQuery(next);
    const term = searchKey(next);
    if (!term) return;
    cards.setAll(
      Object.entries(content.cutscenes)
        .filter(([id, cuts]) => matchesCutscene(id, cuts, term))
        .map(([id]) => id),
      true,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${mutedClass}`}>
          컷씬 일러스트는 아직 리포에 없어도 된다. 없으면 회색 판이 자리를 지키고 대사만 흐른다.
        </p>
        <CollapseAll
          onExpand={() => cards.setAll(ids, true)}
          onCollapse={() => cards.setAll(ids, false)}
        />
      </div>

      <SearchBar
        value={query}
        onChange={search}
        result={key ? `컷씬 ${entries.length}개 · 줄 ${hitLines}개` : null}
      />

      {key && entries.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>걸리는 대사가 없다.</p>
      ) : null}

      {entries.map(([id, cuts]) => (
        <Card
          key={id}
          open={cards.isOpen(id)}
          onToggle={() => cards.toggle(id)}
          summary={`${cuts.length}컷`}
          title={<span className="font-mono">{id}</span>}
        >
          <div className="flex flex-col gap-4">
            {cuts.map((cut, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 컷의 정체성은 순서 그 자체다
              <div key={index} className="rounded-sm border border-[var(--admin-line)] p-3">
                <p className={`mb-3 font-mono text-xs ${mutedClass}`}>
                  {index + 1}번째 컷 / {cuts.length}
                </p>

                <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
                  <Field label="일러스트 경로">
                    <TextInput
                      value={cut.image ?? ""}
                      placeholder="/assets/images/….webp"
                      onChange={(image) => {
                        const next = [...cuts];
                        next[index] = { ...cut, image: image || undefined };
                        setCuts(id, next);
                      }}
                    />
                  </Field>
                  <Field label="정적 (ms)">
                    <TextInput
                      value={cut.holdMs === undefined ? "" : String(cut.holdMs)}
                      placeholder="없음"
                      onChange={(value) => {
                        const next = [...cuts];
                        const holdMs = Number.parseInt(value, 10);
                        next[index] = {
                          ...cut,
                          holdMs: Number.isFinite(holdMs) ? holdMs : undefined,
                        };
                        setCuts(id, next);
                      }}
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <LinesEditor
                    lines={cut.lines}
                    options={options}
                    highlight={key}
                    onChange={(lines) => {
                      const next = [...cuts];
                      next[index] = { ...cut, lines };
                      setCuts(id, next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── 기록 · 독백 ──────────────────────────────────────────────────────── */

function LoreTab({
  content,
  onChange,
}: {
  content: GameContent;
  onChange: (next: GameContent) => void;
}) {
  const cards = useCollapsible(false);

  const setMemory = (index: number, memory: ContentMemory) => {
    const memories = [...content.memories];
    memories[index] = memory;
    onChange({ ...content, memories });
  };

  const waves = unlockWaves(content.memories, "phase1");
  const ids = [...content.memories.map((memory) => memory.id), ...Object.keys(content.stages)];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${mutedClass}`}>
          기록은 수첩에 남는 문장이다. 대사가 한 줄도 없는 기억은 다시보기에서 이 기록이
          나레이션으로 대신 선다. 번호는 흐름 탭과 같은 &ldquo;열리는 차례&rdquo;다.
        </p>
        <CollapseAll
          onExpand={() => cards.setAll(ids, true)}
          onCollapse={() => cards.setAll(ids, false)}
        />
      </div>

      {content.memories.map((memory, index) => (
        <Card
          key={memory.id}
          open={cards.isOpen(memory.id)}
          onToggle={() => cards.toggle(memory.id)}
          summary={[memory.phase1 ? "1바퀴 기록" : null, memory.phase2 ? "2바퀴 기록" : null]
            .filter(Boolean)
            .join(" · ")}
          title={<MemoryTitle memory={memory} wave={waves.get(memory.id)} />}
        >
          <div className="flex flex-col gap-4">
            <LocalizedInput
              label="제목"
              rows={1}
              value={memory.lore.title}
              onChange={(title) => setMemory(index, { ...memory, lore: { ...memory.lore, title } })}
            />
            {/* 기록은 있는 바퀴만 쓴다. 없는 바퀴의 문장은 아무 데서도 안 뜨고 저장이 막힌다 */}
            {memory.phase1 ? (
              <LocalizedInput
                label="1바퀴 기록"
                value={memory.lore.phase1 ?? EMPTY_TEXT}
                onChange={(phase1) =>
                  setMemory(index, { ...memory, lore: { ...memory.lore, phase1 } })
                }
              />
            ) : null}
            {memory.phase2 ? (
              <LocalizedInput
                label="2바퀴 기록"
                value={memory.lore.phase2 ?? EMPTY_TEXT}
                onChange={(phase2) =>
                  setMemory(index, { ...memory, lore: { ...memory.lore, phase2 } })
                }
              />
            ) : null}
          </div>
        </Card>
      ))}

      {Object.entries(content.stages).map(([id, stage]) => (
        <Card
          key={id}
          open={cards.isOpen(id)}
          onToggle={() => cards.toggle(id)}
          summary="진행도 독백"
          title={<span className="font-mono">monologue · {id}</span>}
        >
          <div className="flex flex-col gap-4">
            <LocalizedInput
              label="독백 (조사 개수 구간: p1-n은 1바퀴 n개부터, p2-n은 2바퀴 n개부터)"
              value={stage.monologue}
              onChange={(monologue) =>
                onChange({
                  ...content,
                  stages: { ...content.stages, [id]: { ...stage, monologue } },
                })
              }
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
