# M2 Implementation Report (actuals only)

작성일: 2026-09-17. 대상: `docs/design-v0.2.md` v0.2 + plan
`docs/superpowers/plans/2026-09-17-m2-main-course.md` Tasks 1~8.
모든 명칭·대사·수치는 M2 구현용 임시값이며 최종 설정이 아니다.

## 구현 범위 (실제)

- Stage 1~6 연속 Story: `STAGE_ORDER = stage1..stage6`, 스테이지당 1개 `GameCore` +
  `RunCarry(score/graze/lives/bombs/power/extendsAwarded)` 승계, 과도 상태 초기화.
- 스테이지 seed 파생: `deriveStageSeed(runSeed, stageIndex)` (단일 혼합 상수 1곳,
  테스트 벡터 고정: `(0,0)->301794027`, `(42,1)->2860932040`, `(42,5)->1322396689`).
- 중간보스 6기(Sui/Kaho/Towa/Gaku/Raku/Haku, 각 intro+normal+spell+exit),
  메인보스 6기(Kiri/Iori/Nami/En/Shizu/Mikage).
  메인 페이즈 수(통상/Spell): 1·2·3단계 `[2,2]`, 4단계 `[2,3]`, 5단계 `[3,3]`,
  6단계 `[3,4]`. 임시 Spell명은 설계 §7 그대로 등록.
- 신규 공용 패턴 5종: `lanternCorridor`, `currentCross`, `bellPulse`,
  `mirrorPair`, `vowComposite`. 신규 적 이동 3종
  (`diagonalDown/crossField/stopAndGo`) + 보스 이동 3종
  (`fixed/sideSweep/pendulum`). Stage 번호 전용 엔진 분기·DSL·레이저 없음.
- 대사: 중간보스 공통 1+1줄, 메인보스 전투 전 6~10줄·격파 후 3~5줄을 양 캐릭터
  Aria/Rin별로 등록(설계 §8 원고 verbatim). 엔딩은 캐릭터별 4줄로 서로 다름.
- 해금: `ssd.progress.v2` (`maxClearedStage 1~6` + `endingsSeen{aria,rin}`),
  손상/범위 밖 값은 기본값 복구 + 메모리 fallback. Practice는 해금분만 표시.
- Replay: schemaVersion 2 유지, `GAME_VERSION 0.2.0`,
  `CONTENT_VERSION main6-draft.1`. Story는 `stage1+stage`만 허용, Practice는
  Stage 1~6 × `stage|midboss|boss`. 기존 M1 contentVersion은 거절.
- UI: Stage Card/대사/엔딩 오버레이, `STAGE n/6` HUD, 절차적 배경 6종
  (mist/cedar/river/forge/inverted/seal, 테마 변경 시 1회만 다시 그리기),
  타이틀 `Sealed Shrine (draft) — v0.2 M2`.
- DEV 전용 `window.__qa` 훅(`advanceCombat`/`setAutoAdvance` + 상태 조회)에
  `menu()`(메뉴 인덱스) 1개를 추가했다. 프로덕션 빌드에는 생성되지 않는다.

## 변경 파일

- 생성: `src/core/run.ts`, `src/content/stages.ts`, `src/content/bosses.ts`,
  `src/content/dialogue.ts`, `src/ui/themes.ts`,
  `tests/run.test.ts`, `tests/content.test.ts`, `tests/storage.test.ts`,
  `docs/implementation-report-m2.md`
- 수정: `src/core/gameCore.ts`, `src/core/types.ts`(필요 최소),
  `src/content/data.ts`(재-export), `src/content/patterns.ts`,
  `src/replay/replay.ts`, `src/ui/storage.ts`, `src/ui/flow.ts`,
  `src/ui/renderer.ts`, `src/main.ts`, `index.html`,
  `tests/core.test.ts`, `tests/flow.test.ts`, `tests/replay.test.ts`,
  `tests/spriteSync.test.ts`, `docs/qa/qa.mjs`, `README.md`
- 생성(QA 산출물): `docs/qa/qa-m2-*.png`(10개: title/stagecard/dialogue/stage6/
  ending-aria/ending-rin/result-aria/practice-locked/practice-unlocked/
  replay-result), `docs/qa/qa-m2-story.json`(6058 bytes, 전체 Story Replay)

## 검증 결과 (실제 실행값)

- `npm test`: 7파일 78개 전부 통과
  (flow 6, storage 2, spriteSync 4, run 2, content 13, replay 17, core 34).
- `npm run typecheck`: exit 0. `npm run build`: exit 0 (Vite, 738 modules).
- 브라우저 QA(`node docs/qa/qa.mjs`, Playwright Chromium headless, WebGL):
  **31/31 통과, 페이지 오류 0건**. 관측값: Stage 1~6 순서 진행
  `(stage1..stage6)`, 대사 70줄 관측, Aria 최종 점수 6551170점대 승계,
  `progress {maxClearedStage:6, endingsSeen:{aria:true,rin:false}}`,
  Rin 별도 엔딩 확인, Easy/Normal/Hard/Lunatic Stage 6 시작 확인,
  전체 Story Replay export(6058 bytes) → import → Stage 6 EOF 결과 도달.
- 스크린샷 육안 확인: 640×480 고정, 우측 HUD 분리, 테마 구분, 긴 Spell명·대사·
  엔딩·결과 텍스트의 겹침/잘림 없음(결과 화면 Spell 줄바꿈+40자 래핑 수정 포함).

## 설계 대비 편차

1. `window.__qa`에 계획 외 `menu()` 조회 1개 추가 — QA 드라이버가 Watch Replay
   메뉴 선택을 단언하기 위한 DEV 전용 읽기 훅이며 게임 동작에 영향 없음.
2. QA 드라이버(`docs/qa/qa.mjs`)에 관측 보정 2건 — (a) 재시작 검사 후 이미
   진입한 Stage 1 카드를 visit-order 단언의 seed로 포함(게임 코드 변경 없음),
   (b) 리플레이 import 전 타이틀 보장 루프 + filechooser 실패 시 화면/메뉴
   진단. 둘 다 드라이버 강건화이며 승인된 브라우저 QA 흐름(§10.2)은 그대로다.
3. 결과 화면 Spell 목록을 ` | ` 연결에서 줄바꿈 1줄씩 + 40자 래핑으로 변경 —
   §10.2의 겹침 금지 요구를 만족하기 위한 표시 수정이며 Spell 결과 데이터·
   판정에는 변경 없음.
4. Task 실행 주체: M2 구현 본체는 `general` Task가 작성했다. 그 최종 상태 보고만
   외부 디렉터리(`/tmp`) 권한 요청 1건이 거부되면서 실패했고, 그 외 실패는
   없었다. 권한 확대 요청 없이 저장소 내 통상 파일 도구로 남은 검증·문서
   작업을 수행하고 전수 재검증했다(아래 한계 참조).

## 알려진 한계

- 브라우저 QA의 전체 Story 진행·리플레이 재생은 DEV 전용 `setAutoAdvance`
  훅을 켠 상태로 검증했다. 이는 6스테이지 UI 흐름(카드/대사/엔딩/해금)과
  훅 하의 결정적 재생(export→import→Stage 6 결과 도달)을 보이며, 사람 속도
  순수 입력 플레이를 증명하지는 않는다.
- 합성 6코어 테스트는 스테이지당 동일 seed+고정 120마스크+carry 전달 시
  digest가 일치하고 난이도를 바꾸면 달라짐을 보인다. 사람 플레이 입력도,
  스테이지 전체 클리어도 아니며, 시드 파생/carry 배관의 로직 수준 결정성만
  검증한다. `playReplay` digest 테스트는 동일 입력에 대해 리플레이 헬퍼가
  live 1스테이지 코어를 재현함을 보인다.
- `src/replay/replay.ts`의 `playReplay()`는 M2 이전에 Story용 파생 시드/
  carry를 반영하지 않았던 버그가 있었다. `buildReplayCore()`를
  `replay.ts`로 옮겨 UI 재생과 공유하도록 수정했고, Story 파생 시드 회귀
  테스트(`tests/core.test.ts`)로 고정했다. Practice 동작은 변경 없다.

- Tasks 1~7은 `general` Task가 작성했다. 다만 태스크별 strict RED/GREEN
  로그는 보존되지 않았다. 신뢰 근거는 기록된 리플레이 수정 RED/GREEN +
  전체 `npm test`/`typecheck`/`build`/브라우저 QA이다.
- 저장소에 git 커밋이 아직 없다(`main` 브랜치, 전 파일 untracked). 커밋·push·
  배포는 위임 문서 금지 규칙에 따라 수행하지 않았다.
- 오디오는 절차적 효과음(draft)이며 완성 BGM/믹싱이 아니다. 최종 아트·밸런스·
  기기별 성능 목표는 측정하지 않았다.

## Replay 호환성

- M2 Story/Practice Replay(`0.2.0`/`main6-draft.1`)끼리 round-trip, 합성
  6코어 digest 일치, 훅 하 전체 Story 재생 결정성이 확인됐다(사람 속도
  end-to-end 입력 재생의 증명은 아니다).
- M1 contentVersion 리플레이는 버전 불일치 오류로 명확히 거절된다.
- Story Replay header는 항상 `stageId: 'stage1'`, `startAt: 'stage'`다.

## M3 잔여 범위

Extra Stage와 해금 조건 · Continue 규칙 · 최종 캐릭터·배경 일러스트와 애니메이션 ·
완성 BGM과 사운드 믹싱 · 업적, 스코어보드 세분화와 중간 run 저장 ·
최종 밸런스와 브라우저/기기별 성능 목표 · 임시 제목·인물명·대사·Spell명의 최종 설정 확정.
