# M1 통합 검토 항목

작성 시점에는 구현 중이므로 이미 수정된 항목은 재확인만 한다. 구현 변경은 OpenCode 서브에이전트가 담당한다.

1. Practice startAt(midboss/boss)를 replay 헤더에 저장·검증·복원해야 한다. 현재 헤더에는 없어 다른 위치에서 재생된다. 세 시작점 모두 round-trip 테스트.
2. hover 적은 필드 밖으로 퇴장하지 않고 stage 종료는 모든 적 소멸을 기다린다. 놓친 적 때문에 웨이브 진행이 영구 정지하지 않도록 퇴장 수명 또는 stage 타임라인 종료를 구현.
3. 진행 중 봄이 새 Spell로 넘어가면 eligible을 true로 재설정하여 봄으로 Spell 보너스를 얻을 수 있다. Spell 동안 봄 효과가 존재하면 보너스 자격을 없애고 회귀 테스트.
4. main.ts boot 안의 const frame이 RAF callback frame을 가려 requestAnimationFrame에 HTMLElement가 전달되는지 확인. 실제 브라우저 시작을 검증.
5. Replay pause 메뉴의 항목 수가 2로 계산되지만 실제 3개여서 Quit에 못 간다. X resume 표시와 실제 동작도 일치시킬 것.
6. 리플레이 입력 EOF 후 0 입력으로 계속 진행하지 말고 종료/결과로 전환. Replay 실행으로 Story hiscore를 저장하지 말 것.
7. 렌더러는 적/탄이 플레이필드 밖에서 HUD에 그려지지 않게 mask를 적용. 긴 캐릭터/샷/Spell/결과 텍스트가 640×480 밖으로 넘치지 않게 줄바꿈/배치.
8. 매 프레임 Graphics를 비우고 모든 탄 도형을 재생성하는 현재 구조를 수천 탄 스트레스에서 확인. 요구사항은 재사용 texture/sprite 배치. static 배경도 매 프레임 재생성 불필요.
9. 봄 이펙트, 2캐릭터/샷 구분, Power 옵션 시각화가 실제 보이도록 구현. 파란 원/사각형만 있는 화면은 일본풍 신사 슈팅의 첫 인상을 충족하지 않으므로 오리지널 절차적 캐릭터/신사 배경 및 고전 HUD를 완성.
10. 보스 콘텐츠 조회는 stage.midbossId/bossId를 실제 사용해야 함. 엔진이 midbossDef/bossDef 2개를 직접 고정 선택하는 구조를 해소.
11. RNG.state 증가를 uint32로 정규화. 리플레이 비교 snapshot이 bullet 수만 같다고 성공하지 않게 RNG/적/탄/아이템/페이즈 등 전체 결정 상태도 검증.
12. 파일 크기는 File.size로 읽기 전에 차단, 문자열 parse도 UTF-8 byte size를 검사. 무음 저장 후 다시 켜지는 동작, 두 Shift 동시 누름/한쪽 해제, pause 입력 고착도 확인.

명령 테스트 외에 실제 WebGL 브라우저 시작→선택→게임→정지→재시작 및 Practice→Replay 경로를 확인한다.

## 두 번째 검토에서 추가 확인

13. Renderer의 BULLET_SPRITES=2048인데 충돌 풀은 8192이다. 2049번째 이후 보이지 않는 탄환에 피탄될 수 있으므로 모든 활성 탄을 그려야 한다. 렌더 풀을 B.enemyBulletPool과 일치시키고 2048 초과 스트레스에서 확인한다.
14. 새 HUD 제목은 y=12..38인데 hudText.y=18이라 점수와 제목이 겹친다. 실제 .qa-title.png에서 확인됨. HUD 본문을 제목 아래로 옮기고 보스 HUD/긴 결과까지 영역 안에 배치한다.
15. Pixi init에 preference: 'webgl'을 명시하고 실제 렌더러가 WebGL인지 확인한다.
