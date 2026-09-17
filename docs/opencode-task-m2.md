# OpenCode 구현 위임 — M2

사용자는 `docs/design-v0.2.md`를 승인했으며 OpenCode 실제 `general` Task 서브에이전트 구현을
요청했다. 설계를 다시 승인받기 위해 멈추지 말고, 아래 문서의 작업 순서와 검증 gate를 따른다.

1. 먼저 `docs/design-v0.2.md`와
   `docs/superpowers/plans/2026-09-17-m2-main-course.md` 전체를 읽는다.
2. 반드시 OpenCode의 Task 도구로 `general` 구현 서브에이전트를 호출한다. Codex 내장
   서브에이전트나 주 OpenCode 세션의 직접 대량 구현으로 대체하지 않는다.
3. 구현 소유자는 한 `general` Task로 시작해 계획 Task 1~8을 순서대로 수행한다. 각 Task의
   RED→GREEN 명령과 review checkpoint를 통과한 뒤 다음 Task로 간다.
4. 주 OpenCode 세션은 실제 diff와 테스트 출력을 독립 확인한다. 완료 주장만 신뢰하지 않는다.
5. 기존 M1 사용자 파일과 동작을 보존한다. 설계/계획/위임 문서의 의미를 변경하지 않는다.
6. 이 저장소 안에서만 수정한다. 새 의존성, 외부 디렉터리, 비밀값, 권한 확대, git commit/push,
   Pages 배포와 공개 작업은 금지한다.
7. 미정 제목·인물·대사·Spell·밸런스는 설계의 임시값으로 구현하고 최종 설정이라고 표현하지 않는다.
8. Stage 번호 전용 엔진 분기, 이벤트 DSL, 레이저, Continue, Extra, 최종 BGM/아트, 업적,
   중간 저장을 추가하지 않는다.
9. `npm test`, `npm run typecheck`, `npm run build`와 `docs/qa/qa.mjs` Chromium QA를 새로
   실행한다. 실패하면 같은 Task가 원인을 수정하고 전체 관련 검증을 반복한다.
10. `README.md`와 `docs/implementation-report-m2.md`에는 실제 구현값, 테스트 수, 브라우저
    결과, Replay 호환성, 알려진 한계와 M3 잔여 범위만 기록한다.
11. 완료 보고에는 OpenCode 부모 session ID와 `general` Task ID, 변경 파일, 명령별 실제 결과,
    브라우저 QA 결과, 설계 대비 편차, 남은 M3 범위를 짧게 포함한다.

M2 완료 범위는 메인 Stage 1~6, 전체 중간보스/보스, 두 캐릭터별 대사·엔딩, 연속 Story,
Practice 해금과 전체 Story/Practice Replay다. Extra나 최종 마감 완료로 표현하지 않는다.
