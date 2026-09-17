# M1 구현 보고서 (v0.1)

작성일: 2026-09-16. 대상: `docs/design-v0.1.md` M1 수용 기준 + `docs/review-notes.md` 전항목.
`docs/design-v0.1.md`, `docs/opencode-task.md`는 수정하지 않았다.

## 결과

- M1 전체 구현: Stage1(웨이브 9종, 약 75초) → 중간보스(통상·Spell·퇴장) →
  보스(등장·통상·Spell·통상·Spell·퇴장/클리어), 2캐릭터×2샷, 4난이도,
  Practice(3 시작점), 입력 리플레이 export/import/시청, Pages 빌드.
- 리뷰 12항목 전부 수정:
  1. 리플레이 헤더에 `startAt` 추가(스키마 v2; v1은 story-from-stage로 호환 읽기,
     story+startAt≠stage 거절). 세 시작점 round-trip 테스트.
  2. 적 `ttl` + 퇴장(후 150틱 상승 퇴각, 만료 시 무득점 이탈) + `wavesEndTick+3600`
     강제 전환. 무사격 방치해도 중간보스 도달 테스트.
  3. 봄이 새 Spell로 넘어가도 `bombActive>0 || pendingDeath>=0`이면 자격 false.
     회귀 테스트(Spell 중 봄 + Spell 진입 시 봄 지속).
  4. `boot()` 변수명을 `frameEl`로 수정(RAF 콜백 가림 해소).
  5. 일시정지 메뉴를 `pauseItems()` 단일 출처로 통일(실행/리플레이 각 3항목,
     항목 수로 이동). X도 재개로 동작하고 문구와 일치. 일시정지 진입/해제 시
     `held=0`으로 입력 고착 방지.
  6. 리플레이 입력 EOF 시 0 패딩 대신 결과 화면으로 전환. Hiscore 저장은
     `shouldSaveHiscore()`로: 리플레이 시청·Practice는 Story 기록 미오염.
  7. 플레이필드 마스크(Container mask)로 HUD 침범 차단. HUD 196px·오버레이
     500px wordWrap + `wrapText()`로 긴 이름/결과 줄바꿈.
  8. 탄/샷/아이템/적을 baked texture + 풀드 Sprite로 배치(탄 스프라이트 풀은
     시뮬레이션 풀과 동일한 8192 슬롯, 모든 활성 탄 렌더, 렌더 수는 HUD
     `BLT alive/peak-drop r<rendered>`에 표시; 상세는 항목 13). 배경/프레임은
     1회만 그림. 풀 `peak`/`dropped` 계수를 HUD에 표시.
  9. 봄 이펙트(캐릭터별 색·범위 링), 캐릭터별 기체 스프라이트(Aria 백적/
     Rin 자금), 샷 타입별 탄 스프라이트 4종, Power 단계별 옵션 오브(0~4),
     Focus 수렴 표시, 토리이·석등·별밤 정적 배경, 고전식 우측 HUD 패널.
  10. `getBoss(id, difficulty)` 레지스트리 + `stage.midbossId/bossId`로만 조회.
      엔진에 midboss/boss 고정 분기 없음.
  11. RNG 상태를 매 스텝 uint32 정규화. `digest()`(tick·RNG·플레이어·적·보스·
      탄/샷 체크섬·아이템·Spell 결과 FNV-1a)로 전체 결정 상태 비교.
      난이도별 상이함까지 테스트.
  12. `File.size` 사전 차단 + `parseReplayJson` UTF-8 바이트 검사(멀티바이트
      테스트 포함). 음소거를 별도 키(`ssd.muted.v1`)로 저장해 무음 저장 후에도
      복구됨. Shift 양쪽 공유 Focus 비트(`e.shiftKey` 확인). 일시정지 입력 고착
      제거(항목 5와 함께).

## 두 번째 검토 추가 수정 (항목 13~15)

- 13. 탄 스프라이트 2048 상한 제거: 풀을 `B.enemyBulletPool`(8192)과 동일
  크기로 할당하고, 동기 로직을 `src/ui/spriteSync.ts`로 분리해 활성 탄 전부를
  고정 순서로 배치한다(보이지 않는 치명탄 불가). 초과분 건너뛰기 개념과
  `saturatedBullets`를 삭제하고, HUD에 `BLT alive/peak-drop r<rendered>`
  (skipped 발생 시 `!SKIP<n>` 경고 표시)로 렌더 수를 노출한다.
  `tests/spriteSync.test.ts`(3000탄·8192탄 전량 렌더, tail 숨김, 부족 시 계수)
  + core 3000탄 스텝 결정성 테스트 추가.
- 14. HUD 겹침 수정: 제목 블록(8..42)과 겹치던 `hudText`를 y=48로 이동,
  본문 패널을 (48, 204×264)로 확장하고 쓰이지 않던 세 번째 박스를 삭제.
  보스명/결과 텍스트는 `wrapText`/wordWrap으로 캔버스 안에 유지.
  `docs/qa/qa-title.png`(겹침 없음), `qa-practice.png`(보스명 줄바꿈)로 확인.
- 15. Pixi init에 `preference: 'webgl'` 명시. `rendererName`/`isWebGL`을
  노출해 HUD `GFX` 줄에 표시하고, WebGL이 아니면 `!NOT WEBGL`로 화면에
  경고한다. 콘솔에도 `[renderer] backend=...` 기록. QA에서 `webgl` 확인.

## 검증 명령/결과

- `npm test` — 4파일 42개 전부 통과
  (core 21 / replay 13 / flow 4 / spriteSync 4).
- `npm run typecheck` — 통과.
- `npm run build` — 통과(`dist/` 생성, 상대 base).
- 브라우저 QA(`docs/qa/qa.mjs`, 허용된 Playwright+Chromium 153 headless,
  dev 서버 대상): 12/12 통과 —
  부팅→타이틀, WebGL 백엔드, Story 게임 진입, 틱 진행, 정지 오버레이,
  재개, 재시작(틱 리셋), 타이틀 복귀, Practice Midboss 시작,
  리플레이 import→재생, EOF 결과 전환, 페이지 오류 0건.
  스크린샷(저장소 내 `docs/qa/`): `qa-title.png`, `qa-game.png`,
  `qa-pause.png`, `qa-practice.png`, `qa-replay.png`, `qa-replay-end.png`
  (+ 픽스처 `qa-replay.json`, 드라이버 `qa.mjs`).
- Pixi v8 `renderer.generateTexture`는 설치된 `pixi.js` 타입 정의에 존재함을
  확인.

## 알려진 한계

- 수천 탄 동시 상황의 FPS는 측정하지 않았으므로 보장하지 않는다. 탄 스프라이트
  풀은 시뮬레이션 풀과 동일한 8192이며, 3000탄·8192탄 렌더 동기화는 테스트로
  검증했다. 현재 콘텐츠의 동시 탄수는 수백 수준이다.
- 서로 다른 브라우저의 부동소수점/삼각함수 차이까지 재현성을 주장하지 않는다.
- BGM 없음(합성 효과음만, 최초 입력 후 활성화·M 음소거). 완성 BGM이 있다고
  표현하지 않는다.

## 실제 밸런스값

설계 §4 초기 제안 그대로 사용, 변경 없음: `src/core/config.ts` 참조.
추가된 비전투 수치: `enemyTtl` 3600 / `hoverTtl` 2700 / `retreatTicks` 150 /
`stageFailsafeTicks` 3600, 탄 스프라이트 풀 = 적탄 풀 8192(동일),
리플레이 제한 5MB/216000틱.
