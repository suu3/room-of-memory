/**
 * 메모리 안의 슬라이딩 윈도 요청 제한.
 *
 * 피드백 접수(/api/feedback)가 구글 폼을 스팸 창구로 쓰이지 않게 막는 용도다.
 * 서버리스에서는 인스턴스마다 따로 세므로 전 세계 합계를 보장하지 못한다.
 * 한 사람이 연달아 누르는 것과 스크립트 한 대가 몰아치는 것까지를 막는
 * 문턱이고, 그 이상이 필요해지면 외부 저장소(KV)로 옮긴다.
 */

export interface RateLimitOptions {
  /** 윈도 안에서 허용하는 요청 수. */
  limit: number;
  windowMs: number;
  /** 기억하는 키 상한. 넘치면 가장 오래 안 쓴 키부터 잊는다: 메모리를 무한히 먹지 않게. */
  maxKeys?: number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export interface RateLimiter {
  /** 요청 하나를 센다. 막히면 센 것으로 치지 않는다. */
  hit(key: string, now?: number): RateLimitResult;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5000,
}: RateLimitOptions): RateLimiter {
  // Map은 삽입 순서를 지킨다. 쓸 때마다 지웠다 다시 넣어 "최근 사용" 순으로 둔다
  const hits = new Map<string, number[]>();

  return {
    hit(key, now = Date.now()) {
      const since = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((at) => at > since);
      hits.delete(key);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterMs: recent[0] + windowMs - now };
      }

      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { ok: true };
    },
  };
}

/**
 * 요청자 IP. Vercel은 x-forwarded-for의 첫 값에 실제 클라이언트를 넣는다.
 * 못 찾으면 한 바구니("unknown")로 묶는다: 새는 것보다 같이 막히는 쪽이 낫다.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
