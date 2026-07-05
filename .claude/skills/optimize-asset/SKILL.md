---
name: optimize-asset
description: 3D 모델(glb)·텍스처·오디오 에셋을 프로젝트 용량 규칙에 맞게 압축/변환한다. 에셋을 새로 받았거나 asset-auditor가 위반을 보고했을 때 사용.
---

# 에셋 최적화

대상 파일 경로를 인자로 받는다. 완료 기준은 `.claude/rules/assets.md`의 한도.

## GLB (목표: Draco 압축 + webp 텍스처, 5MB 이하)

```bash
# 검사
pnpm dlx @gltf-transform/cli inspect <file.glb>
# 최적화 (draco + 텍스처 webp 변환 + prune/dedup 일괄)
pnpm dlx @gltf-transform/cli optimize <in.glb> <out.glb> --compress draco --texture-compress webp
# 텍스처가 큰 경우 해상도 제한
pnpm dlx @gltf-transform/cli resize <in.glb> <out.glb> --width 2048 --height 2048
```

- 최적화 전후 용량과 `inspect` 결과(드로우콜 수, 버텍스 수)를 비교해 보고한다.
- Draco 압축 모델은 `useGLTF`가 자동 처리하지만, 씬에서 로드가 깨지지 않는지 dev 서버로 확인한다.

## 텍스처 단독 파일

```bash
pnpm dlx sharp-cli -i <in.png> -o <out.webp> --format webp -q 82
```

2의 제곱 크기(512/1024/2048)로 리사이즈. 노멀맵은 품질 90 이상 유지.

## 오디오

```bash
# BGM: 128kbps mp3
ffmpeg -i <in.wav> -codec:a libmp3lame -b:a 128k <out.mp3>
# SFX: 96kbps면 충분
ffmpeg -i <in.wav> -codec:a libmp3lame -b:a 96k <out.mp3>
```

ffmpeg이 없으면 `brew install ffmpeg`을 사용자에게 제안한다 (직접 설치하지 않는다).

## 마무리

- 원본(비압축) 파일은 커밋하지 않는다. 변환 후 원본은 삭제하되, 삭제 전에 변환 결과가 정상 로드되는지 확인.
- 새 에셋이면 `public/assets/CREDITS.md`에 출처/라이선스 기록을 요청하거나 추가한다.
