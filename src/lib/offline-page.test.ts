// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

type WorkerEvent = {
  request?: Request;
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

/** 배포하는 sw.js를 그대로 돌리고, CacheStorage와 네트워크만 흉내 낸다. */
function startWorker(origin: string) {
  const cached = new Map<string, Response>();
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  let offline = false;
  const keyOf = (request: Request | string) => new URL(request.toString(), origin).href;
  const urlOf = (request: Request | string) =>
    typeof request === "string" ? keyOf(request) : request.url;

  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Request: class extends Request {
      constructor(input: string, init?: RequestInit) {
        super(new URL(input, origin), init);
      }
    },
    self: {
      location: { origin },
      skipWaiting: () => Promise.resolve(),
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => {
        handlers.set(name, handler);
      },
    },
    caches: {
      match: async (request: Request | string) => cached.get(urlOf(request))?.clone(),
      open: async () => ({
        put: async (request: Request, response: Response) => {
          cached.set(urlOf(request), response);
        },
        add: async (request: Request | string) => {
          cached.set(urlOf(request), new Response(`page:${new URL(urlOf(request)).pathname}`));
        },
      }),
    },
    fetch: async () => {
      if (offline) throw new Error("Offline");
      return new Response("fresh page");
    },
  });

  return {
    async install() {
      let installing: Promise<unknown> = Promise.resolve();
      handlers.get("install")?.({ waitUntil: (promise) => (installing = promise) });
      await installing;
    },
    goOffline() {
      offline = true;
    },
    async navigate(path: string) {
      const request = new Request(new URL(path, origin));
      // Node의 Request 생성자는 mode: "navigate"를 거부하므로 워커가 보는 값만 덮어쓴다
      Object.defineProperty(request, "mode", { value: "navigate" });
      let response: Promise<Response> | undefined;
      handlers.get("fetch")?.({ request, respondWith: (value) => (response = value) });
      if (!response) throw new Error("Navigation was not handled");
      return (await response).text();
    },
  };
}

it("shows the offline page for an uncached address once the connection drops", async () => {
  const worker = startWorker("https://room.example");
  await worker.install();

  expect(await worker.navigate("/contact")).toBe("fresh page");
  worker.goOffline();
  // 한 번 열었던 주소는 그 사본을, 처음 가는 주소는 오프라인 페이지를 준다
  expect(await worker.navigate("/contact")).toBe("fresh page");
  expect(await worker.navigate("/never-visited")).toBe("page:/offline.html");
});
