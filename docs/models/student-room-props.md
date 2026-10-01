# 고3 생활 소품

`scripts/assets/create-student-props.mjs`가 직접 제작한 도형과 인쇄 아틀라스로 네 GLB를 만든다.

```powershell
node scripts/assets/create-student-props.mjs
pnpm exec vitest run src/scenes/memory-room/rooms/room/student-models.test.ts src/scenes/memory-room/rooms/room/student-props.test.ts src/scenes/memory-room/world/layout.test.ts
```

- `room-snack-bag.glb`: 뜯어서 바닥에 눕혀 둔 감자칩 봉지. 책상 앞과 침대 옆 바닥.
- `room-study-papers.glb`: 국어·수학 문제집, 채점한 고3 모의고사, 접힌 모서리와 펜. 책상 램프 앞.
- `room-cup-noodle-trash.glb`: 다 먹고 세워 둔 빈 컵과 젖힌 뚜껑, 컵에 꽂아 둔 젓가락. 책상 앞 바닥에 방향과 크기를 달리해 두 개 배치.
- `room-student-bookshelf.glb`: 3단 책장, 높이가 다른 책과 눕힌 문제집. 뒷벽 오른쪽 빈자리.

인쇄는 자체 작성한 가상의 문구이며 기존 Pretendard 폰트를 사용한다. 재질색은 `globals.css`의 DESIGN.md 씬 토큰에서 읽어 굽는다. 팔레트나 도형을 바꾸면 재생성하고 `src/lib/assets.ts`의 해당 URL 버전도 갱신한다.

재생성에는 프로젝트 의존성의 three.js와 Next.js가 사용하는 sharp, `pnpm dlx @gltf-transform/cli`가 필요하다. 임시 원본은 `.next/student-props/`에 쓴다. 변환을 정점에 적용한 뒤 재질별로 합쳐 모델당 5~8개 드로우콜로 제한한다. 인쇄 WebP를 먼저 내장하고 Meshopt 압축하여 UV가 제거되지 않게 한다. `model:prep`의 Node 검사기는 이미지 디코더가 없으므로, 이 텍스처 모델은 별도 테스트에서 실제 압축 정점과 UV·크기·바닥 원점·내장 이미지를 검사하고 브라우저에서 인쇄를 확인한다.

배치는 `StudentProps.tsx`, 책장 크기와 충돌 범위는 `layout.ts`의 `STUDENT_BOOKSHELF`에서 관리한다. 장식 소품으로 기존 스토리 진행에는 참여하지 않는다.
