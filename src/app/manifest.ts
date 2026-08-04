import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트.
 *
 * 이 게임은 3D 씬·폰트·모델을 합쳐 첫 로딩이 가볍지 않고, 한 판이 15분쯤 걸린다.
 * 홈 화면에 설치해 두면 그 로딩을 매번 다시 치르지 않고, 브라우저 UI가 빠져
 * 화면을 씬이 전부 쓴다 — 세로 화면에서 특히 크다.
 *
 * display를 "fullscreen"이 아니라 "standalone"으로 둔다. 전체화면은 상태바까지
 * 먹어서 몰입은 좋지만, iOS에서 홈 인디케이터와 겹치는 자리에 조이스틱이 놓인다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "기억의 방 — Room of Memory",
    short_name: "기억의 방",
    description: "닫힌 방에 흩어진 기억을 하나씩 되찾는 짧은 비주얼 노벨.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // DESIGN.md의 night — 스플래시와 브라우저 테마가 방의 어둠과 이어지게 한다
    background_color: "#0B111A",
    theme_color: "#0B111A",
    lang: "ko",
    categories: ["games", "entertainment"],
    /*
     * 아이콘은 파비콘과 같은 그림이다 — src/app/favicon.ico의 방 일러스트를 키운 것.
     * 탭에 보이는 그림과 홈 화면에 놓이는 그림이 다르면 같은 앱으로 안 읽힌다.
     * 픽셀아트라 확대는 nearest로만 한다(보간하면 뭉갠다). 생성 절차는 CREDITS.md.
     *
     * maskable은 런처가 원·스퀴클로 잘라내므로 그림을 중앙 400px 안에 두고
     * 바깥은 night로 채운다 — 잘려 나가는 건 방의 빈 모서리뿐이다.
     */
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
