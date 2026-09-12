# Asset Credits

외부 에셋을 추가할 때마다 여기에 기록한다. CC-BY 이상은 게임 내 크레딧 화면에도 반영할 것.

야구배트는 GPT 제작, 야구공은 프로젝트 제작자의 직접 제작 모델임을 2026-09-12 사용자 확인으로 기록했다.

| 파일 | 출처 (URL) | 제작자 | 라이선스 |
|---|---|---|---|
| models/ch1-baseball-bat.glb | GPT로 제작한 야구배트 모델 (2026-09-12 사용자 출처 확인) | GPT | 프로젝트 생성 에셋 |
| models/ch1-baseball.glb | 프로젝트 제작자가 직접 만든 야구공 모델 (2026-09-12 사용자 출처 확인) | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| fonts/PretendardVariable.woff2 | https://github.com/orioncactus/pretendard (v1.3.9) | 길형진 (orioncactus) | SIL OFL 1.1 |
| fonts/Galmuri14.woff2 | https://quiple.dev/galmuri (눈누 웹폰트 빌드 https://noonnu.cc/font_page/1610) | Lee Minseo (quiple) | SIL OFL 1.1 |
| images/ui-creator-avatar.webp | 제작자가 직접 그린 토끼 낙서(2026-09-11). 만든 사람 화면의 프로필. ivory 배경으로 평탄화하고 정사각 512px로 잘라 webp 변환 | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| images/mg-ball-catch-sunset-field.webp | Generated with OpenAI built-in ImageGen for this project, 2026-07-26 | OpenAI built-in ImageGen | Project-generated |
| images/mg-ball-catch-pitcher.webp | Generated with OpenAI built-in ImageGen for this project, 2026-07-26 | OpenAI built-in ImageGen | Project-generated |
| images/mg-ball-catch-bat.webp | Generated with OpenAI built-in ImageGen for this project, 2026-07-26 | OpenAI built-in ImageGen | Project-generated |
| images/mg-ball-catch-impact.webp | Generated with OpenAI built-in ImageGen for this project, 2026-07-26 | OpenAI built-in ImageGen | Project-generated |
| images/mg-frequency-tune-frame.webp | 사용자가 직접 넣은 라디오 일러스트(2026-08-04). 흰 배경·표시창을 알파로 도려낸 뒤 webp로 변환 | 미기재 (사용자 제공) | 미기재 |
| images/mg-window-view-outside.webp | 사용자가 직접 넣은 창밖 일러스트(2026-08-04). webp로 변환 | 미기재 (사용자 제공) | 미기재 |
| models/ch1-radio.glb, models/room-books.glb, models/room-computer-*.glb, models/room-desk-lamp.glb, models/room-rug.glb, models/room-potted-plant.glb | 이 프로젝트를 위해 코드로 직접 제작(2026-09-12). 원본: scripts/create-original-furniture.mjs. 외부 모델·텍스처 사용 없음. DESIGN.md 씬 팔레트, Meshopt 압축 | Codex | 프로젝트 생성 에셋 |
| 거실 운동화·쿠션·담요·머그컵·접시·리모컨·TV장 (런타임 지오메트리) | 이 프로젝트를 위해 코드로 직접 제작(2026-09-12). src/scenes/memory-room/LivingRoomDetails.tsx 및 LivingRoomFurniture.tsx. 외부 모델·텍스처 사용 없음 | Codex | 프로젝트 생성 에셋 |
| models/room-potted-cactus.glb | 이 프로젝트를 위해 코드로 직접 제작(2026-09-11). 원본: scripts/create-cactus.mjs. 외부 모델·텍스처 사용 없음. DESIGN.md 씬 팔레트, Meshopt 압축 | Codex | 프로젝트 생성 에셋 |
| models/room-snack-bag.glb, models/room-study-papers.glb, models/room-cup-noodle-trash.glb, models/room-student-bookshelf.glb | 이 프로젝트를 위해 코드로 직접 제작(2026-09-10). 원본: scripts/create-student-props.mjs. DESIGN.md 씬 팔레트, 자체 작성한 가상 문제집·모의고사·컵라면·과자봉지 인쇄, Meshopt 압축 및 내장 WebP | Codex | 프로젝트 생성 에셋 |
| models/room-bed.glb | 프로젝트 제작자가 직접 만든 침대 모델(2026-09-08, 프레임·매트리스·베개·이불 + 이불 shape key `folded`). 재질이 없어 코드가 부품 이름으로 팔레트색을 입힌다. 블렌더 자동 이름(Cube·Plane…)을 부품 이름으로 바꾸고 계층을 펴고 밑면을 y=0에 맞춘 뒤 Meshopt 압축 (413KB → 127KB). 이전의 room-pillow.glb(같은 제작자의 베개)를 흡수 | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| models/ch1-gamepad.glb | 프로젝트 제작자가 직접 만든 게임패드 모델(2026-09-06). `pnpm model:prep`으로 밑면을 y=0에 맞추고 Meshopt 압축 (835KB → 167KB). 세워진 자세로 내보내져 씬에서 눕힌다 | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| models/ch1-smartphone.glb | 프로젝트 제작자가 직접 만든 스마트폰 모델(2026-09-07, 원본 smartphone.glb). `pnpm model:prep`으로 밑면을 y=0에 맞추고 Meshopt 압축 (61KB → 18KB). 세워진 자세로 내보내져 씬에서 눕히고, 화면 메쉬에 재질이 없어 코드가 종이색 화면을 입힌다 | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| models/rabbit-doll.glb | 프로젝트 제작자가 직접 만든 모델(2026-09-06). 밑면을 y=0에 맞추고 Meshopt 압축 (99KB → 33KB) | suu3 (프로젝트 제작자) | 프로젝트 저작물 |
| models/player-blocky.glb | 프로젝트 제작자가 직접 만든 `source.blend` (2026-09-06). 웹용 본·웨이트 정리, Idle/Walk/Sit/SitDown/StandUp 애니메이션 추가, Meshopt/WebP 압축. 2026-09-06 조끼 뒷면 수정본으로 재교체(사용자 재내보내기 → Meshopt 재압축 2.0MB → 585KB) | suu3 (프로젝트 제작자) · 리깅/애니메이션 작업 Codex | 프로젝트 저작물 |
| audio/bgm/bgm-room-winter-morning.ogg | https://pixabay.com/music/modern-classical-winter-morning-299362/ ("winter morning": 256kbps mp3를 앞뒤 무음 트림 후 Vorbis q4로 재인코딩) | Tomomi_Kato | Pixabay Content License (크레딧 불요, 상업 이용 가능) |
| audio/bgm/bgm-room-daylight.ogg | https://pixabay.com/ko/music/솔로-피아노-18021402-jazz-pop-piano-japan-afternoon-155522/ ("Jazz Pop Piano Japan Afternoon": 1바퀴. `pnpm audio:bgm`으로 무음 트림 후 Vorbis q4) | Pixabay | Pixabay Content License (크레딧 불요, 상업 이용 가능) |
| audio/bgm/bgm-room-second-light.ogg | https://pixabay.com/ko/music/현대-고전-hopeful-love-romantic-music-338664/ ("Hopeful Love Romantic Music": 2바퀴. `pnpm audio:bgm`으로 무음 트림 후 Vorbis q4) | Pixabay | Pixabay Content License (크레딧 불요, 상업 이용 가능) |
| ../icons/*.png | 사용자가 넣은 방 일러스트 원본(1254px, 2026-08-04)에서 생성: 바깥 검정을 알파로 도려내고 그림 경계로 크롭한 뒤 면적 평균으로 축소. maskable은 중앙 400px, apple-touch는 night 바탕에 불투명 | 미기재 (사용자 제공) | 미기재 |
| ../icons/apple-touch-icon.png (2026-09-10 수정) | OpenAI built-in ImageGen으로 바깥 테두리 제거. 원본 내부 픽셀을 보존해 합성하고 프로젝트의 Galmuri14 폰트로 `기 억 / 의 방` 두 줄 제목 추가. 글자색은 DESIGN.md의 ivory, 그림자는 night | 사용자 제공 원화 · 편집 Codex | 원화 라이선스 미기재 · 폰트 SIL OFL 1.1 |
| ../icons/icon-{192,512}.png, ../icons/icon-maskable-512.png, ../../src/app/favicon.ico (2026-09-11 수정) | 위 apple-touch 디자인을 기존 512px 원화와 같은 ImageGen 배경, Galmuri14로 합성해 각 크기로 출력. maskable은 제목 잘림을 피하도록 중앙 344px에 배치하고 DESIGN.md의 night 배경 사용. ICO는 16/32/48/64/128/256px PNG 프레임 포함 | 사용자 제공 원화 · 편집 Codex | 원화 라이선스 미기재 · 폰트 SIL OFL 1.1 |
