/**
 * 콘텐츠 파이프라인(scripts/content/*.mjs)의 타입 선언.
 *
 * 구현은 빌드 스크립트라 plain ESM으로 두고(빌드 도구 없이 `node`로 돌아야 한다),
 * dev 어드민이 서버에서 이 모듈을 그대로 import 하므로 타입만 여기 붙인다.
 */
import type { GameContent, SaveResult } from "@/types/content";

export interface BuildResult {
  /** 사람이 읽을 수 있는 문제 목록. 비어 있어야 output이 채워진다. */
  issues: string[];
  content: GameContent;
  /** 리포 루트 기준 경로 → 파일 내용. */
  output: Record<string, string>;
}

/** content/*.yaml을 읽어 하나의 콘텐츠 객체로. */
export function loadContent(): Promise<GameContent>;

/** 검증하고 생성물 내용을 만든다. 파일은 쓰지 않는다. */
export function buildContent(content?: GameContent): Promise<BuildResult>;

/** 현재 리포에 있는 생성물 내용. 아직 없는 파일은 null. */
export function readGenerated(): Promise<Record<string, string | null>>;

/** 생성물을 쓴다. 내용이 같은 파일은 건너뛴다. 쓴 파일 목록을 돌려준다. */
export function writeGenerated(output: Record<string, string>): Promise<string[]>;

/** 검증 → 통과하면 YAML과 생성물을 함께 쓴다. 걸리면 아무것도 쓰지 않는다. */
export function saveContent(content: GameContent): Promise<SaveResult>;
