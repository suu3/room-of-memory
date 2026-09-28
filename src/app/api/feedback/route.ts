import { buildFormBody, formResponseUrl, readFormConfig, validateFeedback } from "@/lib/feedback";
import { clientIp, createRateLimiter, type RateLimitResult } from "@/lib/rate-limit";

const TEN_MINUTES = 10 * 60 * 1000;

/** 한 사람: 10분에 5건. 버그 몇 개를 연달아 적는 사람은 넉넉히 지나간다. */
const perClient = createRateLimiter({ limit: 5, windowMs: TEN_MINUTES });
/** 인스턴스 전체: 10분에 30건. IP를 바꿔 가며 몰아치는 경우의 바닥. */
const overall = createRateLimiter({ limit: 30, windowMs: TEN_MINUTES });

/**
 * 요청 본문 상한(바이트). 본문 2000자가 전부 3바이트 한글이어도 6KB 남짓이라
 * 이걸 넘는 건 모달이 보낸 게 아니다. 파싱 전에 자른다.
 */
const REQUEST_BYTES_MAX = 16 * 1024;

function tooMany(result: Extract<RateLimitResult, { ok: false }>): Response {
  return Response.json(
    { error: "rateLimited" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } },
  );
}

/**
 * 다른 사이트의 페이지가 방문자 브라우저를 빌려 쏘는 것을 막는다. 브라우저는
 * POST에 Origin을 늘 붙이므로, 붙었는데 이 호스트가 아니면 거절한다. Origin이
 * 없는 요청(curl 등)은 여기서 거르지 않고 요청 제한이 맡는다.
 */
function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

/**
 * 피드백 제출: 서버에서 구글 폼으로 넘긴다.
 *
 * 브라우저가 폼에 직접 쏘면 no-cors라 성공을 확인할 길이 없다. 여기서 대신
 * 보내면 응답 코드를 읽을 수 있어, "보냈습니다"가 빈말이 아니게 된다. 폼의
 * 응답은 시트에 자동으로 쌓인다. Sheets API·서비스 계정 없이 그 목적지에
 * 닿는 가장 짧은 길이다.
 *
 * 한계 하나는 알고 쓴다: 구글 폼은 entry id가 틀려도 200을 돌려준다. 여기의
 * 성공은 "구글이 받았다"까지고, "시트에 정확히 꽂혔다"는 배포 전에 한 번
 * 직접 보내서 확인해야 한다.
 *
 * 리포가 공개라 이 경로를 누구나 안다. 폼이 스팸함이 되지 않도록 요청 크기,
 * 출처, 횟수를 차례로 본다 (횟수 제한의 한계는 src/lib/rate-limit.ts).
 */
export async function POST(request: Request): Promise<Response> {
  const config = readFormConfig(process.env);
  // 폼이 아직 연결 안 된 배포: 클라이언트는 이 코드로 "준비 안 됨"을 보여준다
  if (!config) return Response.json({ error: "unconfigured" }, { status: 503 });

  if (isCrossSite(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > REQUEST_BYTES_MAX) {
    return Response.json({ error: "tooLarge" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    // content-length는 빠지거나 거짓일 수 있으니 실제로 받은 길이로 한 번 더
    if (new TextEncoder().encode(text).length > REQUEST_BYTES_MAX) {
      return Response.json({ error: "tooLarge" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "malformed" }, { status: 400 });
  }

  const checked = validateFeedback(raw);
  if (!checked.ok) return Response.json({ error: checked.reason }, { status: 400 });

  // 구글 폼에 닿는 것만 센다: 검증에서 떨어진 요청은 폼을 건드리지 않는다
  const client = perClient.hit(clientIp(request.headers));
  if (!client.ok) return tooMany(client);
  const all = overall.hit("all");
  if (!all.ok) return tooMany(all);

  const sent = await fetch(formResponseUrl(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody(config, checked.payload).toString(),
  });
  if (!sent.ok) return Response.json({ error: "upstream" }, { status: 502 });

  return Response.json({ ok: true });
}
