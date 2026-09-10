import { buildFormBody, formResponseUrl, readFormConfig, validateFeedback } from "@/lib/feedback";

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
 */
export async function POST(request: Request): Promise<Response> {
  const config = readFormConfig(process.env);
  // 폼이 아직 연결 안 된 배포: 클라이언트는 이 코드로 "준비 안 됨"을 보여준다
  if (!config) return Response.json({ error: "unconfigured" }, { status: 503 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "malformed" }, { status: 400 });
  }

  const checked = validateFeedback(raw);
  if (!checked.ok) return Response.json({ error: checked.reason }, { status: 400 });

  const sent = await fetch(formResponseUrl(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody(config, checked.payload).toString(),
  });
  if (!sent.ok) return Response.json({ error: "upstream" }, { status: 502 });

  return Response.json({ ok: true });
}
