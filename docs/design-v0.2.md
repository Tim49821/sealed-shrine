# Sealed Shrine (가제) — M2 메인 코스 설계 v0.2

작성일: 2026-09-17. 이 문서는 `docs/design-v0.1.md`의 M1 계약을 유지하면서
M2(메인 6스테이지)를 구현할 수 있도록 콘텐츠, 진행, 저장, 리플레이와 수용 기준을 추가한다.

게임 제목, 인물명, 스테이지명, 대사, Spell명과 아래 수치는 **M2 구현용 임시값**이다.
사용자 승인 없이 최종 설정으로 취급하지 않는다. 반면 §1의 범위와 §3~5의 동작 계약은
M2 구현 기준으로 사용한다.

## 1. M2 범위와 승인된 결정

- Stage 1부터 Stage 6까지 이어지는 메인 코스를 구현한다.
- 사건은 “봉인의 외부 침입”이 아니라 **내부 관리인이 폭주 직전의 봉인을 의도적으로
  해체한 사건**이다.
- Aria와 Rin은 같은 스테이지를 진행하되 보스 대사와 엔딩이 다르다.
- Story는 Stage 1→6 연속 진행이며 점수, Graze, 잔기, 봄, Power, Extend 상태를 승계한다.
- 클리어한 스테이지만 Practice의 Stage/Midboss/Boss 시작점으로 해금한다.
- 데이터 중심 구조를 유지한다. 콘텐츠 때문에 `stage === N` 분기를 엔진에 추가하지 않는다.
- 기존 `StageDef`, `BossDef`, `PatternFn`을 확장하며 새 규칙은 실제 콘텐츠에 필요한 최소
  공용 primitive만 추가한다.
- Continue는 제공하지 않는다. Game Over에서는 전체 Story 재시작 또는 타이틀로 돌아간다.
- Extra, 최종 일러스트/BGM, 업적, 중간 저장과 신규 레이저 판정은 M3 범위다.

## 2. 사건과 결말

신사의 봉인은 오래된 맹세와 잊힌 이름을 안쪽에 계속 축적해 왔다. 봉인 관리인 Mikage는
봉인이 자연 파열하면 주변 영혼까지 함께 소거된다고 판단해, 종장인 En에게 해체 열쇠를
의뢰하고 봉인을 먼저 깨뜨렸다. 그 결과 기억 조각이 역류하고 신사 주변 공간이 뒤집힌다.

Stage 1의 Kiri는 균열이 신사 내부에서 시작됐다고 알린다. Stage 2~4에서 주인공은 조각이
영혼의 강을 거슬러 산정의 종으로 모인다는 사실과 En의 개입을 확인한다. Stage 5의 Shizu는
Mikage의 목적이 단순 파괴가 아니라 강제 소거라는 사실을 밝힌다. Stage 6에서 주인공은
Mikage의 방식만 저지하고, 다시 축적되어 폭주하지 않는 봉인을 만든다.

- **Aria 엔딩:** 맹세가 일정 주기로 바깥에 흘러나와 정화되는 순환식 봉인을 세운다.
- **Rin 엔딩:** 기억을 가두지 않고 소유자에게 돌려보내는 개방형 결계를 만든다.
- 두 엔딩 모두 Extra의 직접적인 적을 보여주지 않는다. 회수되지 않은 조각 하나가 밤하늘로
  사라지는 장면만 남긴다.

## 3. Story 진행 계약

### 3.1 Run 상태

`GameCore` 하나는 지금처럼 한 스테이지만 담당한다. 별도 거대 관리자 클래스를 만들지 않고
평범한 데이터 `RunCarry`와 변환 함수로 다음 스테이지를 시작한다.

```ts
interface RunCarry {
  score: number;
  graze: number;
  lives: number;
  bombs: number;
  power: number;
  extendsAwarded: boolean[];
}
```

- Stage Clear 시 위 값만 다음 `GameCore`로 전달한다.
- 플레이어 위치는 시작 위치로, `pendingDeath`, 무적, 봄 효과, 입력 edge, 적·탄·아이템과
  Spell 진행 상태는 초기화한다.
- 스테이지 사이에 잔기·봄·Power를 보충하지 않는다.
- Stage 1~5의 보스 격파는 중간 결과 화면이 아니라 격파 대사 → 다음 Stage Card → 다음
  스테이지로 이어진다. Stage 6 격파 후에만 최종 결과와 엔딩을 표시한다.
- 기존 hiscore는 Story 전체 점수만 갱신한다. Practice와 Replay는 갱신하지 않는다.
- 새 Stage Clear 보너스 공식은 만들지 않는다. 기존 적·아이템·Spell 점수를 합산한다.

Story 순서는 아래 단일 상수를 사용한다.

```ts
const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6'] as const;
```

### 3.2 Seed와 결정성

Replay 헤더의 run seed 하나만 저장한다. 각 스테이지 seed는 `runSeed`, 0부터 시작하는
`stageIndex`를 입력으로 받는 순수 `deriveStageSeed()` 함수로 만든다. 함수는 uint32 결과를
반환하고 seed 0도 기존 `Rng` 규칙에 따라 유효하게 처리한다. 실제 혼합 상수와 식은 한 곳에
두고 테스트 벡터로 고정한다.

대사와 Stage Card 중에는 `GameCore.step()`과 Recorder를 호출하지 않는다. Story Replay는
대사를 자동 생략하고 결정적인 `core.phase === 'clear'` 경계에서 다음 스테이지를 생성한다.
따라서 Replay body는 기존처럼 하나의 연속 입력 배열이며 별도 구간 포맷이나 DSL은 만들지 않는다.

## 4. 대사와 화면 흐름

화면 흐름은 다음과 같다.

`타이틀 → Story 선택 → 난이도 → 캐릭터 → Shot → Stage Card → 스테이지 → 보스 전 대사 → 보스 → 격파 대사 → 다음 Stage Card … → Stage 6 보스 → 격파 대사 → 캐릭터별 엔딩 → 최종 결과`

- `dialogue`와 `ending`은 UI 상태이며 전투 엔진 상태가 아니다.
- Z/Enter의 새 입력 edge로 다음 줄을 표시한다. 대사 진입·종료 때 `held=0`으로 입력 고착과
  대사 종료 직후의 오발을 막는다.
- X/Esc로 대사를 건너뛰지 않는다. 한 줄씩 진행하는 단순한 계약만 제공한다.
- Replay 시청은 대사와 엔딩을 자동 생략하고 전투 및 최종 결과만 재생한다.
- 대사는 `stageId + playerId + before/after`로 조회하는 콘텐츠 데이터다. 판정 코드와
  `GameCore`는 대사 문장을 알지 않는다.
- 중간보스는 공통 등장 1줄과 패배 1줄만 사용한다. 메인 보스는 전투 전 6~10줄, 격파 후
  3~5줄을 사용한다.
- 말하는 인물명과 본문은 500px 안에서 줄바꿈하고 640×480 밖으로 넘치지 않는다.

## 5. Practice, 저장과 Replay

### 5.1 Practice 해금

- Stage 1은 처음부터 해금한다.
- Story에서 Stage N을 클리어하면 Stage N의 `stage`, `midboss`, `boss` 시작점을 모두 해금한다.
- 난이도별로 중복 해금하지 않는다. 한 난이도에서 클리어하면 모든 난이도에서 연습할 수 있다.
- 잠긴 스테이지는 Practice 목록에 선택 가능한 항목으로 표시하지 않는다.
- Practice는 기존과 같이 최대 Power, 기본 잔기·봄으로 시작하며 Story carry를 사용하지 않는다.
- Replay import는 로컬 해금과 무관하게 유효한 Practice Replay를 시청할 수 있다.

저장은 기존 키를 유지하고 아래 한 키만 추가한다.

```ts
interface ProgressV2 {
  maxClearedStage: 1 | 2 | 3 | 4 | 5 | 6;
  endingsSeen: { aria: boolean; rin: boolean };
}
// localStorage key: ssd.progress.v2
```

손상, 누락, 범위 밖 숫자와 알 수 없는 캐릭터 값은 기본값
`{ maxClearedStage: 1, endingsSeen: { aria: false, rin: false } }`로 복구한다.
localStorage를 사용할 수 없으면 현재 세션 메모리 fallback을 사용한다. 중간 run 저장은 없다.

### 5.2 Replay

- Replay JSON 형태와 schemaVersion 2는 유지한다.
- `GAME_VERSION`은 `0.2.0`, `CONTENT_VERSION`은 `main6-draft.1`로 올린다.
- Story header는 항상 `stageId: 'stage1'`, `startAt: 'stage'`다.
- Practice header는 Stage 1~6과 `stage | midboss | boss`를 허용한다.
- 최대 216,000틱/5MB 제한은 유지한다. 6스테이지 전체가 이 한도 안에 들어오도록 콘텐츠
  제한시간을 잡는다.
- M1의 다른 contentVersion Replay는 상태가 달라질 수 있으므로 명확히 거절한다.
- 전체 Story 최종 digest에는 stage index, carry, RNG, 적·탄·아이템, 보스/Spell 결과를 포함한다.

## 6. 스테이지 구성

아래 명칭과 틱은 임시 구현값이다. 각 일반 구간은 빠른 웨이브 처리와 읽을 수 있는 휴지기를
번갈아 배치한다. 화면 밖에서 오래 머무는 적은 기존 ttl/퇴장 계약을 따른다.

| Stage | 임시명 / 일반 구간 | 시각·탄막 모티프 | 중간보스 | 메인 보스 |
| --- | --- | --- | --- | --- |
| 1 | Misty Approach / 기존 4,500틱 | 안개, 토리이, 기본 fan/ring | Sui | Kiri |
| 2 | Lantern Cedar Road / 4,500틱 | 삼나무, 등불, 점멸 간격·느린 조준 fan | Kaho | Iori |
| 3 | River That Climbs / 4,800틱 | 역류, 수면선, 좌우 교차·엇갈린 ring | Towa | Nami |
| 4 | Hollow Bell Summit / 5,100틱 | 산정 공방, 박자형 동심원·다중 fan | Gaku | En |
| 5 | Inverted Inner Court / 5,400틱 | 뒤집힌 신사, 대칭·반전·회전 spiral | Raku | Shizu |
| 6 | Chamber of Empty Vows / 4,200틱 | 봉인실, 앞선 패턴의 복합 변주 | Haku | Mikage |

### 6.1 일반 웨이브 계약

- Stage 2: 8~10개 웨이브. 양쪽에서 교대 진입하는 적과 중앙의 느린 조준탄으로 넓은 통로를
  먼저 가르친 뒤, 마지막 2개 웨이브에서 통로와 조준탄을 겹친다.
- Stage 3: 9~11개 웨이브. 좌→우/우→좌로 이동하는 적이 직선 교차탄을 만들고, 중앙 적은
  한 박자 늦은 ring으로 회피 방향을 바꾼다.
- Stage 4: 9~11개 웨이브. 고정 박자 ring과 그 사이를 겨냥하는 fan을 교대한다. 탄 생성
  직전 최소 20틱의 시각적 휴지기를 둔다.
- Stage 5: 10~12개 웨이브. 좌우 대칭 위치에서 같은 탄을 내보내되 완전한 벽이 되지 않도록
  난이도별 고정 gap을 둔다. 상위 난이도만 두 번째 역회전 spiral을 추가한다.
- Stage 6: 8~10개 웨이브. Stage 2~5 모티프를 한 웨이브씩 짧게 재사용하고 마지막 두
  웨이브에서만 두 모티프를 결합한다. 새 규칙을 소개하지 않는다.

필요한 공용 적 이동은 `diagonalDown`, `crossField`, `stopAndGo` 세 가지뿐이다. 기존
`driftDown`, `sineDown`, `hover`와 조합한다. 보스 이동은 `BossPhaseDef.movement?`에
`fixed | sideSweep | pendulum`만 허용하며 기본값은 `fixed`다.

## 7. 보스와 Spell 계약

모든 중간보스는 `intro → normal 1 → spell 1 → exit`다. 메인 보스의 전투 페이즈 수는
다음과 같다.

| Stage | 통상 | Spell | 임시 Spell 이름 |
| --- | ---: | ---: | --- |
| 1 Kiri | 2 | 2 | 기존 `Twin Coil Vigil`, `Lantern Sea Requiem` |
| 2 Iori | 2 | 2 | Vow Sign "Thousand Unsent Letters"; Lantern Sign "Path That Forgets Footsteps" |
| 3 Nami | 2 | 2 | Current Sign "River Climbing Its Own Source"; Name Sign "Ferry of the Nameless Moon" |
| 4 En | 2 | 3 | Bell Sign "Seven Echoes Without a Striker"; Forge Sign "Red Iron Constellation"; Key Sign "Resonance That Opens Stone" |
| 5 Shizu | 3 | 3 | Mirror Sign "Gate Facing Both Ways"; Reverse Sign "Pilgrimage From the Last Step"; Boundary Sign "Inner Court Without an Outside" |
| 6 Mikage | 3 | 4 | Seal Sign "Ledger of Abandoned Vows"; Memory Sign "Names Returning as Ash"; Empty Sign "Merciful Erasure"; Final Seal "A Shrine That Must Learn to Breathe" |

중간보스 Spell은 각각 다음 임시값을 사용한다.

- Kaho: Lamp Sign "Moth at the Last Lantern"
- Towa: Shore Sign "Bell Beneath the Upstream Tide"
- Gaku: Stone Sign "Echo Nested in Granite"
- Raku: Mirror Beast "Paired Footsteps"
- Haku: Blank Page "One Line Left Unwritten"

Stage 2~3 메인 보스는 M1과 같은 HP/시간 범위를 사용한다. Stage 4~5는 페이즈당 HP를
Normal 기준 10~20% 높이고, Stage 6은 페이즈 수가 많으므로 개별 HP는 Stage 5보다 높이지
않는다. Easy/Normal/Hard/Lunatic HP 배율은 기존 `[0.7, 1, 1.3, 1.6]`을 재사용한다.
일반 페이즈는 35~45초, Spell은 45~55초, intro/exit는 2초 안팎이다.

각 패턴은 Easy에서 명확한 고정 통로 하나 이상을 보장한다. Hard는 보조 fan 또는 두 번째
ring을, Lunatic은 역회전/위상차 중 하나를 더한다. 단순 속도 배율만 바꾸지 않는다.
탄 풀 8,192를 넘기는 패턴은 허용하지 않으며 가장 조밀한 Stage 6 Spell을 풀 스트레스
검사 대상으로 삼는다.

## 8. 임시 대사 원고

표기 `A`는 Aria, `R`은 Rin이다. 구현에서는 배열의 화자/본문
데이터로 저장한다. 아래 문장은 원작을 인용하지 않은 오리지널 임시 원고다.

### Stage 1 — Kiri

중간보스 Sui 등장: “안개가 숨긴 문은 안개가 고른 자만 지난다.”
패배: “문은 이미 안에서 열렸어… 나는 늦게 알아챘지.”

**Aria / 전투 전**

- A: “신사 안쪽에서 안개가 새고 있어. 문을 열어 줘.”
- Kiri: “문은 닫혀 있었어. 안개가 문을 지나지 않았을 뿐이지.”
- A: “그럼 봉인 안에서 시작됐다는 뜻이네.”
- Kiri: “그 답을 들고도 들어가겠다면, 먼저 네 부적이 진짜인지 보여 줘.”
- A: “시험이라면 짧게 끝낼게.”
- Kiri: “짧은 안개가 가장 길을 잃게 하지.”

**Rin / 전투 전**

- R: “문고리가 멀쩡한데 결계가 안쪽으로 찢어졌네.”
- Kiri: “손대지 마. 서툰 수선은 상처를 두 개로 늘려.”
- R: “서툰지는 뜯어 봐야 알지.”
- Kiri: “그 성급한 손보다 내 쌍등이 빠른지 보자.”
- R: “좋아. 이기면 작업대부터 빌린다.”
- Kiri: “이기고도 길을 찾는다면.”

**격파 후 — Aria**

- Kiri: “균열은 안쪽에서 시작됐어. 등불 숲의 맹세들이 먼저 빠져나갔지.”
- A: “문을 지켜 줘. 나는 흔적을 따라갈게.”
- Kiri: “꺼진 등불을 따라가. 아직 길을 기억하고 있을 거야.”

**격파 후 — Rin**

- Kiri: “균열은 안쪽에서 시작됐어. 등불 숲의 맹세들이 먼저 빠져나갔지.”
- R: “안쪽 파손이면 범인은 구조를 아는 자야. 숲에서 부품부터 찾지.”
- Kiri: “등불을 함부로 뜯지는 마. 기억까지 흩어질 테니.”

### Stage 2 — Iori

중간보스 Kaho 등장: “꺼진 등불은 길을 잊은 자의 것. 더 가져가게 둘 수 없어.”
패배: “조각들이 강 쪽으로 날아갔어… 불빛을 따라가.”

**Aria / 전투 전**

- A: “이 맹세들은 봉인으로 돌아가야 해.”
- Iori: “돌아가면 다시 쌓여. 아무도 찾지 않는 약속까지.”
- A: “그래도 남의 기억을 네 등불에 가둘 수는 없어.”
- Iori: “나는 버려진 것만 주웠어. 버린 이들이 이제 와 주인 행세를 하네.”
- A: “주인이 아니라 길을 묻는 거야. 누가 봉인을 열었지?”
- Iori: “강물이 위로 흐르게 만든 종. 그 울림을 이기면 알려 줄게.”

**Rin / 전투 전**

- R: “등불마다 같은 균열 가루가 묻었어. 어디서 주웠지?”
- Iori: “길이 이름을 잊는 곳에서.”
- R: “수수께끼 값으로는 비싸네. 하나 분해해 봐도 돼?”
- Iori: “맹세를 부품처럼 보는 손에는 하나도 못 줘.”
- R: “그럼 부수지 않고 빛만 꺼내 보일게.”
- Iori: “가능하다면 강의 뱃사공도 널 만나 줄 거야.”

**격파 후 — Aria**

- Iori: “조각은 영혼의 강을 거슬러 산으로 갔어. 종이 부르는 것처럼.”
- A: “버려진 맹세도 돌아갈 곳을 찾게 만들겠어.”
- Iori: “그 말을 강의 뱃사공에게도 들려줘.”

**격파 후 — Rin**

- Iori: “조각은 영혼의 강을 거슬러 산으로 갔어. 종이 부르는 것처럼.”
- R: “종이 송신기고 강이 선로군. 다음 고장은 위쪽이야.”
- Iori: “등불은 내가 지킬게. 강의 선로부터 바로잡아.”

### Stage 3 — Nami

중간보스 Towa 등장: “산 자의 이름은 이 물에 너무 무거워. 여기 두고 가.”
패배: “종소리가 물길을 잡아당겨… 배도 거꾸로 가고 있어.”

**Aria / 전투 전**

- A: “강을 원래 방향으로 돌려놔.”
- Nami: “나는 물길을 모는 자가 아니라 이름을 건네는 자야.”
- A: “그럼 누가 죽은 이름까지 산으로 부르고 있지?”
- Nami: “비어 있는 봉인이 새 이름을 찾는 중이지.”
- A: “그 봉인을 다시 채우게 두지 않겠어.”
- Nami: “빈 것을 두려워하는 네가 무엇으로 채울지 먼저 보여 줘.”

**Rin / 전투 전**

- R: “역류의 주기가 종소리와 정확히 맞아.”
- Nami: “계산이 맞아도 강을 건널 표는 아니야.”
- R: “표 대신 원인을 가져왔어. 깨진 봉인 조각.”
- Nami: “그 조각은 이름을 먹고 무거워지지.”
- R: “먹기 전에 회로를 끊으면 돼.”
- Nami: “강의 이름까지 끊지 않을 솜씨인지 보자.”

**격파 후 — Aria**

- Nami: “산정의 빈 종이 이름을 울림으로 바꾸고 있어. 만든 이는 En.”
- A: “이름을 돌려보내고 종을 멈출게.”
- Nami: “물길은 잠시 붙들어 둘게. 종이 멎기 전까지만.”

**격파 후 — Rin**

- Nami: “산정의 빈 종이 이름을 울림으로 바꾸고 있어. 만든 이는 En.”
- R: “제작자를 찾으면 설계 의뢰인도 나오겠지.”
- Nami: “이름이 다 닳기 전에 서둘러.”

### Stage 4 — En

중간보스 Gaku 등장: “공방의 돌도 울림을 지킨다. 가벼운 발로 넘지 마라.”
패배: “빈 종은 두드리지 않아도 운다… 안쪽에서.”

**Aria / 전투 전**

- A: “네 종이 봉인을 찢고 강을 뒤집었어.”
- En: “종은 받은 모양대로 울릴 뿐이야.”
- A: “누가 그런 모양을 주문했지?”
- En: “봉인이 스스로 깨지기 전에 숨구멍을 만들 자.”
- A: “사람과 영혼을 휩쓰는 숨구멍은 구멍일 뿐이야.”
- En: “그 말을 쇳소리보다 오래 남길 수 있는지 들어 보자.”

**Rin / 전투 전**

- R: “공명비가 훌륭해. 용도만 최악이고.”
- En: “물건을 칭찬하면서 만든 이를 모욕하는 재주가 있군.”
- R: “좋은 도구가 나쁜 설계를 정확히 실행했으니까.”
- En: “설계자는 파열까지 사흘이라고 했어.”
- R: “그래서 전부 지우는 열쇠를 만들었다?”
- En: “더 나은 열쇠가 있다면 네 탄으로 증명해.”

**격파 후 — Aria**

- En: “의뢰인은 내전의 관리인 Mikage. Shizu가 역문을 지키고 있어.”
- A: “사흘보다 빠르게, 지우지 않는 답을 찾겠어.”
- En: “내 종은 멈추겠다. 네 답이 울릴 자리를 남겨 두지.”

**격파 후 — Rin**

- En: “의뢰인은 내전의 관리인 Mikage. Shizu가 역문을 지키고 있어.”
- R: “열쇠의 홈은 기억했어. 이제 반대로 돌리면 돼.”
- En: “역문은 힘으로 열리지 않아. 틀린 쪽으로 정확히 돌려.”

### Stage 5 — Shizu

중간보스 Raku 등장: “앞발과 뒷발, 들어온 길과 나갈 길. 어느 쪽이 진짜냐?”
패배: “둘 다였군. 역문이 너희를 기억했다.”

**Aria / 전투 전**

- A: “Mikage를 만나게 해 줘.”
- Shizu: “만나면 너는 봉인을 다시 닫으려 하겠지.”
- A: “폭주하지 않도록 고칠 거야.”
- Shizu: “수백 년 동안 모두가 그렇게 말하고 맹세를 안에 버렸어.”
- A: “그 잘못 때문에 지금 있는 영혼까지 지울 수는 없어.”
- Shizu: “관리인은 가장 적은 희생을 골랐다.”
- A: “선택받지 못한 희생의 목소리도 듣게 하겠어.”

**Rin / 전투 전**

- R: “역문은 훌륭하지만 출구를 하나만 남겼네.”
- Shizu: “그 하나가 모두를 살릴 길이니까.”
- R: “모두를 빈 종이로 만드는 건 수리가 아니야.”
- Shizu: “축적하지 않는 봉인은 존재한 적이 없어.”
- R: “없었다는 말은 아직 안 만들었다는 뜻이지.”
- Shizu: “그 오만이 관리인의 계산보다 단단한지 시험하겠다.”

**격파 후 — Aria**

- Shizu: “Mikage는 봉인실에서 마지막 이름을 지우고 있어.”
- A: “문을 열어. 이번에는 안에서부터 바로잡을게.”
- Shizu: “그 약속까지 봉인에 버리지 않기를.”

**격파 후 — Rin**

- Shizu: “Mikage는 봉인실에서 마지막 이름을 지우고 있어.”
- R: “실패한 설계와 성공한 계산 중 무엇이 더 위험한지 보여 주지.”
- Shizu: “역문을 뒤집었다. 이제 돌아오는 길은 네가 만들어.”

### Stage 6 — Mikage

중간보스 Haku 등장: “나는 아직 쓰이지 않은 마지막 줄. 이 아래로는 결말뿐이다.”
패배: “빈 줄을 남겨 둘게. 너희가 무엇을 쓰는지 보겠다.”

**Aria / 전투 전**

- A: “이름을 지우는 의식을 멈춰.”
- Mikage: “멈추면 봉인은 스스로 터지고 더 많은 이름이 사라져.”
- A: “쌓아 두는 방식이 틀렸다면 흐르게 만들면 돼.”
- Mikage: “흐른 맹세가 누구에게 닿을지 너는 책임질 수 있나?”
- A: “가둔 채 썩게 하는 것보다는 책임질 수 있어.”
- Mikage: “나는 가능성이 아니라 남은 시간을 계산했다.”
- A: “그 계산에서 빠진 목소리를 데려왔어.”
- Mikage: “그렇다면 내 소거보다 강한 순환을 증명해.”

**Rin / 전투 전**

- R: “봉인은 저장고가 아니야. 넘치면 돌려보내야지.”
- Mikage: “돌아갈 주인이 없는 기억은 어디로 보내지?”
- R: “길을 열어 두면 스스로 새 자리를 찾아.”
- Mikage: “제어하지 않은 흐름을 믿으라는 건가?”
- R: “모든 걸 지우는 제어보다 낫지.”
- Mikage: “나는 실패했을 때 사라질 수를 알고 있다.”
- R: “나는 성공할 때 남을 것을 만들러 왔어.”
- Mikage: “그 결계가 내 마지막 봉인을 견디는지 보자.”

**격파 후 — Aria**

- Mikage: “봉인이 다시 숨 쉬고 있어… 안과 밖을 오가면서.”
- Aria: “맹세는 가두는 게 아니라 돌보는 거야.”
- Mikage: “그 책임을 네가 이어 간다면, 나는 문을 맡기겠다.”
- Aria: “문이 아니라 길로 남겨 둘게.”

**격파 후 — Rin**

- Mikage: “벽이 없는데도 조각이 흩어지지 않는군.”
- Rin: “돌아갈 방향만 있으면 벽은 필요 없어.”
- Mikage: “내 계산에는 없던 구조야.”
- Rin: “그러니까 다음에는 지우기 전에 같이 설계해.”

## 9. 콘텐츠와 코드 경계

기존 공개 import를 가능한 한 유지한다. 콘텐츠가 `data.ts` 한 파일에서 읽기 어려워질 때만
다음처럼 나누고 `data.ts`에서 재-export한다.

```text
src/content/
  data.ts        # 공용 타입, player, 호환 re-export
  stages.ts      # STAGE_ORDER, Stage 1~6
  bosses.ts      # boss registry와 phase 데이터
  dialogue.ts    # 대사와 엔딩 데이터
  patterns.ts    # 작은 발사 함수와 registry
src/core/
  run.ts         # RunCarry, carry 변환, stage seed 파생
```

- `StageDef`에는 임시 배경을 고르는 `visualTheme`만 추가한다.
- Renderer는 `visualTheme` registry에서 절차적 배경 drawing 함수를 고르고 Stage 전환 때
  한 번 다시 그린다. 프레임마다 배경을 재생성하지 않는다.
- `BossPhaseDef`에는 선택적 `movement`만 추가한다.
- 알 수 없는 Stage/Boss/Pattern/Theme/Dialogue ID는 시작 시 명시적 오류로 거절한다.
- 전투 결정 코드에서 DOM, PixiJS, `Math.random`, 실시간 clock을 사용하지 않는다.
- 패턴 registry로 충분하므로 범용 이벤트 DSL, 스크립트 언어, factory 계층은 만들지 않는다.

## 10. 검증 계약

### 10.1 자동 검사

1. `STAGE_ORDER`의 모든 ID가 Stage, 중간보스, 메인보스, 배경, 대사 registry에서 조회된다.
2. Stage 1→6 전환 순서와 `RunCarry`의 점수/Graze/잔기/봄/Power/Extend 승계를 검사한다.
3. Stage 전환 때 위치, 피탄 대기, 무적, 입력 edge, 엔티티 풀이 초기화된다.
4. Stage N 클리어 전에는 잠겨 있고 클리어 후 저장·재로드해도 Practice가 해금된다.
5. 손상된 `ssd.progress.v2`는 기본값으로 복구되고 저장소 사용 불가 시 메모리 fallback이 동작한다.
6. Aria/Rin 대사 조회와 서로 다른 엔딩 ID를 검사한다. 대사 중 core tick이 증가하지 않는다.
7. 동일 seed+입력의 전체 Story 최종 digest가 일치한다.
8. Stage 1~6 각각의 `stage | midboss | boss` Practice Replay가 round-trip한다.
9. Story Replay의 stageId/startAt 제약, 알 수 없는 Stage, 다른 contentVersion, 크기와 입력 비트를 거절한다.
10. 모든 난이도에서 각 패턴이 유효한 탄을 만들며 count/interval/구조 중 둘 이상이 달라진다.
11. 가장 조밀한 Stage 6 Spell도 적탄 풀 8,192를 넘지 않고 활성 탄 전부가 렌더된다.
12. 기존 Deathbomb 경계, Graze 중복, 봄/Spell 자격, Extend, EOF 결과, hiscore 격리 테스트를 유지한다.

### 10.2 브라우저 QA

- 640×480, 우측 HUD, WebGL 표시와 페이지 오류 0건을 확인한다.
- Normal에서 타이틀부터 두 캐릭터 엔딩 중 하나까지 전체 Story를 한 번 진행한다.
- 다른 캐릭터는 Stage 6 격파 대사와 별도 엔딩을 확인한다.
- Stage 6을 Easy/Normal/Hard/Lunatic으로 시작해 난이도별 구조 차이와 화면 안 배치를 확인한다.
- 클리어 전/후 Practice 잠금, Stage/Midboss/Boss 시작, pause/resume/restart/title을 확인한다.
- 전체 Story Replay import→재생→Stage 6 EOF 결과와 페이지 오류 0건을 확인한다.
- Stage Card, 긴 보스명/Spell명, 대사, 엔딩과 결과 텍스트의 겹침·잘림을 스크린샷으로 확인한다.

### 10.3 완료 명령과 문서

- `npm test`, `npm run typecheck`, `npm run build`가 모두 통과해야 한다.
- README에는 Story/Practice 흐름, M2 범위, 조작, Replay 호환성과 남은 M3 범위를 기록한다.
- `docs/implementation-report-m2.md`에는 실제 콘텐츠 수치, 변경 파일, 테스트 수, 브라우저 QA,
  알려진 한계를 기록한다.
- 커밋, push, 공개 배포는 별도 요청 없이 하지 않는다.

## 11. M2 완료 기준

1. Stage 1→6이 연속 진행되고 승인된 carry 상태가 정확히 이어진다.
2. Stage 2~6 각각 일반 웨이브, 중간보스, 메인보스, 고유 패턴과 절차적 배경을 갖는다.
3. 두 캐릭터의 보스 대사와 서로 다른 엔딩이 실제 화면에 표시된다.
4. 해금 전 Stage는 Practice에서 선택할 수 없고 클리어 후 재실행에도 유지된다.
5. 대사/Stage 전환/pause 이후 입력 고착, 틱 증가 또는 catch-up 폭주가 없다.
6. 전체 Story와 모든 Stage Practice Replay가 결정적으로 재생된다.
7. 4난이도가 탄 수·속도·간격·조준·구조 차이를 유지한다.
8. M1 핵심 전투와 저장/Replay 오류 처리가 회귀하지 않는다.
9. 자동 검사, typecheck, build와 §10.2 브라우저 QA를 통과한다.
10. 구현 보고서가 실제 범위만 설명하며 Extra나 최종 아트/BGM 완성으로 표현하지 않는다.

## 12. M3로 남기는 범위

- Extra Stage와 해금 조건
- Continue 규칙
- 최종 캐릭터·배경 일러스트와 애니메이션
- 완성 BGM과 사운드 믹싱
- 업적, 스코어보드 세분화와 중간 run 저장
- 최종 밸런스와 브라우저/기기별 성능 목표
- 임시 제목·인물명·대사·Spell명의 최종 설정 확정
