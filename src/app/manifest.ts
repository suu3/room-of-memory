import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트.
 *
 * 이 게임은 3D 씬·폰트·모델을 합쳐 첫 로딩이 가볍지 않고, 한 판이 15분쯤 걸린다.
 * 홈 화면에 설치해 두면 그 로딩을 매번 다시 치르지 않고, 브라우저 UI가 빠져
 * 화면을 씬이 전부 쓴다. 세로 화면에서 특히 크다.
 *
 * display를 "fullscreen"이 아니라 "standalone"으로 둔다. 전체화면은 상태바까지
 * 먹어서 몰입은 좋지만, iOS에서 홈 인디케이터와 겹치는 자리에 조이스틱이 놓인다.
 *
 * orientation은 적지 않는다. "any"로 명시하면 설치형 앱이 방향을 스스로 풀어서
 * 폰의 자동 회전 잠금을 무시하고 기울임대로 돌아간다. 방향은 앱이 아니라
 * 시스템 설정이 정하게 둔다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "기억의 방: Room of Memory",
    short_name: "기억의 방",
    description: "닫힌 방에 흩어진 기억을 하나씩 되찾는 짧은 3D 퍼즐 어드벤처.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // DESIGN.md의 night: 스플래시와 브라우저 테마가 방의 어둠과 이어지게 한다
    background_color: "#0B111A",
    theme_color: "#0B111A",
    lang: "ko",
    categories: ["games", "entertainment"],
    /*
     * 아이콘은 파비콘과 같은 그림(방 일러스트)이다. 탭에 보이는 그림과 홈 화면에
     * 놓이는 그림이 다르면 같은 앱으로 안 읽힌다. 테두리를 제거한 방 일러스트에
     * Galmuri14 제목을 합성한 512px 이미지에서 축소한다. 생성 절차는 CREDITS.md.
     *
     * maskable은 런처가 원·스퀴클로 잘라내므로 제목까지 안전하게 보이도록
     * 그림을 중앙 344px 안에 두고 바깥은 DESIGN.md의 night로 채운다.
     */
    icons: [
      {
        src: "/icons/icon-192.png?v=20260911",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=20260911",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png?v=20260911",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
