"use client";

/**
 * 대본·흐름 편집기 — 로컬 dev 서버 전용.
 *
 * content/*.yaml을 통째로 받아 고치고 통째로 돌려준다. 저장은 서버가 검증을
 * 먼저 돌리고 통과할 때만 파일을 쓴다 — 여기서 통과한 것이 CI에서 떨어지는 일이
 * 없도록 `pnpm content:build`와 같은 검증기를 쓴다.
 *
 * 기억 id는 여기서 못 고친다. id는 3D 씬의 오브젝트 이름, 에셋 파일명,
 * i18n의 memories.<id>.name까지 걸쳐 있어서 편집기 혼자 바꿀 수 있는 값이 아니다.
 */
import { useCallback, useEffect, useState } from "react";
import type {
  ContentCut,
  ContentLine,
  ContentMemory,
  ContentOptions,
  ContentPhase,
  GameContent,
  LocalizedText,
  SaveResult,
} from "@/types/content";
import { Button, Card, Field, LocalizedInput, labelClass, Select, TextInput } from "./fields";

const TABS = [
  { id: "flow", label: "흐름" },
  { id: "scripts", label: "대사" },
  { id: "cutscenes", label: "컷씬" },
  { id: "lore", label: "기록 · 독백" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const EMPTY_TEXT: LocalizedText = { ko: "", en: "", ja: "" };

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

  // 저장하지 않고 새로고침하면 편집분이 그대로 날아간다 — 브라우저에 한 번 물어보게 한다
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
        setStatus(`저장 완료 — ${result.written.length}개 파일. 게임 탭을 새로고침하면 반영된다.`);
      } else {
        setStatus("저장하지 않았다 — 아래 문제를 고칠 것.");
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
      <p className="p-8 text-fog">
        {issues.length > 0 ? issues.join("\n") : "content/*.yaml 읽는 중…"}
      </p>
    );
  }

  const scriptIds = Object.keys(content.scripts);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-medium text-2xl text-paper">대본 · 흐름 편집기</h1>
          <p className="mt-1 text-fog text-sm">
            content/*.yaml을 고친다. 저장하면 생성물(src/data/generated, i18n 리소스)까지 같이
            갱신된다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-memory text-sm">저장 안 된 변경</span> : null}
          <Button tone="primary" onClick={save} disabled={saving || !dirty}>
            저장
          </Button>
        </div>
      </header>

      {status ? <p className="text-bone text-sm">{status}</p> : null}

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-ember/50 bg-ember/10 p-4 text-sm">
          {issues.map((issue) => (
            <li key={issue} className="text-paper">
              · {issue}
            </li>
          ))}
        </ul>
      ) : null}

      <nav className="flex gap-2 border-fog/20 border-b">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === entry.id
                ? "border-memory text-paper"
                : "border-transparent text-fog hover:text-bone"
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fog text-sm">
        여기 적힌 순서가 기억 패널에 뜨는 순서다. id는 3D 씬·에셋·i18n 이름까지 걸쳐 있어 편집기에서
        바꾸지 않는다.
      </p>

      {content.memories.map((memory, index) => (
        <Card
          key={memory.id}
          title={<span className="font-mono">{memory.id}</span>}
          actions={
            <>
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

            <PhaseEditor
              label="1바퀴 (최초 수집)"
              phase={memory.phase1}
              memory={memory}
              memories={content.memories}
              options={options}
              scriptIds={scriptIds}
              onChange={(phase1) => setMemory(index, { ...memory, phase1 })}
            />

            {memory.phase2 ? (
              <PhaseEditor
                label="2바퀴 (재조사)"
                phase={memory.phase2}
                memory={memory}
                memories={content.memories}
                options={options}
                scriptIds={scriptIds}
                onRemove={() => {
                  const { phase2: _dropped, lore, ...rest } = memory;
                  const { phase2: _loreDropped, ...loreRest } = lore;
                  setMemory(index, { ...rest, lore: loreRest });
                }}
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

function PhaseEditor({
  label,
  phase,
  memory,
  memories,
  options,
  scriptIds,
  onChange,
  onRemove,
}: {
  label: string;
  phase: ContentPhase;
  memory: ContentMemory;
  memories: ContentMemory[];
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

  return (
    <div className="rounded-sm border border-fog/20 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className={labelClass}>{label}</span>
        {onRemove ? (
          <Button tone="danger" onClick={onRemove}>
            2바퀴 제거
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="진입 대사">
          <Select
            allowEmpty
            value={phase.script}
            options={scriptIds}
            onChange={(value) => set("script", value)}
          />
        </Field>
        <Field label="미니게임">
          <Select
            allowEmpty
            value={phase.minigame}
            options={options.minigameIds}
            onChange={(value) => set("minigame", value)}
          />
        </Field>
        <Field label="결과 대사">
          <Select
            allowEmpty
            value={phase.resultScript}
            options={scriptIds}
            onChange={(value) => set("resultScript", value)}
          />
        </Field>
      </div>

      <div className="mt-3">
        <span className={labelClass}>먼저 조사해야 열림</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {memories
            .filter((entry) => entry.id !== memory.id)
            .map((entry) => {
              const on = (phase.unlockAfter ?? []).includes(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => toggleUnlock(entry.id)}
                  className={`rounded-sm border px-2 py-1 font-mono text-xs transition-colors ${
                    on
                      ? "border-memory bg-memory/20 text-paper"
                      : "border-fog/30 text-fog hover:text-bone"
                  }`}
                >
                  {entry.id}
                </button>
              );
            })}
        </div>
      </div>

      <div className="mt-3">
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

function ScriptsTab({
  content,
  options,
  onChange,
}: {
  content: GameContent;
  options: ContentOptions;
  onChange: (next: GameContent) => void;
}) {
  const setLines = (id: string, lines: ContentLine[]) =>
    onChange({ ...content, scripts: { ...content.scripts, [id]: lines } });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fog text-sm">
        어디서도 가리키지 않는 스크립트는 저장이 막힌다 — 흐름 탭에서 먼저 붙일 것.
      </p>

      {Object.entries(content.scripts).map(([id, lines]) => (
        <Card key={id} title={<span className="font-mono">{id}</span>}>
          <LinesEditor lines={lines} options={options} onChange={(next) => setLines(id, next)} />
        </Card>
      ))}
    </div>
  );
}

function LinesEditor({
  lines,
  options,
  onChange,
}: {
  lines: ContentLine[];
  options: ContentOptions;
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
        // 줄에는 고유 id가 없다 — 순서가 곧 정체성이라 인덱스를 키로 쓴다
        // biome-ignore lint/suspicious/noArrayIndexKey: 줄의 정체성은 순서 그 자체다
        <div key={index} className="rounded-sm border border-fog/20 p-3">
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <span className="pb-2 font-mono text-fog text-xs">line{index + 1}</span>
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
  const setCuts = (id: string, cuts: ContentCut[]) =>
    onChange({ ...content, cutscenes: { ...content.cutscenes, [id]: cuts } });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fog text-sm">
        컷씬 일러스트는 아직 리포에 없어도 된다 — 없으면 회색 판이 자리를 지키고 대사만 흐른다.
      </p>

      {Object.entries(content.cutscenes).map(([id, cuts]) => (
        <Card key={id} title={<span className="font-mono">{id}</span>}>
          <div className="flex flex-col gap-4">
            {cuts.map((cut, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 컷의 정체성은 순서 그 자체다
              <div key={index} className="rounded-sm border border-fog/20 p-3">
                <p className="mb-3 font-mono text-fog text-xs">cut{index + 1}</p>

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
  const setMemory = (index: number, memory: ContentMemory) => {
    const memories = [...content.memories];
    memories[index] = memory;
    onChange({ ...content, memories });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fog text-sm">
        기록은 수첩에 남는 문장이다. 대사가 한 줄도 없는 기억은 다시보기에서 이 기록이 나레이션으로
        대신 선다.
      </p>

      {content.memories.map((memory, index) => (
        <Card key={memory.id} title={<span className="font-mono">{memory.id}</span>}>
          <div className="flex flex-col gap-4">
            <LocalizedInput
              label="제목"
              rows={1}
              value={memory.lore.title}
              onChange={(title) => setMemory(index, { ...memory, lore: { ...memory.lore, title } })}
            />
            <LocalizedInput
              label="1바퀴 기록"
              value={memory.lore.phase1}
              onChange={(phase1) =>
                setMemory(index, { ...memory, lore: { ...memory.lore, phase1 } })
              }
            />
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
        <Card key={id} title={<span className="font-mono">stage · {id}</span>}>
          <div className="flex flex-col gap-4">
            <LocalizedInput
              label="독백"
              value={stage.monologue}
              onChange={(monologue) =>
                onChange({
                  ...content,
                  stages: { ...content.stages, [id]: { ...stage, monologue } },
                })
              }
            />
            <LocalizedInput
              label="대사 (아직 쓰이는 곳 없음)"
              value={stage.dialogue}
              onChange={(dialogue) =>
                onChange({
                  ...content,
                  stages: { ...content.stages, [id]: { ...stage, dialogue } },
                })
              }
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
