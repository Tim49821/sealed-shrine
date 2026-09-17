# Sealed Shrine (draft) — M2 v0.2 메인 코스

브라우저 탄막 슈팅의 M2(스테이지 1~6 연속 Story + 중간보스/보스 + 양 캐릭터 대사·엔딩)
구현. 모든 명칭·수치는 임시(draft)이며 `docs/design-v0.2.md`의 임시값을 그대로
사용한다. 원작 에셋/패턴/음악/스토리 복제 없음 — 스프라이트·효과음 모두 절차적
오리지널이다.

## 실행

- `npm install` (또는 `npm ci`)
- `npm run dev` → http://127.0.0.1:5173
- `npm test` / `npm run typecheck` / `npm run build`
- `npm run preview` 로 빌드 결과 확인. Vite `base: './'` 이므로 GitHub Pages 하위 경로에서도 동작.
- 브라우저 QA: `npm run dev -- --host 127.0.0.1` 후 `node docs/qa/qa.mjs <URL>`

## 조작

방향키 이동(대각선 정규화) · Z 샷/확인(홀드) · X 봄/뒤로(상승 에지 1회) ·
Shift Focus(저속·피탄점·샷 수렴) · Esc 일시정지/뒤로 · Enter 확인 보조 · M 음소거.

흐름: 타이틀 → Story(Main Course)/Practice/리플레이시청/조작법 → 난이도 →
캐릭터 → Shot → (Story: Stage Card → 스테이지 → 중간보스 대사 → 보스전 대사 →
보스 → 격파 대사 → 다음 Stage Card … → Stage 6 → 캐릭터별 엔딩 → 최종 결과).
대사는 Z/Enter로 한 줄씩 진행하며 X/Esc로 건너뛰지 않는다. 일시정지: 재개/재시작/타이틀.
Practice는 해금된 스테이지의 Stage 통째/Midboss/Boss 시작 선택. Continue 없음 —
Game Over에서는 Story 재시작 또는 타이틀로 돌아간다.

## 범위 (M2)

- Stage 1~6 연속 Story. 점수·Graze·잔기·봄·Power·Extend 상태를 다음 스테이지로
  승계하고 위치·무적·입력·적/탄/Spell 진행은 초기화한다. Stage 1~5 보스 격파는
  격파 대사 → 다음 Stage Card로 이어지고 Stage 6 격파 후 최종 결과·엔딩을 표시한다.
- 2캐릭터(Aria/Rin)×2샷, 4난이도(개수·속도·조준·간격·구조가 각각 다름, 속도 단일 배율 아님).
  보스 대사와 엔딩은 캐릭터별로 다르다.
- Story에서 Stage N 클리어 시 Stage N의 stage/midboss/boss 시작점을 Practice에
  해금한다(Stage 1은 처음부터 해금, 난이도 공유). 잠긴 스테이지는 목록에 표시하지
  않는다. 진행 저장은 `ssd.progress.v2` 한 키만 사용한다.
- 전체 Story Replay 1개(연속 입력 배열, run seed 1개 + 스테이지별 파생 seed)와
  Stage 1~6 × stage/midboss/boss Practice Replay. 스키마 v2 유지,
  `GAME_VERSION 0.2.0`, `CONTENT_VERSION main6-draft.1`. M1 contentVersion
  리플레이는 명확히 거절한다. Practice/Replay는 hiscore·해금을 변경하지 않는다.
- 640×480 고정, 우측 HUD(`STAGE n/6` 포함), 정수 배율 확대, 키보드 전용,
  WebGL 렌더러 명시. 스테이지별 절차적 배경 6종(mist/cedar/river/forge/inverted/seal).

## 임시 밸런스 실제값

`src/core/config.ts` — M1과 동일한 전투 계약을 유지한다:

이동 3.8/1.65(Aria), 4.0/1.7(Rin) px/tick · 피탄 2.5/Graze 18 px ·
생명 3(현재 포함)/봄 3 · Deathbomb 8틱 · 사망무적 180틱 · 봄무적 180틱·지속 120틱 ·
Power 0~4.00(+0.05) · 회수선 y≤112·Power≥2.00 · Extend 100k/300k/600k ·
적탄풀 8192/샷풀 512(초과 결정적 무시) · Graze 100점 ·
Point 1000(하단)~10000(상단) · 사망시 Power −1.0·봄 3 리셋.
보스 HP 배율 `[0.7, 1, 1.3, 1.6]`, 통상 35~45초·Spell 45~55초, Stage 6 개별 HP는
Stage 5를 넘지 않는다. 전 스테이지 임시 웨이브 수치는 `src/content/stages.ts`,
Spell 임시명은 `src/content/bosses.ts`, 임시 대사 원고는 `src/content/dialogue.ts`.

## 검증

`npm test` (77개: run/carry/seed·레지스트리 완전성·패턴 등록/구조·이동·탄풀·
저장/해금·flow·리플레이 결정성/round-trip·Deathbomb 경계·Graze 중복·풀 정책·
Extend·Spell 자격·RNG uint32·다이제스트·스프라이트 동기화),
`npm run typecheck`, `npm run build` 통과.
실제 Chromium 브라우저 QA(`docs/qa/qa.mjs`, 31개 체크 전부 통과, WebGL, 페이지
오류 0건): 타이틀→Practice 잠금 확인→Story Stage Card→정지/재개/재시작→Stage
1~6 순서 진행(70줄 대사 관측)→Aria 엔딩·최종 결과→점수 승계·해금 확인→Rin 별도
엔딩→4난이도 Stage 6 시작→전체 Story Replay import→Stage 6 EOF 결과.
스크린샷 `docs/qa/qa-m2-*.png`, 전체 Story 리플레이 `docs/qa/qa-m2-story.json`.
상세 결과·한계는 `docs/implementation-report-m2.md`.

## 남은 작업 (M3)

Extra Stage와 해금 조건 · Continue 규칙 · 최종 캐릭터/배경 일러스트와 애니메이션 ·
완성 BGM과 사운드 믹싱 · 업적, 스코어보드 세분화와 중간 run 저장 ·
최종 밸런스와 브라우저/기기별 성능 목표 · 임시 제목·인물명·대사·Spell명의 최종 설정 확정.
