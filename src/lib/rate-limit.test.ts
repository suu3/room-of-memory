import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("윈도 안에서 limit까지 통과시키고 그다음을 막는다", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });

    expect(limiter.hit("a", 0)).toEqual({ ok: true });
    expect(limiter.hit("a", 100)).toEqual({ ok: true });
    expect(limiter.hit("a", 200)).toEqual({ ok: false, retryAfterMs: 800 });
  });

  it("키마다 따로 센다", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.hit("a", 0).ok).toBe(true);
    expect(limiter.hit("b", 0).ok).toBe(true);
    expect(limiter.hit("a", 10).ok).toBe(false);
  });

  it("가장 오래된 요청이 윈도 밖으로 나가면 다시 받는다", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.hit("a", 0);
    expect(limiter.hit("a", 999).ok).toBe(false);
    expect(limiter.hit("a", 1000).ok).toBe(true);
  });

  it("막힌 요청은 세지 않는다: 계속 두드려도 풀리는 시각이 밀리지 않는다", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.hit("a", 0);
    for (let at = 100; at < 1000; at += 100) limiter.hit("a", at);
    expect(limiter.hit("a", 1000).ok).toBe(true);
  });

  it("키 상한을 넘으면 가장 오래 안 쓴 키를 잊는다", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });

    limiter.hit("a", 0);
    limiter.hit("b", 0);
    limiter.hit("c", 0);
    // a는 잊혔으니 새로 받고, c는 아직 기억한다
    expect(limiter.hit("a", 10).ok).toBe(true);
    expect(limiter.hit("c", 10).ok).toBe(false);
  });
});

describe("clientIp", () => {
  it("x-forwarded-for의 첫 값을 쓴다", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("없으면 x-real-ip, 그것도 없으면 unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
