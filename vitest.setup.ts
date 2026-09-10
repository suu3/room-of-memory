import { afterEach } from "vitest";

// Node 22.4+는 globalThis.localStorage에 자체 Web Storage 스텁을 미리 심어 둔다.
// vitest의 populateGlobal은 global에 이미 있는 키를 자기 교체 목록에 없으면 건드리지
// 않고 넘어가는데 localStorage가 그 목록에 없어서, jsdom 환경에서도 맨 localStorage는
// jsdom의 구현이 아니라 이 Node 스텁을 가리키게 되고 storage.setItem is not a function으로
// 터진다. 파일별 @vitest-environment jsdom 프래그마로도 못 고친다. Node 전역이 환경과
// 무관하게 그대로 덮어 가리기 때문이다. 이 목(mock)이 없으면 src/store/memory-room.test.ts의
// 36개를 포함해 9개 파일·74개 테스트가 깨진다.
const localStorageMock = (() => {
  let store: Record<string, string> = Object.create(null);

  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = Object.create(null);
    },
  };
})();

// @vitest-environment node로 도는 파일에는 window가 없다. 그런 파일에서도 이 설정 파일
// 자체는 죽지 않고 로드되어야 하므로 globalThis로 대체한다.
const globalTarget: typeof globalThis = typeof window === "undefined" ? globalThis : window;

Object.defineProperty(globalTarget, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

// 각 테스트마다 localStorage를 초기화한다
afterEach(() => {
  globalTarget.localStorage.clear();
});
