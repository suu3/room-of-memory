/*
 * 서비스 워커: 설치된 게임이 두 번째부터는 곧장 뜨게 하고, 네트워크가 끊겨도
 * 이미 받은 방은 다시 열리게 한다.
 *
 * 전략을 자원 종류로 나눈다:
 * - 에셋(/assets, /icons, /_next/static): 한 번 받으면 내용이 안 바뀌거나 파일명에
 *   해시가 붙는다 → 캐시 우선. 3D 모델과 폰트가 여기 들어가고, 첫 로딩 대부분이 이것들이다.
 * - 문서(navigate): 네트워크 우선, 실패하면 캐시. 배포한 새 버전을 붙잡고 있으면 안 된다.
 *   캐시에도 없으면 오프라인 페이지(offline.html)를 준다. 브라우저 공룡 화면 대신 방의 말투로.
 * - 나머지: 건드리지 않는다.
 *
 * 빌드 도구 없이 손으로 쓴다. next-pwa 같은 의존성을 하나 더 들이는 것보다,
 * 캐시 규칙 30줄을 읽을 수 있게 두는 편이 이 프로젝트 규모에 맞는다.
 */

/** 캐시 이름에 버전을 박는다. 올리면 activate에서 옛 캐시를 통째로 버린다. */
const VERSION = "v2";
const ASSET_CACHE = `rom-assets-${VERSION}`;
const PAGE_CACHE = `rom-pages-${VERSION}`;
const CACHES = [ASSET_CACHE, PAGE_CACHE];

/** 캐시 우선으로 다룰 경로. 전부 불변이거나 파일명에 해시가 붙는 것들이다. */
const ASSET_PREFIXES = ["/assets/", "/icons/", "/_next/static/"];

/** 연결도 캐시도 없을 때 문서 대신 내주는 페이지. 끊긴 뒤에는 받을 수 없으니 설치 때 받아 둔다. */
const OFFLINE_PAGE = "/offline.html";
/** 오프라인 페이지 제목 서체. 게임은 next/font가 해시 붙인 사본을 쓰므로 이 주소는 따로 받아야 한다. */
const OFFLINE_FONT = "/assets/fonts/Galmuri14.woff2";

self.addEventListener("install", (event) => {
  // 게임 에셋은 미리 받아두지 않는다. 무엇이 필요한지는 실제 플레이가 알려주고,
  // 목록을 손으로 관리하면 반드시 실제 에셋과 어긋난다. 오프라인 페이지만 예외다.
  // cache: "reload"로 HTTP 캐시의 옛 사본을 건너뛴다.
  event.waitUntil(
    Promise.all([
      caches.open(PAGE_CACHE).then((cache) => cache.add(new Request(OFFLINE_PAGE, { cache: "reload" }))),
      // 서체는 없어도 페이지가 선다 (시스템 서체로). 이것 때문에 설치가 실패하면 안 된다
      caches
        .open(ASSET_CACHE)
        .then((cache) => cache.add(OFFLINE_FONT))
        .catch(() => {}),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !CACHES.includes(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // 부분 응답(206)이나 실패는 캐시에 넣지 않는다. 넣으면 다음 로드가 깨진 걸 먹는다
  if (response.ok && response.status === 200) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_PAGE);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 다른 출처는 손대지 않는다. 이 게임은 외부 스토리지를 쓰지 않으므로 전부 동일 출처다.
  if (url.origin !== self.location.origin) return;
  // 영상은 브라우저가 Range로 조각조각 받는다. 캐시의 통짜 200을 돌려주면 Safari가
  // 재생을 못 하고, 206은 캐시에 넣지도 않으므로 아예 네트워크에 맡긴다.
  if (request.headers.has("range")) return;

  if (ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
