// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { ASSETS } from "./assets";

it("loads the animated player even when the service worker cached the old placeholder", async () => {
  const origin = "https://room.example";
  const legacyUrl = `${origin}/assets/models/player-blocky.glb`;
  const cached = new Map([
    [legacyUrl, new Response("legacy placeholder")],
    [`${legacyUrl}?v=rig-20260906`, new Response("previous rig without eye bones")],
    [`${legacyUrl}?v=vest-20260906`, new Response("previous warm-colored rig")],
    [`${legacyUrl}?v=rounded-back80-20260908`, new Response("previous character mesh and rig")],
  ]);
  const bytes = readFileSync("public/assets/models/player-blocky.glb");
  let offline = false;
  let handleFetch: (event: {
    request: Request;
    respondWith: (response: Promise<Response>) => void;
  }) => void = () => {
    throw new Error("Service worker did not register a fetch handler");
  };
  // Run the shipped worker; only emulate browser CacheStorage and the network.
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    self: {
      location: { origin },
      addEventListener: (name: string, handler: typeof handleFetch) => {
        if (name === "fetch") handleFetch = handler;
      },
    },
    caches: {
      match: async (request: Request) => cached.get(request.url)?.clone(),
      open: async () => ({
        put: async (request: Request, response: Response) => {
          cached.set(request.url, response);
        },
      }),
    },
    fetch: async (request: Request) => {
      if (offline) throw new Error("Offline");
      if (new URL(request.url).pathname !== "/assets/models/player-blocky.glb") {
        return new Response(null, { status: 404 });
      }
      return new Response(bytes);
    },
  });
  async function loadPlayer() {
    let response: Promise<Response> | undefined;
    handleFetch({
      request: new Request(new URL(ASSETS.models.playerBlocky, origin)),
      respondWith: (value) => {
        response = value;
      },
    });
    if (!response) throw new Error("Player request was not handled");
    return Buffer.from(await (await response).arrayBuffer());
  }
  expect(
    (await loadPlayer()).equals(bytes),
    "must load the current GLB, not the cached placeholder",
  ).toBe(true);
  offline = true;
  expect(
    (await loadPlayer()).equals(bytes),
    "must retain the current GLB for offline reloads",
  ).toBe(true);
  expect(await cached.get(legacyUrl)?.text()).toBe("legacy placeholder");
});
