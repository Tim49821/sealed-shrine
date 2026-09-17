// M2 dialogue + endings (design v0.2 §8). Typed data only: combat code and
// GameCore never read these sentences. All lines are original temporary draft
// text, not final setting.
import type { StageId } from '../core/run.js';

export type PlayerId = 'aria' | 'rin';
export type DialogueMoment = 'midbossBefore' | 'midbossAfter' | 'bossBefore' | 'bossAfter';

export interface DialogueLine {
  speaker: string;
  text: string;
}

type Key = `${StageId}:${PlayerId}:${DialogueMoment}`;

const D: Record<Key, DialogueLine[]> = {
  // ---------- Stage 1: Kiri ----------
  'stage1:aria:midbossBefore': [{ speaker: 'Sui', text: '안개가 숨긴 문은 안개가 고른 자만 지난다.' }],
  'stage1:rin:midbossBefore': [{ speaker: 'Sui', text: '안개가 숨긴 문은 안개가 고른 자만 지난다.' }],
  'stage1:aria:midbossAfter': [{ speaker: 'Sui', text: '문은 이미 안에서 열렸어… 나는 늦게 알아챘지.' }],
  'stage1:rin:midbossAfter': [{ speaker: 'Sui', text: '문은 이미 안에서 열렸어… 나는 늦게 알아챘지.' }],
  'stage1:aria:bossBefore': [
    { speaker: 'Aria', text: '신사 안쪽에서 안개가 새고 있어. 문을 열어 줘.' },
    { speaker: 'Kiri', text: '문은 닫혀 있었어. 안개가 문을 지나지 않았을 뿐이지.' },
    { speaker: 'Aria', text: '그럼 봉인 안에서 시작됐다는 뜻이네.' },
    { speaker: 'Kiri', text: '그 답을 들고도 들어가겠다면, 먼저 네 부적이 진짜인지 보여 줘.' },
    { speaker: 'Aria', text: '시험이라면 짧게 끝낼게.' },
    { speaker: 'Kiri', text: '짧은 안개가 가장 길을 잃게 하지.' },
  ],
  'stage1:rin:bossBefore': [
    { speaker: 'Rin', text: '문고리가 멀쩡한데 결계가 안쪽으로 찢어졌네.' },
    { speaker: 'Kiri', text: '손대지 마. 서툰 수선은 상처를 두 개로 늘려.' },
    { speaker: 'Rin', text: '서툰지는 뜯어 봐야 알지.' },
    { speaker: 'Kiri', text: '그 성급한 손보다 내 쌍등이 빠른지 보자.' },
    { speaker: 'Rin', text: '좋아. 이기면 작업대부터 빌린다.' },
    { speaker: 'Kiri', text: '이기고도 길을 찾는다면.' },
  ],
  'stage1:aria:bossAfter': [
    { speaker: 'Kiri', text: '균열은 안쪽에서 시작됐어. 등불 숲의 맹세들이 먼저 빠져나갔지.' },
    { speaker: 'Aria', text: '문을 지켜 줘. 나는 흔적을 따라갈게.' },
    { speaker: 'Kiri', text: '꺼진 등불을 따라가. 아직 길을 기억하고 있을 거야.' },
  ],
  'stage1:rin:bossAfter': [
    { speaker: 'Kiri', text: '균열은 안쪽에서 시작됐어. 등불 숲의 맹세들이 먼저 빠져나갔지.' },
    { speaker: 'Rin', text: '안쪽 파손이면 범인은 구조를 아는 자야. 숲에서 부품부터 찾지.' },
    { speaker: 'Kiri', text: '등불을 함부로 뜯지는 마. 기억까지 흩어질 테니.' },
  ],

  // ---------- Stage 2: Iori ----------
  'stage2:aria:midbossBefore': [{ speaker: 'Kaho', text: '꺼진 등불은 길을 잊은 자의 것. 더 가져가게 둘 수 없어.' }],
  'stage2:rin:midbossBefore': [{ speaker: 'Kaho', text: '꺼진 등불은 길을 잊은 자의 것. 더 가져가게 둘 수 없어.' }],
  'stage2:aria:midbossAfter': [{ speaker: 'Kaho', text: '조각들이 강 쪽으로 날아갔어… 불빛을 따라가.' }],
  'stage2:rin:midbossAfter': [{ speaker: 'Kaho', text: '조각들이 강 쪽으로 날아갔어… 불빛을 따라가.' }],
  'stage2:aria:bossBefore': [
    { speaker: 'Aria', text: '이 맹세들은 봉인으로 돌아가야 해.' },
    { speaker: 'Iori', text: '돌아가면 다시 쌓여. 아무도 찾지 않는 약속까지.' },
    { speaker: 'Aria', text: '그래도 남의 기억을 네 등불에 가둘 수는 없어.' },
    { speaker: 'Iori', text: '나는 버려진 것만 주웠어. 버린 이들이 이제 와 주인 행세를 하네.' },
    { speaker: 'Aria', text: '주인이 아니라 길을 묻는 거야. 누가 봉인을 열었지?' },
    { speaker: 'Iori', text: '강물이 위로 흐르게 만든 종. 그 울림을 이기면 알려 줄게.' },
  ],
  'stage2:rin:bossBefore': [
    { speaker: 'Rin', text: '등불마다 같은 균열 가루가 묻었어. 어디서 주웠지?' },
    { speaker: 'Iori', text: '길이 이름을 잊는 곳에서.' },
    { speaker: 'Rin', text: '수수께끼 값으로는 비싸네. 하나 분해해 봐도 돼?' },
    { speaker: 'Iori', text: '맹세를 부품처럼 보는 손에는 하나도 못 줘.' },
    { speaker: 'Rin', text: '그럼 부수지 않고 빛만 꺼내 보일게.' },
    { speaker: 'Iori', text: '가능하다면 강의 뱃사공도 널 만나 줄 거야.' },
  ],
  'stage2:aria:bossAfter': [
    { speaker: 'Iori', text: '조각은 영혼의 강을 거슬러 산으로 갔어. 종이 부르는 것처럼.' },
    { speaker: 'Aria', text: '버려진 맹세도 돌아갈 곳을 찾게 만들겠어.' },
    { speaker: 'Iori', text: '그 말을 강의 뱃사공에게도 들려줘.' },
  ],
  'stage2:rin:bossAfter': [
    { speaker: 'Iori', text: '조각은 영혼의 강을 거슬러 산으로 갔어. 종이 부르는 것처럼.' },
    { speaker: 'Rin', text: '종이 송신기고 강이 선로군. 다음 고장은 위쪽이야.' },
    { speaker: 'Iori', text: '등불은 내가 지킬게. 강의 선로부터 바로잡아.' },
  ],

  // ---------- Stage 3: Nami ----------
  'stage3:aria:midbossBefore': [{ speaker: 'Towa', text: '산 자의 이름은 이 물에 너무 무거워. 여기 두고 가.' }],
  'stage3:rin:midbossBefore': [{ speaker: 'Towa', text: '산 자의 이름은 이 물에 너무 무거워. 여기 두고 가.' }],
  'stage3:aria:midbossAfter': [{ speaker: 'Towa', text: '종소리가 물길을 잡아당겨… 배도 거꾸로 가고 있어.' }],
  'stage3:rin:midbossAfter': [{ speaker: 'Towa', text: '종소리가 물길을 잡아당겨… 배도 거꾸로 가고 있어.' }],
  'stage3:aria:bossBefore': [
    { speaker: 'Aria', text: '강을 원래 방향으로 돌려놔.' },
    { speaker: 'Nami', text: '나는 물길을 모는 자가 아니라 이름을 건네는 자야.' },
    { speaker: 'Aria', text: '그럼 누가 죽은 이름까지 산으로 부르고 있지?' },
    { speaker: 'Nami', text: '비어 있는 봉인이 새 이름을 찾는 중이지.' },
    { speaker: 'Aria', text: '그 봉인을 다시 채우게 두지 않겠어.' },
    { speaker: 'Nami', text: '빈 것을 두려워하는 네가 무엇으로 채울지 먼저 보여 줘.' },
  ],
  'stage3:rin:bossBefore': [
    { speaker: 'Rin', text: '역류의 주기가 종소리와 정확히 맞아.' },
    { speaker: 'Nami', text: '계산이 맞아도 강을 건널 표는 아니야.' },
    { speaker: 'Rin', text: '표 대신 원인을 가져왔어. 깨진 봉인 조각.' },
    { speaker: 'Nami', text: '그 조각은 이름을 먹고 무거워지지.' },
    { speaker: 'Rin', text: '먹기 전에 회로를 끊으면 돼.' },
    { speaker: 'Nami', text: '강의 이름까지 끊지 않을 솜씨인지 보자.' },
  ],
  'stage3:aria:bossAfter': [
    { speaker: 'Nami', text: '산정의 빈 종이 이름을 울림으로 바꾸고 있어. 만든 이는 En.' },
    { speaker: 'Aria', text: '이름을 돌려보내고 종을 멈출게.' },
    { speaker: 'Nami', text: '물길은 잠시 붙들어 둘게. 종이 멎기 전까지만.' },
  ],
  'stage3:rin:bossAfter': [
    { speaker: 'Nami', text: '산정의 빈 종이 이름을 울림으로 바꾸고 있어. 만든 이는 En.' },
    { speaker: 'Rin', text: '제작자를 찾으면 설계 의뢰인도 나오겠지.' },
    { speaker: 'Nami', text: '이름이 다 닳기 전에 서둘러.' },
  ],

  // ---------- Stage 4: En ----------
  'stage4:aria:midbossBefore': [{ speaker: 'Gaku', text: '공방의 돌도 울림을 지킨다. 가벼운 발로 넘지 마라.' }],
  'stage4:rin:midbossBefore': [{ speaker: 'Gaku', text: '공방의 돌도 울림을 지킨다. 가벼운 발로 넘지 마라.' }],
  'stage4:aria:midbossAfter': [{ speaker: 'Gaku', text: '빈 종은 두드리지 않아도 운다… 안쪽에서.' }],
  'stage4:rin:midbossAfter': [{ speaker: 'Gaku', text: '빈 종은 두드리지 않아도 운다… 안쪽에서.' }],
  'stage4:aria:bossBefore': [
    { speaker: 'Aria', text: '네 종이 봉인을 찢고 강을 뒤집었어.' },
    { speaker: 'En', text: '종은 받은 모양대로 울릴 뿐이야.' },
    { speaker: 'Aria', text: '누가 그런 모양을 주문했지?' },
    { speaker: 'En', text: '봉인이 스스로 깨지기 전에 숨구멍을 만들 자.' },
    { speaker: 'Aria', text: '사람과 영혼을 휩쓰는 숨구멍은 구멍일 뿐이야.' },
    { speaker: 'En', text: '그 말을 쇳소리보다 오래 남길 수 있는지 들어 보자.' },
  ],
  'stage4:rin:bossBefore': [
    { speaker: 'Rin', text: '공명비가 훌륭해. 용도만 최악이고.' },
    { speaker: 'En', text: '물건을 칭찬하면서 만든 이를 모욕하는 재주가 있군.' },
    { speaker: 'Rin', text: '좋은 도구가 나쁜 설계를 정확히 실행했으니까.' },
    { speaker: 'En', text: '설계자는 파열까지 사흘이라고 했어.' },
    { speaker: 'Rin', text: '그래서 전부 지우는 열쇠를 만들었다?' },
    { speaker: 'En', text: '더 나은 열쇠가 있다면 네 탄으로 증명해.' },
  ],
  'stage4:aria:bossAfter': [
    { speaker: 'En', text: '의뢰인은 내전의 관리인 Mikage. Shizu가 역문을 지키고 있어.' },
    { speaker: 'Aria', text: '사흘보다 빠르게, 지우지 않는 답을 찾겠어.' },
    { speaker: 'En', text: '내 종은 멈추겠다. 네 답이 울릴 자리를 남겨 두지.' },
  ],
  'stage4:rin:bossAfter': [
    { speaker: 'En', text: '의뢰인은 내전의 관리인 Mikage. Shizu가 역문을 지키고 있어.' },
    { speaker: 'Rin', text: '열쇠의 홈은 기억했어. 이제 반대로 돌리면 돼.' },
    { speaker: 'En', text: '역문은 힘으로 열리지 않아. 틀린 쪽으로 정확히 돌려.' },
  ],

  // ---------- Stage 5: Shizu ----------
  'stage5:aria:midbossBefore': [{ speaker: 'Raku', text: '앞발과 뒷발, 들어온 길과 나갈 길. 어느 쪽이 진짜냐?' }],
  'stage5:rin:midbossBefore': [{ speaker: 'Raku', text: '앞발과 뒷발, 들어온 길과 나갈 길. 어느 쪽이 진짜냐?' }],
  'stage5:aria:midbossAfter': [{ speaker: 'Raku', text: '둘 다였군. 역문이 너희를 기억했다.' }],
  'stage5:rin:midbossAfter': [{ speaker: 'Raku', text: '둘 다였군. 역문이 너희를 기억했다.' }],
  'stage5:aria:bossBefore': [
    { speaker: 'Aria', text: 'Mikage를 만나게 해 줘.' },
    { speaker: 'Shizu', text: '만나면 너는 봉인을 다시 닫으려 하겠지.' },
    { speaker: 'Aria', text: '폭주하지 않도록 고칠 거야.' },
    { speaker: 'Shizu', text: '수백 년 동안 모두가 그렇게 말하고 맹세를 안에 버렸어.' },
    { speaker: 'Aria', text: '그 잘못 때문에 지금 있는 영혼까지 지울 수는 없어.' },
    { speaker: 'Shizu', text: '관리인은 가장 적은 희생을 골랐다.' },
    { speaker: 'Aria', text: '선택받지 못한 희생의 목소리도 듣게 하겠어.' },
  ],
  'stage5:rin:bossBefore': [
    { speaker: 'Rin', text: '역문은 훌륭하지만 출구를 하나만 남겼네.' },
    { speaker: 'Shizu', text: '그 하나가 모두를 살릴 길이니까.' },
    { speaker: 'Rin', text: '모두를 빈 종이로 만드는 건 수리가 아니야.' },
    { speaker: 'Shizu', text: '축적하지 않는 봉인은 존재한 적이 없어.' },
    { speaker: 'Rin', text: '없었다는 말은 아직 안 만들었다는 뜻이지.' },
    { speaker: 'Shizu', text: '그 오만이 관리인의 계산보다 단단한지 시험하겠다.' },
  ],
  'stage5:aria:bossAfter': [
    { speaker: 'Shizu', text: 'Mikage는 봉인실에서 마지막 이름을 지우고 있어.' },
    { speaker: 'Aria', text: '문을 열어. 이번에는 안에서부터 바로잡을게.' },
    { speaker: 'Shizu', text: '그 약속까지 봉인에 버리지 않기를.' },
  ],
  'stage5:rin:bossAfter': [
    { speaker: 'Shizu', text: 'Mikage는 봉인실에서 마지막 이름을 지우고 있어.' },
    { speaker: 'Rin', text: '실패한 설계와 성공한 계산 중 무엇이 더 위험한지 보여 주지.' },
    { speaker: 'Shizu', text: '역문을 뒤집었다. 이제 돌아오는 길은 네가 만들어.' },
  ],

  // ---------- Stage 6: Mikage ----------
  'stage6:aria:midbossBefore': [{ speaker: 'Haku', text: '나는 아직 쓰이지 않은 마지막 줄. 이 아래로는 결말뿐이다.' }],
  'stage6:rin:midbossBefore': [{ speaker: 'Haku', text: '나는 아직 쓰이지 않은 마지막 줄. 이 아래로는 결말뿐이다.' }],
  'stage6:aria:midbossAfter': [{ speaker: 'Haku', text: '빈 줄을 남겨 둘게. 너희가 무엇을 쓰는지 보겠다.' }],
  'stage6:rin:midbossAfter': [{ speaker: 'Haku', text: '빈 줄을 남겨 둘게. 너희가 무엇을 쓰는지 보겠다.' }],
  'stage6:aria:bossBefore': [
    { speaker: 'Aria', text: '이름을 지우는 의식을 멈춰.' },
    { speaker: 'Mikage', text: '멈추면 봉인은 스스로 터지고 더 많은 이름이 사라져.' },
    { speaker: 'Aria', text: '쌓아 두는 방식이 틀렸다면 흐르게 만들면 돼.' },
    { speaker: 'Mikage', text: '흐른 맹세가 누구에게 닿을지 너는 책임질 수 있나?' },
    { speaker: 'Aria', text: '가둔 채 썩게 하는 것보다는 책임질 수 있어.' },
    { speaker: 'Mikage', text: '나는 가능성이 아니라 남은 시간을 계산했다.' },
    { speaker: 'Aria', text: '그 계산에서 빠진 목소리를 데려왔어.' },
    { speaker: 'Mikage', text: '그렇다면 내 소거보다 강한 순환을 증명해.' },
  ],
  'stage6:rin:bossBefore': [
    { speaker: 'Rin', text: '봉인은 저장고가 아니야. 넘치면 돌려보내야지.' },
    { speaker: 'Mikage', text: '돌아갈 주인이 없는 기억은 어디로 보내지?' },
    { speaker: 'Rin', text: '길을 열어 두면 스스로 새 자리를 찾아.' },
    { speaker: 'Mikage', text: '제어하지 않은 흐름을 믿으라는 건가?' },
    { speaker: 'Rin', text: '모든 걸 지우는 제어보다 낫지.' },
    { speaker: 'Mikage', text: '나는 실패했을 때 사라질 수를 알고 있다.' },
    { speaker: 'Rin', text: '나는 성공할 때 남을 것을 만들러 왔어.' },
    { speaker: 'Mikage', text: '그 결계가 내 마지막 봉인을 견디는지 보자.' },
  ],
  'stage6:aria:bossAfter': [
    { speaker: 'Mikage', text: '봉인이 다시 숨 쉬고 있어… 안과 밖을 오가면서.' },
    { speaker: 'Aria', text: '맹세는 가두는 게 아니라 돌보는 거야.' },
    { speaker: 'Mikage', text: '그 책임을 네가 이어 간다면, 나는 문을 맡기겠다.' },
    { speaker: 'Aria', text: '문이 아니라 길로 남겨 둘게.' },
  ],
  'stage6:rin:bossAfter': [
    { speaker: 'Mikage', text: '벽이 없는데도 조각이 흩어지지 않는군.' },
    { speaker: 'Rin', text: '돌아갈 방향만 있으면 벽은 필요 없어.' },
    { speaker: 'Mikage', text: '내 계산에는 없던 구조야.' },
    { speaker: 'Rin', text: '그러니까 다음에는 지우기 전에 같이 설계해.' },
  ],
};

const ENDINGS: Record<PlayerId, DialogueLine[]> = {
  aria: [
    { speaker: '', text: 'Aria는 봉인의 문을 완전히 닫지 않았다.' },
    { speaker: '', text: '일곱 밤마다 문은 잠시 열려, 오래된 맹세를 바람 속으로 돌려보냈다.' },
    { speaker: 'Aria', text: '가두는 대신 돌보면 돼. 다음 숨도 놓치지 않을게.' },
    { speaker: '', text: '마지막 조각 하나가 별빛을 따라 숲 너머로 사라졌다.' },
  ],
  rin: [
    { speaker: '', text: 'Rin은 벽 대신 수많은 작은 길을 엮었다.' },
    { speaker: '', text: '주인을 기억한 조각은 돌아가고, 남은 기억은 새 이름을 찾아 흘렀다.' },
    { speaker: 'Rin', text: '보관함이 아니라 길표였어. 이제 막히지만 않으면 돼.' },
    { speaker: '', text: '설계도에 없던 조각 하나가 밤하늘의 빈칸으로 날아갔다.' },
  ],
};

export function getDialogue(stageId: StageId, playerId: PlayerId, moment: DialogueMoment): readonly DialogueLine[] {
  const lines = D[`${stageId}:${playerId}:${moment}`];
  if (!lines) throw new Error(`unknown dialogue ${stageId} ${playerId} ${moment}`);
  return lines;
}

export function getEnding(playerId: PlayerId): readonly DialogueLine[] {
  const lines = ENDINGS[playerId];
  if (!lines) throw new Error(`unknown ending ${playerId}`);
  return lines;
}
