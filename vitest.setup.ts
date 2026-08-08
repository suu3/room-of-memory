import { afterEach } from "vitest";

// localStorage 모킹 — zustand persist 미들웨어가 쓴다
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// 각 테스트마다 localStorage를 초기화한다
afterEach(() => {
  window.localStorage.clear();
});
