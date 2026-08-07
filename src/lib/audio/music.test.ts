import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 후보 목록 폴백만 본다 — 소리 자체는 브라우저 없이는 검증할 수 없고, 여기서
 * 지켜야 하는 건 "아직 없는 곡을 경로에 박아 둬도 방이 조용해지지 않는다"는 계약뿐이다.
 * 오디오 노드는 연결만 되면 되는 껍데기로 세운다.
 */

vi.mock("./engine", () => ({ audioGraph: () => graph }));

function fakeParam() {
  return { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() };
}

function fakeNode() {
  const node = {
    gain: fakeParam(),
    frequency: fakeParam(),
    type: "",
    buffer: null as AudioBuffer | null,
    loop: false,
    onended: null as (() => void) | null,
    connect: vi.fn(() => node),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return node;
}

function fakeBuffer(): AudioBuffer {
  const channel = new Float32Array(4_800);
  return {
    numberOfChannels: 1,
    length: channel.length,
    sampleRate: 48_000,
    getChannelData: () => channel,
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

const context = {
  currentTime: 0,
  sampleRate: 48_000,
  createBuffer: () => fakeBuffer(),
  createBufferSource: fakeNode,
  createBiquadFilter: fakeNode,
  createConvolver: fakeNode,
  createGain: fakeNode,
  decodeAudioData: async () => fakeBuffer(),
} as unknown as AudioContext;

const graph = { context, master: fakeNode() as unknown as GainNode };

/** 여기 있는 경로만 200으로 응답한다. */
let served = new Set<string>();
let asked: ReturnType<typeof vi.fn>;

async function importMusic() {
  vi.resetModules();
  return await import("./music");
}

beforeEach(() => {
  served = new Set();
  asked = vi.fn(async (input: string) =>
    served.has(input)
      ? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
      : { ok: false, status: 404 },
  );
  vi.stubGlobal("fetch", asked);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** startMusic은 로딩을 기다리지 않는다 — 마이크로태스크를 비워 준다. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("startMusic 후보 목록", () => {
  it("앞 후보가 없으면 뒤 후보로 떨어진다", async () => {
    served.add("/b.ogg");
    const { startMusic } = await importMusic();

    startMusic(["/a.ogg", "/b.ogg"]);
    await settle();

    expect(asked).toHaveBeenCalledWith("/a.ogg");
    expect(asked).toHaveBeenCalledWith("/b.ogg");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("앞 후보를 두 번 다시 받지 않는다", async () => {
    served.add("/b.ogg");
    const { startMusic, stopMusic } = await importMusic();

    startMusic(["/a.ogg", "/b.ogg"]);
    await settle();
    stopMusic();
    startMusic(["/a.ogg", "/b.ogg"]);
    await settle();

    const first = asked.mock.calls.filter(([url]) => url === "/a.ogg");
    expect(first).toHaveLength(1);
  });

  it("전부 못 받으면 돌던 곡을 남긴 채 경고만 한다", async () => {
    served.add("/old.ogg");
    const { startMusic } = await importMusic();

    startMusic("/old.ogg");
    await settle();
    startMusic(["/new.ogg"]);
    await settle();

    expect(console.warn).toHaveBeenCalledTimes(1);
    // 돌던 곡이 남아 있어야 다음 요청이 같은 트랙을 다시 세우지 않는다
    const before = asked.mock.calls.length;
    startMusic("/old.ogg");
    await settle();
    expect(asked.mock.calls).toHaveLength(before);
  });
});
