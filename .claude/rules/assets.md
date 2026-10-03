# 에셋 규칙

에셋은 전부 `public/assets/`에 커밋한다 (외부 스토리지 없음). 리포와 Vercel 배포 용량을 지키는 것이 최우선.

## 포맷과 용량 한도

| 종류 | 위치 | 포맷 | 한도(파일당) |
|---|---|---|---|
| 3D 모델 | `public/assets/models/` | `.glb` (Draco 또는 Meshopt 압축 필수) | 5MB, 예외적으로 10MB |
| 텍스처 | `public/assets/textures/` | `.webp` 또는 `.ktx2`, 2의 제곱 크기, 최대 2048px. 예외: `room-poster-baseball.webp`(512×768)는 2:3 인쇄물 한 장이라 원본 비율을 둔다. 반복(Repeat) 없이 판 하나에 붙는 텍스처는 WebGL2에서 2의 제곱이 아니어도 밉맵이 생긴다 | 2MB |
| BGM | `public/assets/audio/bgm/` | `.mp3` 128kbps 또는 `.ogg` | 3MB |
| SFX | `public/assets/audio/sfx/` | `.mp3`/`.ogg` | 500KB |
| 영상 | `public/assets/video/` | `.mp4` (H.264 + AAC, faststart), 1080p 이하 | 15MB. 예외: 외전 `side-story-that-summer.mp4`는 101초라 1080p를 지키려고 24MB까지 둔다 (`check-assets.mjs`의 `SIZE_EXCEPTIONS`) |
| 이미지 | `public/assets/images/` | `.webp` (UI), `.svg` (아이콘). 예외: 로딩 애니메이션 `ui-loading.gif` 하나 (webp는 `<img>` 밖에서 재생이 안 돼 gif로 둔다) | 1MB |
| 폰트 | `public/assets/fonts/` | `.woff2`. 신규 폰트는 한글 서브셋 필수 (예외: PretendardVariable.woff2는 전 웨이트 가변폰트라 2.0MB 통짜 허용, next/font/local이 셀프호스팅) | 2MB |

- 절대 한도: **단일 파일 25MB** (초과 시 커밋 금지: 압축하거나 분할). GitHub 100MB 하드리밋에 근접하는 파일은 애초에 만들지 않는다.
- 압축되지 않은 `.gltf`+`.bin`+텍스처 낱개 커밋 금지. 항상 단일 `.glb`로 패킹.
- 컷씬·다시보기 스틸 같은 큰 그림은 흐린 미리보기가 따라다닌다. 그림을 넣거나 바꾸면 `pnpm images:blur` (대상 목록은 `scripts/build-image-blur.mjs`의 `BLUR_TARGETS`, 코드에서는 `src/lib/image-blur.ts`의 `blurBackdrop`/`blurDataUrlOf`).
- 모델은 `pnpm model:prep <내보낸.glb> <이름>` 하나로 압축·검사·배치가 끝난다. 블렌더 쪽 설정은 `docs/models/model-export.md`. 텍스처·오디오 압축 명령은 `/optimize-asset` 스킬 참고.

## 네이밍

- kebab-case, 접두사로 챕터/용도 표기: `ch1-room.glb`, `sfx-page-turn.mp3`, `bgm-main-theme.mp3`.
- 코드에서 에셋 경로는 문자열 리터럴 산재 금지: `src/lib/assets.ts`(경로 상수 모듈)에 모아서 참조.
- 서비스 워커는 에셋을 캐시 우선으로 읽는다. 같은 파일의 내용을 교체할 때는 참조 URL의 `?v=` 버전도 반드시 변경한다. 특히 모델과 애니메이션 코드가 함께 바뀌면 예전 캐시와 섞이지 않도록 한다. 저장 진행도를 지우는 방식으로 캐시를 갱신하지 않는다.

## 출처

- 기본적으로 사용자에게 에셋 추가를 요청한다. 사용자가 직접 넣는 것: 3D 모델, 미니게임용 이미지.
- 예외: 웹 UI 아이콘은 아이콘 라이브러리(`@phosphor-icons/react`)를 코드로 사용해도 된다. 아이콘을 이미지 파일로 커밋하지 않는다.
- 무료 에셋 사용 시 라이선스(CC0/CC-BY 등)와 출처 URL을 `public/assets/CREDITS.md`에 기록. CC-BY는 크레딧 표기 화면에도 반영해야 함.
- OFL 폰트는 라이선스 전문을 폰트 옆에 같이 커밋한다 (`fonts/OFL-<폰트명>.*`). OFL이 폰트 재배포 조건으로 요구한다. 새 폰트를 넣으면 `.github/scripts/check-assets.mjs`의 `FORMAT_EXCEPTIONS`에도 파일명을 더한다.
- 추천 소스: Poly Haven(CC0), Quaternius(CC0), Sketchfab(라이선스 필터), Mixamo(애니메이션), Freesound/Pixabay(오디오).
