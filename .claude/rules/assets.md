# 에셋 규칙

에셋은 전부 `public/assets/`에 커밋한다 (외부 스토리지 없음). 리포와 Vercel 배포 용량을 지키는 것이 최우선.

## 포맷과 용량 한도

| 종류 | 위치 | 포맷 | 한도(파일당) |
|---|---|---|---|
| 3D 모델 | `public/assets/models/` | `.glb` (Draco 또는 Meshopt 압축 필수) | 5MB, 예외적으로 10MB |
| 텍스처 | `public/assets/textures/` | `.webp` 또는 `.ktx2`, 2의 제곱 크기, 최대 2048px | 2MB |
| BGM | `public/assets/audio/bgm/` | `.mp3` 128kbps 또는 `.ogg` | 3MB |
| SFX | `public/assets/audio/sfx/` | `.mp3`/`.ogg` | 500KB |
| 이미지 | `public/assets/images/` | `.webp` (UI), `.svg` (아이콘) | 1MB |
| 폰트 | `public/assets/fonts/` | `.woff2`. 신규 폰트는 한글 서브셋 필수 (예외: PretendardVariable.woff2는 전 웨이트 가변폰트라 2.0MB 통짜 허용, next/font/local이 셀프호스팅) | 2MB |

- 절대 한도: **단일 파일 25MB** (초과 시 커밋 금지 — 압축하거나 분할). GitHub 100MB 하드리밋에 근접하는 파일은 애초에 만들지 않는다.
- 압축되지 않은 `.gltf`+`.bin`+텍스처 낱개 커밋 금지. 항상 단일 `.glb`로 패킹.
- 압축 명령은 `/optimize-asset` 스킬 참고 (`pnpm dlx @gltf-transform/cli`).

## 네이밍

- kebab-case, 접두사로 챕터/용도 표기: `ch1-room.glb`, `sfx-page-turn.mp3`, `bgm-main-theme.mp3`.
- 코드에서 에셋 경로는 문자열 리터럴 산재 금지 — `src/lib/assets.ts`(경로 상수 모듈)에 모아서 참조.

## 출처

- 무료 에셋 사용 시 라이선스(CC0/CC-BY 등)와 출처 URL을 `public/assets/CREDITS.md`에 기록. CC-BY는 크레딧 표기 화면에도 반영해야 함.
- 추천 소스: Poly Haven(CC0), Quaternius(CC0), Sketchfab(라이선스 필터), Mixamo(애니메이션), Freesound/Pixabay(오디오).
