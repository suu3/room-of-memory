import { readFile } from "node:fs/promises";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { sourcePath } from "./load.mjs";
import { SOURCES } from "./schema.mjs";

/**
 * 어드민이 넘긴 값을 기존 YAML 문서 위에 덮어쓴다 — 통째로 다시 쓰지 않는다.
 *
 * content/*.yaml에는 기획 의도가 주석으로 잔뜩 붙어 있다. yaml.stringify로 다시
 * 뽑으면 그게 전부 날아가서, 어드민에서 대사 한 줄 고칠 때마다 문서가 조금씩
 * 벗겨진다. 그래서 문서 노드를 제자리에서 고치는 방식을 쓴다 — 건드리지 않은
 * 자리의 주석은 그대로 남는다.
 *
 * 남는 한계: 지운 항목에 붙어 있던 주석은 그 항목과 같이 사라진다. 그건 의도한
 * 동작이다 (없어진 기억의 설명이 남아 있는 편이 더 나쁘다).
 */
export async function writeSource(key, value) {
  const file = sourcePath(key);
  const doc = parseDocument(await readFile(file, "utf8"));

  syncInto(doc, [SOURCES[key].root], value);

  /*
   * lineWidth 0 — 긴 한국어 문장을 접지 않는다. flowCollectionPadding false —
   * 손으로 쓴 `[radio]`가 저장만 했다고 `[ radio ]`로 벌어지지 않게.
   * 마지막 replace는 항목을 옮길 때 생기는 공백뿐인 줄을 지운다.
   */
  const text = doc
    .toString({ lineWidth: 0, flowCollectionPadding: false })
    .replace(/^[ \t]+$/gm, "");

  return { file, text };
}

function syncInto(doc, path, next) {
  const current = doc.getIn(path, true);

  if (isPlainObject(next)) {
    if (!isMap(current)) {
      doc.setIn(path, next);
      return;
    }

    for (const key of current.items.map((item) => String(item.key?.value ?? item.key))) {
      if (!(key in next)) doc.deleteIn([...path, key]);
    }
    for (const [key, value] of Object.entries(next)) syncInto(doc, [...path, key], value);
    return;
  }

  if (Array.isArray(next)) {
    if (!isSeq(current)) {
      doc.setIn(path, next);
      return;
    }

    /*
     * id가 붙은 목록(기억 등)은 자리가 아니라 id로 맞춘다. 어드민에서 순서를
     * 바꿔도 주석이 원래 항목을 따라가게 하려는 것이다. 새로 생긴 id 자리에는
     * 빈 맵을 끼워 넣어 인덱스를 맞춘 뒤 아래에서 채운다.
     */
    if (matchableById(current, next)) {
      const byId = new Map(
        current.items.map((item) => [isMap(item) ? item.get("id") : undefined, item]),
      );
      current.items = next.map((entry) => byId.get(entry.id) ?? doc.createNode({}));
    } else {
      for (let index = current.items.length - 1; index >= next.length; index -= 1) {
        doc.deleteIn([...path, index]);
      }
    }

    for (const [index, value] of next.entries()) syncInto(doc, [...path, index], value);
    return;
  }

  if (next === undefined) {
    doc.deleteIn(path);
    return;
  }
  if (isScalar(current) && current.value === next) return;
  doc.setIn(path, next);
}

function matchableById(seq, next) {
  return (
    next.every((entry) => isPlainObject(entry) && typeof entry.id === "string") &&
    seq.items.every((item) => isMap(item) && typeof item.get("id") === "string")
  );
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
