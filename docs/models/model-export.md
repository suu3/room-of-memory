# 블렌더에서 모델 내보내기

게임이 모델에 기대하는 것은 세 가지뿐이다. 나머지는 `pnpm model:prep`이 맞춰 준다.

| 규약 | 왜 |
|---|---|
| **밑면이 y=0** | 놓을 면의 높이를 그대로 좌표로 준다 (`position.y = 상판 높이`). 원점이 물건 한가운데 있으면 바닥에 반쯤 박힌다 |
| **정면이 +Z** | 캐릭터가 바라보는 방향, 의자가 앉는 방향이 전부 +Z 기준이다 (`seats.ts`의 facing) |
| **파일 하나(.glb)** | `.gltf` + `.bin` + 텍스처 낱개는 커밋하지 않는다 (`.claude/rules/assets.md`) |

블렌더는 Z-up, glTF는 Y-up이다. 내보내기 옵션의 **+Y Up**을 켜 두면 블렌더의 앞모습
(넘버패드 1로 보는 면)이 게임의 +Z가 된다. 그 화면에서 물건이 나를 보고 있으면 맞다.

## 내보내기 전에 (블렌더)

- **변환 적용**: `Ctrl+A ▸ All Transforms`. 오브젝트에 스케일 0.01 같은 게 남아 있으면
  본과 메쉬가 서로 다른 배율로 나가 애니메이션이 어긋난다.
- **원점을 발밑으로**: 물건을 z=0 위에 세우고, 3D 커서를 발밑 가운데에 둔 뒤
  `Object ▸ Set Origin ▸ Origin to 3D Cursor`.
- **서브디비전은 끄고 내보낸다**. 토끼 인형이 이것 때문에 12만 8천 버텍스(4.3MB)로
  나왔다. 배경 소품 하나가 주인공 캐릭터보다 무거워지면 안 된다. 모디파이어를 지우거나
  뷰포트/렌더 레벨을 0으로.
- **안 쓰는 데이터 정리**: `File ▸ Clean Up ▸ Purge Unused Data`를 두어 번. 플레이어
  모델에 **쓰지 않는 스킨이 하나 더** 붙어 나온 적이 있는데, 그게 있으면
  `SkeletonUtils.clone`이 그쪽에 물려 **애니메이션이 통째로 어긋난다**.
- **텍스처는 파일 안으로**: `File ▸ External Data ▸ Pack Resources`. 밖을 가리키면
  배포에서 404가 나고 모델이 흰 판으로 뜬다.

## 내보내기 설정

- 형식: **glTF Binary (.glb)**
- Include: 애니메이션이 있으면 `Selected Objects` 대신 아마추어까지 포함되게
- Transform: **+Y Up** ✓
- Data ▸ Mesh: `Apply Modifiers` ✓ (단, 위에서 서브디비전은 이미 껐다는 전제)
- Data ▸ Material: `Export Materials`, 이미지는 WebP 또는 Auto
- **Compression은 끈다**. Draco를 붙이면 브라우저가 디코더를 CDN에서 받아야 한다.
  이 프로젝트는 Meshopt를 쓰고, 그건 `pnpm model:prep`이 씌운다.
- Animation: 액션 이름이 곧 클립 이름이다. 플레이어 리그는 `Idle` `Walk` `Sit`
  `SitDown` `StandUp` 다섯을 **이 철자 그대로** 찾는다 (하나라도 없으면 로드가 터진다).
  액션의 마지막 키프레임이 첫 포즈로 되돌아오게 두지 말 것: 재생이 끝에서 첫 자세로
  튄다 (그래서 지금 SitDown/StandUp은 게임이 안 쓰고 가중치로 섞는다).

## Shape key로 여닫는 부품

침대 이불과 커튼은 애니메이션이 아니라 **shape key 하나**로 움직인다. 게임은 노드
이름으로 부품을, shape key 이름으로 자세를 찾고, 진행도(0~1)를 그 가중치에 쓴다.

| 모델 | 노드 | shape key | 0 | 1 |
|---|---|---|---|---|
| room-bed | `blanket` | `folded` | 펼쳐 덮여 있다 | 발치로 접혀 뭉친다 |
| room-curtain | `left` · `right` | `open` | 닫혀 창을 덮는다 | 바깥쪽 끝에 뭉쳐 창이 드러난다 |

- Basis가 0이고 shape key가 1이다. **이동까지 shape key에 넣는다.** 코드는 부품을
  옮기지 않으므로, 커튼은 젖힌 자세에서도 바깥쪽 매달린 끝이 닫힌 자세와 같은 자리에
  있어야 한다 (봉 끝에 걸려 있다).
- 내보내기 Data ▸ Mesh ▸ **Shape Keys** ✓. shape key가 있는 메쉬에는 `Apply Modifiers`가
  안 먹는다. 블렌더가 그 메쉬의 shape key를 조용히 버리므로 모디파이어는 미리 적용하거나 지운다.
- 부품은 합치지 않는다. `pnpm model:prep`은 shape key가 보이면 메쉬를 합치지 않고 압축만
  하고, 검사 결과에 `shape key: left.open, right.open`처럼 찍어 준다. 이 줄이 안 나오면
  내보내기에서 빠진 것이다.
- 지금 커튼(`room-curtain.glb`)은 `scripts/assets/create-curtain.mjs`가 식으로 만든 것이다. 블렌더로
  다시 만들면 같은 이름 규약으로 내보내 `model:prep`을 돌리고 `src/lib/assets.ts`의 `?v=`를
  올린다. 코드는 그대로고, 놓는 자리(`curtain-model.ts`의 실측)만 새 파일에 맞게 고친다.

## 내보낸 뒤

```bash
pnpm model:prep <내보낸.glb> <넣을-이름>
```

압축(Meshopt)하고, 밑면을 y=0으로 맞추고, 규약을 검사한 뒤 `public/assets/models/`에
넣는다. 통과하면 키·크기와 **배율 계산법**을 알려 준다. 방에서 키를 1.5로 두고 싶으면
`1.5 / 모델높이`가 scale이다.

그다음 사람이 할 일:

1. 새 모델이면 `src/lib/assets.ts`에 경로 추가.
2. **기존 파일을 교체했으면 그 경로의 `?v=`를 반드시 올린다.** 서비스 워커가 에셋을
   캐시 우선으로 읽어서, URL이 그대로면 옛 파일을 계속 내준다. "새로 내보냈는데
   애니메이션이 깨졌다"의 정체가 대개 이것이다.
3. `public/assets/CREDITS.md`에 출처 기록.
