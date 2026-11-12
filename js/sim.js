// 얼음 다리 난투 — 게임 로직 (DOM 없음, 브라우저/Node 공용)
import { aramMap, riftMap, laneProj, lanePt } from './maps.js';
export { laneProj, lanePt };
// 칼바람 맵 기준 상수 (예전 코드 호환용). 실제 맵 정보는 G.map
export const MAP_W = 6000, LANE_Y1 = 250, LANE_Y2 = 1150, MID_Y = 700;
export const FOUNTAIN = [{ x: 170, y: MID_Y }, { x: MAP_W - 170, y: MID_Y }];
export const TEAMC = ['#4aa3ff', '#ff5a5a', '#d6a85c']; // 2 = 중립(정글 몬스터)
export const TEAMN = ['블루 팀', '레드 팀', '중립'];
export const POS = { top: '탑', jungle: '정글', mid: '미드', bot: '원딜', sup: '서포터' };
// 포지션별 AI 영웅 후보 (앞쪽이 우선)
const POS_POOL = { top: ['graff', 'valkan', 'rokan', 'braks'], jungle: ['niya', 'rokan', 'valkan', 'braks'], mid: ['solin', 'niya', 'kaira'], bot: ['kaira', 'solin'], sup: ['tera', 'graff', 'solin'] };
export const DIFF = [
  { name: '쉬움', react: .5, acc: .2, err: 150, dmg: .8, dodge: 0, agg: .8 },
  { name: '보통', react: .3, acc: .7, err: 70, dmg: 1, dodge: .35, agg: 1 },
  { name: '어려움', react: .16, acc: 1, err: 25, dmg: 1.12, dodge: .8, agg: 1.25 }];
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function norm(dx, dy) { const d = Math.hypot(dx, dy); if (d < .001) return [1, 0]; return [dx / d, dy / d]; }
function aimDir(u, tx, ty) { if (Math.abs(tx - u.x) < .001 && Math.abs(ty - u.y) < .001) return [Math.cos(u.face || 0), Math.sin(u.face || 0)]; return norm(tx - u.x, ty - u.y); }
export function clampPt(u, tx, ty, r) { const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy); return d <= r ? [tx, ty] : [u.x + dx / d * r, u.y + dy / d * r]; }
function clampMap(x, y, r) { return G.map.clampPt(x, y, r); }
// 집(분수대) 쪽 방향 단위벡터
function homeDir(u) { const f = G.map.fountain[u.team]; return norm(f.x - u.x, f.y - u.y); }
// 스킬 수치: 스킬을 쓸 때는 그 스킬의 랭크로 환산한 레벨, 그 밖(패시브 등)에는 영웅 레벨 기준
const S = (u, b, l) => b + l * ((u.curRankL ?? u.level) - 1);

/* ================= 영웅 ================= */
export const ROLE = { tank: '탱커', mage: '마법사', adc: '원거리 딜러', fighter: '전사', assassin: '암살자', support: '서포터' };
const BASES = {
  tank: { hp: 770, hpL: 120, ad: 84, adL: 6.2, df: 33, dfL: 3, as: .68, asL: .022, ms: 340, range: 160 },
  mage: { hp: 555, hpL: 94, ad: 72, adL: 5.2, df: 16, dfL: 2.6, as: .66, asL: .02, ms: 330, range: 550 },
  adc: { hp: 570, hpL: 96, ad: 83, adL: 5.8, df: 18, dfL: 2.6, as: .72, asL: .04, ms: 330, range: 550 },
  fighter: { hp: 660, hpL: 108, ad: 88, adL: 6.6, df: 25, dfL: 3, as: .7, asL: .03, ms: 345, range: 185 },
  assassin: { hp: 640, hpL: 100, ad: 94, adL: 6.3, df: 25, dfL: 2.9, as: .72, asL: .036, ms: 350, range: 160 },
  support: { hp: 585, hpL: 98, ad: 70, adL: 5, df: 26, dfL: 2.6, as: .65, asL: .02, ms: 335, range: 525 }
};
function HD(o) { return Object.assign({}, BASES[o.role], o); }
export const HEROES = [
  HD({ id: 'graff', name: '그라프', role: 'tank', color: '#a8b4c4', desc: '사슬로 적을 끌어와 묶는 탱커', ab: [
    { n: '사슬 갈고리', cd: 15, desc: '사슬을 던져 처음 맞은 적에게 피해를 주고 내 앞으로 끌어와 기절시킵니다.', ai: { t: 'shot', range: 1050, speed: 1800, w: 68 },
      cast(u, tx, ty) { const [dx, dy] = aimDir(u, tx, ty); proj({ owner: u, x: u.x, y: u.y, dx, dy, speed: 1800, range: 1050, r: 34, color: '#dbe3ee', kind: 'chain', onHit(t) { dmg(u, t, S(u, 70, 23) + u.ap * .9 + u.ad * .3, 'm'); const [nx, ny] = norm(t.x - u.x, t.y - u.y); dashTo(t, u.x + nx * (u.r + t.r + 10), u.y + ny * (u.r + t.r + 10), 2200, null, true); stun(t, .65); } }); } },
    { n: '과부하', cd: 16, desc: '3초간 이동 속도가 크게 오르고 보호막을 얻습니다.', ai: { t: 'engage', r: 850 },
      cast(u) { buff(u, 'ms', .45, 3); shield(u, S(u, 60, 18) + u.maxHp * .08, 3); fx('ring', u.x, u.y, { r: 90, c: '#93c5fd' }); fx('aura', u.x, u.y, { c: '#93c5fd', follow: u.id, dur: 3 }); } },
    { n: '지면 강타', cd: 9, desc: '주변 적을 띄워 올리고 피해를 줍니다.', ai: { t: 'self', r: 260 },
      cast(u) { aoeNow(u, u.x, u.y, 260, t => { dmg(u, t, S(u, 66, 22) + u.ad * .85, 'p'); stun(t, .75); t.airT = .75; }, '#cbd5e1'); fx('quake', u.x, u.y, { r: 260, c: '#cbd5e1' }); } },
    { n: '정전기장', cd: 70, desc: '넓은 범위에 전기 충격을 일으켜 큰 피해를 주고 둔화시킵니다.', ai: { t: 'self', r: 520 },
      cast(u) { aoeNow(u, u.x, u.y, 560, t => { dmg(u, t, S(u, 220, 28) + u.ap + u.maxHp * .05, 'm'); slow(t, .5, 1.5); fx('bolt', t.x, t.y, { x2: u.x, y2: u.y, c: '#fde047' }); }, '#fde047'); fx('nova', u.x, u.y, { r: 560, c: '#fde047' }); } }] }),
  HD({ id: 'solin', name: '솔린', role: 'mage', color: '#fde68a', desc: '빛으로 묶고 멀리서 레이저를 쏘는 마법사', ab: [
    { n: '빛의 속박', cd: 11, desc: '빛 구체를 날려 최대 2명을 속박하고 피해를 줍니다.', ai: { t: 'shot', range: 1150, speed: 1300, w: 76 },
      cast(u, tx, ty) { const [dx, dy] = aimDir(u, tx, ty); proj({ owner: u, x: u.x, y: u.y, dx, dy, speed: 1300, range: 1150, r: 38, pierce: 2, color: '#fef08a', kind: 'orb', onHit(t) { dmg(u, t, S(u, 78, 25) + u.ap * .6, 'm'); root(t, 1.5); } }); } },
    { n: '빛의 장막', cd: 14, desc: '자신과 주변 아군에게 보호막을 씌웁니다.', ai: { t: 'shieldAura', r: 550 },
      cast(u) { for (const a of alliesIn(u.team, u.x, u.y, 550)) { shield(a, S(u, 65, 16) + u.ap * .35, 2.5); fx('ring', a.x, a.y, { r: 70, c: '#fde68a' }); } } },
    { n: '광휘 지대', cd: 10, desc: '지정 위치에 빛을 떨어뜨려 잠시 후 폭발, 피해와 둔화를 줍니다.', ai: { t: 'aoe', range: 1000, r: 300, delay: .6, wc: 1 },
      cast(u, tx, ty) { const [x, y] = clampPt(u, tx, ty, 1000); zone({ owner: u, x, y, r: 300, delay: .6, color: '#fde68a', onTrigger(ts) { for (const t of ts) { dmg(u, t, S(u, 78, 26) + u.ap * .7, 'm'); slow(t, .4, 1.5); } } }); } },
    { n: '섬광', cd: 50, desc: '잠시 후 아주 긴 직선 레이저를 발사해 맞은 모든 적에게 큰 피해를 줍니다.', ai: { t: 'line', range: 2800, delay: .8, w: 120 },
      cast(u, tx, ty) { const [dx, dy] = aimDir(u, tx, ty); zone({ owner: u, line: true, x: u.x, y: u.y, x2: u.x + dx * 2800, y2: u.y + dy * 2800, w: 120, delay: .8, color: '#fff7ae', onTrigger(ts) { for (const t of ts) dmg(u, t, S(u, 270, 30) + u.ap, 'm'); } }); } }] }),
  HD({ id: 'kaira', name: '카이라', role: 'adc', color: '#bef264', desc: '화살로 견제하고 초장거리 저격을 하는 사수', ab: [
    { n: '신비한 화살', cd: 5, desc: '화살을 쏴 피해를 줍니다. 적중 시 다른 스킬 재사용 대기시간이 1초 줄어듭니다.', ai: { t: 'shot', range: 1150, speed: 2000, w: 56, wc: 1 },
      cast(u, tx, ty) { const [dx, dy] = aimDir(u, tx, ty); proj({ owner: u, x: u.x, y: u.y, dx, dy, speed: 2000, range: 1150, r: 28, color: '#d9f99d', kind: 'arrow', onHit(t) { dmg(u, t, S(u, 35, 16) + u.ad * 1.0, 'p'); for (let i = 1; i < 4; i++) u.cds[i] = Math.max(0, u.cds[i] - 1); } }); } },
    { n: '연발 사격', cd: 10, desc: '부채꼴로 화살 7발을 쏴 피해를 주고 둔화시킵니다.', ai: { t: 'shot', range: 900, speed: 1700, w: 40, cone: 1, wc: 1 },
      cast(u, tx, ty) { const a0 = Math.atan2(ty - u.y, tx - u.x); const hs = new Set(); for (let i = -3; i <= 3; i++) { const a = a0 + i * .12; proj({ owner: u, x: u.x, y: u.y, dx: Math.cos(a), dy: Math.sin(a), speed: 1700, range: 900, r: 20, color: '#ecfccb', kind: 'arrow', shared: hs, onHit(t) { dmg(u, t, S(u, 25, 11) + u.ad * .8, 'p'); slow(t, .3, 1.5); } }); } } },
    { n: '질풍 이동', cd: 15, desc: '짧은 거리를 순간이동합니다.', ai: { t: 'dash', range: 450 },
      cast(u, tx, ty) { if (u.cc.root > 0) return false; const [x, y] = clampPt(u, tx, ty, 450); blink(u, x, y); } },
    { n: '관통 화살', cd: 60, desc: '맵을 가로지르는 거대한 화살. 맞은 모든 적에게 피해를 주고 처음 맞은 영웅을 기절시킵니다.', ai: { t: 'global', range: 3500, speed: 1600, w: 140 },
      cast(u, tx, ty) { const [dx, dy] = aimDir(u, tx, ty); let first = true; proj({ owner: u, x: u.x, y: u.y, dx, dy, speed: 1600, range: 6000, r: 70, pierce: 99, color: '#a3e635', kind: 'big', onHit(t) { dmg(u, t, S(u, 200, 26) + u.ad, 'm'); if (first && t.kind === 'hero') { stun(t, 1.4); first = false; } } }); } }] }),
  HD({ id: 'valkan', name: '바르칸', role: 'fighter', ad: 80, adL: 6, color: '#fbbf24', desc: '돌면서 베고 마무리 일격을 날리는 전사', ab: [
    { n: '결정타', cd: 8, desc: '잠시 빨라지고, 다음 기본 공격이 추가 피해를 주며 적을 크게 둔화시킵니다.', ai: { t: 'engage', r: 500 },
      cast(u) { buff(u, 'ms', .35, 1.6); buff(u, 'emp', S(u, 35, 16) + u.ad * .5, 4, { slow: .6 }); fx('ring', u.x, u.y, { r: 60, c: '#fbbf24' }); } },
    { n: '인내', cd: 18, desc: '3초간 받는 피해가 40% 줄어듭니다.', ai: { t: 'dr' },
      cast(u) { buff(u, 'dr', .4, 3); fx('aura', u.x, u.y, { c: '#fbbf24', follow: u.id, dur: 3 }); } },
    { n: '회전베기', cd: 9, desc: '3초간 회전하며 주변 적에게 계속 피해를 줍니다.', ai: { t: 'self', r: 300, wc: 1 },
      cast(u) { buff(u, 'spin', 0, 3, { r: 300, tick: 0, int: .5, dmgF: () => S(u, 15, 5.5) + u.ad * .35, col: '#fbbf24' }); } },
    { n: '심판', cd: 60, desc: '적 영웅 하나에게 잃은 체력에 비례한 고정 피해를 줍니다. 마무리용.', ai: { t: 'exec', range: 420 },
      est(u, t) { return S(u, 160, 22) + (t.maxHp - t.hp) * .33; },
      cast(u, tx, ty) { const t = pickTarget(u, tx, ty, 420, true); if (!t) return false; const a = this.est(u, t); fx('sword', t.x, t.y, { c: '#fde047' }); fx('ring', t.x, t.y, { r: 110, c: '#fde047' }); dmg(u, t, a, 't'); } }] }),
  HD({ id: 'niya', name: '니야', role: 'assassin', color: '#d8b4fe', desc: '파고들어 연속으로 베는 암살자', ab: [
    { n: '그림자 돌진', cd: 8, desc: '대상에게 순식간에 돌진해 피해를 줍니다. 대상을 처치하면 재사용 대기시간이 초기화됩니다.', ai: { t: 'target', range: 600 },
      cast(u, tx, ty) { if (u.cc.root > 0) return false; const t = pickTarget(u, tx, ty, 600, false); if (!t) return false; dashTo(u, t.x, t.y, 2400, () => { if (t.dead) return; dmg(u, t, S(u, 92, 32) + u.ad * .9, 'p'); fx('slash', t.x, t.y, { c: '#d8b4fe', a: 0 }); if (t.dead) u.cds[0] = .2; }, false, t); } },
    { n: '칼날 폭풍', cd: 7, desc: '주변에 칼날을 흩뿌려 피해를 주고 둔화시킵니다.', ai: { t: 'self', r: 300, wc: 1 },
      cast(u) { aoeNow(u, u.x, u.y, 300, t => { dmg(u, t, S(u, 66, 24) + u.ad * .7, 'p'); slow(t, .3, 1.2); }, '#d8b4fe'); fx('blades', u.x, u.y, { r: 300, c: '#d8b4fe' }); } },
    { n: '순보', cd: 13, desc: '짧은 거리를 순간이동합니다.', ai: { t: 'dash', range: 420 },
      cast(u, tx, ty) { if (u.cc.root > 0) return false; const [x, y] = clampPt(u, tx, ty, 420); blink(u, x, y); } },
    { n: '죽음의 연무', cd: 55, desc: '2.5초간 주변에 칼날 폭풍을 일으켜 매우 빠르게 피해를 줍니다.', ai: { t: 'self', r: 420 },
      cast(u) { buff(u, 'spin', 0, 2.5, { r: 450, tick: 0, int: .25, dmgF: () => S(u, 30, 7) + u.ad * .24, col: '#c084fc' }); } }] }),
  HD({ id: 'tera', name: '테라', role: 'support', color: '#f9a8d4', desc: '아군을 치유하고 적을 묶는 서포터',
    passive: '자연의 가호: 기본 공격이 적을 0.8초간 12% 둔화',
    onHit(u, t) { slow(t, .12, .8); }, ab: [
    { n: '생명의 꽃', cd: 9, desc: '체력 비율이 가장 낮은 주변 아군(자신 포함)을 치유하고 이동 속도를 높여줍니다.', ai: { t: 'heal', range: 750, th: .65 },
      cast(u) { const as = alliesIn(u.team, u.x, u.y, 750); if (!as.length) return false; as.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp); const a = as[0]; heal(a, S(u, 58, 14) + u.ap * .5); buff(a, 'ms', .2, 1.5); fx('heal', a.x, a.y, { c: '#86efac' }); } },
    { n: '가시 덩굴', cd: 12, desc: '지정 위치에 덩굴을 솟아오르게 해 피해를 주고 속박합니다.', ai: { t: 'aoe', range: 900, r: 260, delay: .7, wc: 1 },
      cast(u, tx, ty) { const [x, y] = clampPt(u, tx, ty, 900); zone({ owner: u, x, y, r: 260, delay: .7, color: '#86efac', vines: true, onTrigger(ts) { for (const t of ts) { dmg(u, t, S(u, 85, 26) + u.ap * .6, 'm'); root(t, 1.1); } } }); } },
    { n: '바람의 축복', cd: 18, desc: '주변 아군의 이동 속도를 2초간 크게 높입니다.', ai: { t: 'engage', r: 700 },
      cast(u) { for (const a of alliesIn(u.team, u.x, u.y, 650)) { buff(a, 'ms', .35, 2); fx('aura', a.x, a.y, { c: '#bae6fd', follow: a.id, dur: 2 }); } } },
    { n: '대지의 숨결', cd: 70, desc: '넓은 범위의 아군을 크게 치유하고 주변 적에게 피해를 줍니다.', ai: { t: 'heal', range: 800, th: .45 },
      cast(u) { for (const a of alliesIn(u.team, u.x, u.y, 850)) { heal(a, S(u, 132, 21) + u.ap * .6); fx('heal', a.x, a.y, { c: '#86efac' }); } aoeNow(u, u.x, u.y, 500, t => dmg(u, t, S(u, 140, 22) + u.ap * .4, 'm'), '#86efac'); fx('nova', u.x, u.y, { r: 850, c: '#86efac' }); } }] }),
  // 무기의 달인: 평타를 칠수록 빨라지고, 반격 태세로 평타를 흘려낸 뒤 주변을 기절시킴
  HD({ id: 'rokan', name: '로칸', role: 'fighter', ad: 92, adL: 6.8, color: '#5eead4', desc: '평타가 쌓일수록 강해지는 쇠봉의 달인',
    passive: '연속 공격: 기본 공격이 적중할 때마다 공격 속도 +5% (최대 8중첩, 2.5초 유지)',
    onHit(u, t) {
      let b = u.buffs.find(x => x.type === 'as' && x.tag === 'rokan'); if (!b) { b = { type: 'as', tag: 'rokan', n: 0, v: 0, t: 2.5 }; u.buffs.push(b); }
      b.n = Math.min(8, b.n + 1); b.v = b.n * .05; b.t = 2.5;
      u.hitN = (u.hitN || 0) + 1; if (u.rank[3] > 0 && u.hitN % 3 === 0) { dmg(u, t, S(u, 55, 12) + u.ap * .6, 'm', true); fx('ring', t.x, t.y, { r: 70, c: '#5eead4' }); }
    }, ab: [
    { n: '도약 강타', cd: 10, desc: '대상에게 뛰어올라 내려찍으며 피해를 줍니다.', ai: { t: 'target', range: 700 },
      cast(u, tx, ty) { if (u.cc.root > 0) return false; const t = pickTarget(u, tx, ty, 700, false); if (!t) return false; dashTo(u, t.x, t.y, 2000, () => { if (t.dead) return; dmg(u, t, S(u, 65, 25) + AD(u) * .7, 'p'); fx('quake', t.x, t.y, { r: 140, c: '#5eead4' }); }, false, t); u.leapT = G.t; } },
    { n: '강화 타격', cd: 7, desc: '다음 기본 공격이 즉시 나가며 추가 마법 피해를 줍니다.', ai: { t: 'empower' },
      cast(u) { buff(u, 'emp', S(u, 45, 15) + AD(u) * .3 + u.ap * .6, 5, { slow: 0 }); u.atkCd = Math.min(u.atkCd, 0); fx('aura', u.x, u.y, { c: '#5eead4', follow: u.id, dur: .6 }); } },
    { n: '반격 태세', cd: 14, desc: '2초간 모든 기본 공격을 피합니다. 끝날 때 주변 적을 기절시키고, 피한 공격마다 피해가 20% 커집니다.', ai: { t: 'counter' },
      cast(u) { buff(u, 'dodge', 0, 2, { n: 0, onEnd: (b) => { if (u.dead) return; const k = 1 + .2 * Math.min(5, b.n); aoeNow(u, u.x, u.y, 300, t => { dmg(u, t, (S(u, 52, 17) + AD(u) * .5) * k, 'p'); stun(t, 1); }, '#5eead4'); fx('quake', u.x, u.y, { r: 300, c: '#5eead4' }); } }); fx('aura', u.x, u.y, { c: '#99f6e4', follow: u.id, dur: 2 }); } },
    { n: '무기의 달인', cd: 70, desc: '8초간 방어력이 크게 오릅니다. (6레벨부터 세 번째 기본 공격마다 추가 마법 피해)', ai: { t: 'buffFight' },
      cast(u) { buff(u, 'def', S(u, 25, 4), 8); fx('aura', u.x, u.y, { c: '#5eead4', follow: u.id, dur: 8 }); fx('ring', u.x, u.y, { r: 120, c: '#5eead4' }); } }] }),
  // 학살자: 출혈을 쌓고, 원형 베기로 회복하며 버티고, 단두대로 마무리 (처치 시 초기화)
  HD({ id: 'braks', name: '브락스', role: 'fighter', color: '#e11d48', desc: '출혈을 쌓아 단두대로 끝내는 도끼 학살자',
    passive: '출혈: 공격과 스킬이 출혈을 1중첩(최대 5) 남겨 5초간 지속 피해. 영웅에게 5중첩이면 5초간 공격력이 크게 오름',
    onHit(u, t) { addBleed(u, t, u.buffs.some(b => b.tag === 'might') ? 5 : 1); }, ab: [
    { n: '원형 베기', cd: 9, desc: '잠시 후 도끼를 크게 휘두릅니다. 날 부분(바깥쪽)에 맞은 적은 큰 피해와 출혈을 입고, 맞힌 영웅 수만큼 체력을 회복합니다.', ai: { t: 'ring', r: 425 },
      cast(u) { buff(u, 'ms', -.25, .75); zone({ owner: u, x: u.x, y: u.y, r: 425, inner: 205, follow: u, delay: .75, color: '#fb7185', axe: true, onTrigger(ts) { let heroes = 0; for (const t of ts) { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d > 205) { dmg(u, t, S(u, 52, 20) + AD(u) * .9, 'p'); addBleed(u, t, 1); if (t.kind === 'hero') heroes++; } else dmg(u, t, (S(u, 52, 20) + AD(u) * .9) * .35, 'p'); } if (heroes) heal(u, (u.maxHp - u.hp) * .11 * heroes); } }); } },
    { n: '절단 타격', cd: 6, desc: '다음 기본 공격이 즉시 나가며 추가 피해를 주고 적을 크게 둔화시킵니다.', ai: { t: 'empower' },
      cast(u) { buff(u, 'emp', AD(u) * .5, 5, { slow: .9 }); u.atkCd = Math.min(u.atkCd, 0); } },
    { n: '포획', cd: 18, desc: '앞쪽 부채꼴 범위의 적을 도끼로 끌어당기고 둔화시킵니다.', ai: { t: 'cone', range: 535 },
      cast(u, tx, ty) { const a0 = Math.atan2(ty - u.y, tx - u.x); let n = 0; for (const t of enemiesIn(u.team, u.x, u.y, 535)) { let da = Math.atan2(t.y - u.y, t.x - u.x) - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; if (Math.abs(da) > .5 && Math.hypot(t.x - u.x, t.y - u.y) > u.r + t.r + 20) continue; const [nx, ny] = norm(t.x - u.x, t.y - u.y); dashTo(t, u.x + nx * (u.r + t.r + 40), u.y + ny * (u.r + t.r + 40), 1800, null, true); slow(t, .4, 1); n++; } fx('cone', u.x, u.y, { a: a0, r: 535, c: '#fb7185' }); } },
    { n: '단두대', cd: 60, desc: '적 영웅에게 뛰어올라 고정 피해를 줍니다. 출혈 중첩마다 피해 20% 증가, 처치하면 재사용 대기시간이 초기화됩니다.', ai: { t: 'exec', range: 460 },
      est(u, t) { const n = t.bleed && t.bleed.src === u ? t.bleed.n : 0; return (S(u, 120, 24) + AD(u) * .75) * (1 + .2 * n); },
      cast(u, tx, ty) { if (u.cc.root > 0) return false; const t = pickTarget(u, tx, ty, 460, true); if (!t) return false; const ab = this; dashTo(u, t.x, t.y, 2200, () => { if (t.dead) return; const a = ab.est(u, t); fx('sword', t.x, t.y, { c: '#fb7185' }); dmg(u, t, a, 't'); if (t.dead) { u.cds[3] = 0; ev({ t: 'banner', s: '단두대 초기화!', c: '#fb7185', d: 1.5, to: u.id }); } else addBleed(u, t, 1); }, false, t); u.leapT = G.t; } }] })
];
// 마나: 니야·바르칸은 자원 없음. cost = [Q, W, E, R] 기본 소모 (Q·W·E는 랭크마다 +5)
const MANA = {
  graff: { mp: 320, mpL: 40, cost: [60, 50, 40, 100] }, solin: { mp: 400, mpL: 50, cost: [55, 60, 75, 100] },
  kaira: { mp: 360, mpL: 45, cost: [30, 50, 90, 100] }, tera: { mp: 420, mpL: 50, cost: [60, 70, 60, 100] },
  rokan: { mp: 360, mpL: 40, cost: [50, 25, 40, 0] }, braks: { mp: 320, mpL: 42, cost: [30, 30, 40, 80] }
};
const SKILL_ORDER = { valkan: [0, 2, 1], niya: [0, 1, 2], tera: [0, 1, 2], rokan: [0, 2, 1] }; // 나머지는 Q → E → W
for (const h of HEROES) { const m = MANA[h.id]; h.mp = m ? m.mp : 0; h.mpL = m ? m.mpL : 0; h.cost = m ? m.cost : [0, 0, 0, 0]; h.order = SKILL_ORDER[h.id] || [0, 2, 1]; }
export const HMAP = {}; HEROES.forEach(h => HMAP[h.id] = h);
export const SELF_T = ['self', 'heal', 'shieldAura', 'engage', 'dr', 'empower', 'counter', 'buffFight', 'ring'];

/* ================= 아이템 ================= */
export const ITEMS = {
  dblade: { n: '수련생의 검', c: 450, ad: 10, hp: 80 },
  dring: { n: '수련생의 반지', c: 400, ap: 18, hp: 70, mp: 60 },
  boots: { n: '신속의 장화', c: 900, ms: 45, df: 8 },
  sword: { n: '강철 장검', c: 1100, ad: 30 },
  dagger: { n: '쾌속 단검', c: 900, as: .25 },
  bow: { n: '질풍의 활', c: 2600, ad: 35, as: .35 },
  great: { n: '파괴의 대검', c: 3000, ad: 75 },
  tome: { n: '비전 마법서', c: 1100, ap: 40, mp: 250 },
  staff: { n: '심연의 지팡이', c: 3000, ap: 115 },
  orb: { n: '시간의 구슬', c: 2500, ap: 70, ah: 20, mp: 300 },
  hour: { n: '전장의 모래시계', c: 2700, ad: 35, ah: 20, hp: 250, mp: 250 },
  belt: { n: '튼튼한 허리띠', c: 900, hp: 320 },
  heart: { n: '거인의 심장', c: 2900, hp: 750, df: 15 },
  plate: { n: '빙하 판금', c: 2500, df: 65, hp: 200 },
  edge: { n: '예리한 칼날', c: 2800, ad: 45, crit: .25 },
  scythe: { n: '흡혈의 낫', c: 2400, ad: 40, ls: .15 }
};
const STARTER = { tank: 'dblade', fighter: 'dblade', assassin: 'dblade', adc: 'dblade', mage: 'dring', support: 'dring' };
const BUILDS = { tank: ['boots', 'belt', 'heart', 'plate', 'scythe', 'hour'], mage: ['boots', 'tome', 'staff', 'orb', 'plate', 'heart'], adc: ['boots', 'dagger', 'bow', 'edge', 'scythe', 'great'], fighter: ['boots', 'sword', 'scythe', 'hour', 'heart', 'edge'], assassin: ['boots', 'sword', 'edge', 'great', 'scythe', 'plate'], support: ['boots', 'tome', 'orb', 'heart', 'plate', 'belt'] };
export function itemStats(it) { const p = []; if (it.ad) p.push('공격력 +' + it.ad); if (it.ap) p.push('주문력 +' + it.ap); if (it.hp) p.push('체력 +' + it.hp); if (it.mp) p.push('마나 +' + it.mp); if (it.df) p.push('방어력 +' + it.df); if (it.as) p.push('공격 속도 +' + Math.round(it.as * 100) + '%'); if (it.ms) p.push('이동 속도 +' + it.ms); if (it.ah) p.push('스킬 가속 +' + it.ah); if (it.crit) p.push('치명타 확률 +' + Math.round(it.crit * 100) + '%'); if (it.ls) p.push('생명력 흡수 ' + Math.round(it.ls * 100) + '%'); return p.join(' · '); }

/* ================= 상태 ================= */
let UID = 1;
export let G = null;
function mkUnit(o) { const u = Object.assign({ id: UID++, vx: 0, vy: 0, hp: o.maxHp || 1, shields: [], cc: { stun: 0, root: 0, slows: [] }, buffs: [], atkCd: 0, dead: false, target: null, moveTo: null, lastHitBy: {}, def: 0, atkT: -9, castT: -9 }, o); u.hr = u.kind === 'hero' ? 58 : u.kind === 'minion' ? u.r + 8 : u.r; return u; }
function spawnPt(team) { const f = G.map.fountain[team]; return G.map.clampPt(f.x + rand(-90, 90), f.y + rand(-90, 90), 42); }
function mkHero(d, team, ctl, pos) {
  const rift = G.mode === 'rift', [x, y] = spawnPt(team);
  const u = mkUnit({ kind: 'hero', hd: d, team, ctl, isPlayer: ctl === 'local', mobile: true, name: d.name, r: 42, level: rift ? 1 : 3, xp: 0, gold: rift ? 500 : 1400, items: [], k: 0, d: 0, a: 0, cs: 0, cds: [0, 0, 0, 0], spellCd: { D: 0, F: 0 }, maxHp: 1, x, y, respawnT: 0, mark: null, yOff: rand(-230, 230) * (rift ? .6 : 1), aiT: rand(0, .3), mk: { n: 0, t: -99 }, rank: [0, 0, 0, 0], pts: rift ? 1 : 3, maxMana: 0, mana: 0, shopOpen: true, spawnT: 0,
    pos: pos || null, lane: pos === 'top' ? 'top' : pos === 'bot' || pos === 'sup' ? 'bot' : pos === 'jungle' ? null : 'mid',
    spells: { D: 'flash', F: !rift ? 'snow' : pos === 'jungle' ? 'smite' : 'heal' } });
  recalc(u); u.hp = u.maxHp; u.mana = u.maxMana; return u;
}
export function recalc(u) {
  const d = u.hd, L = u.level - 1, old = u.maxHp;
  const oldM = u.maxMana || 0;
  const s = { maxHp: d.hp + d.hpL * L, ad: d.ad + d.adL * L, ap: 0, def: d.df + d.dfL * L, ms: d.ms, range: d.range, ah: 0, crit: 0, ls: 0, maxMana: d.mp ? d.mp + d.mpL * L : 0 };
  let asB = d.asL * L;
  for (const id of u.items) { const it = ITEMS[id]; s.maxHp += it.hp || 0; s.ad += it.ad || 0; s.ap += it.ap || 0; s.def += it.df || 0; asB += it.as || 0; s.ms += it.ms || 0; s.ah += it.ah || 0; s.crit += it.crit || 0; s.ls += it.ls || 0; if (d.mp) s.maxMana += it.mp || 0; }
  s.as = Math.min(2.5, d.as * (1 + asB));
  Object.assign(u, s);
  if (old > 1) u.hp = clamp(u.hp + Math.max(0, u.maxHp - old), 1, u.maxHp);
  if (oldM > 0) u.mana = clamp(u.mana + Math.max(0, u.maxMana - oldM), 0, u.maxMana);
}
function mkStruct(kind, team, x, y) {
  if (kind === 'tower') return mkUnit({ kind, team, x, y, mobile: false, maxHp: G.mode === 'rift' ? 2600 : 2600, ad: 170, range: 750, as: .85, def: 25, r: 70 });
  return mkUnit({ kind, team, x, y, mobile: false, maxHp: 3600, ad: 0, range: 0, as: 1, def: 0, r: 115 });
}
/* ---- 정글 몬스터 (팀 2 = 중립) ---- */
const MONS = {
  blue: [{ n: '푸른 정령', hp: 1500, ad: 52, r: 62, gold: 100, xp: 200, big: 1, top: 2.1 }],
  red: [{ n: '붉은 골렘', hp: 1600, ad: 58, r: 62, gold: 100, xp: 200, big: 1, top: 2.1 }],
  wolf: [{ n: '늑대', hp: 1000, ad: 38, r: 46, gold: 60, xp: 100, big: 1, top: 1.1 }, { n: '새끼 늑대', hp: 380, ad: 16, r: 30, gold: 22, xp: 40, ox: -110, oy: 90, top: .7 }, { n: '새끼 늑대', hp: 380, ad: 16, r: 30, gold: 22, xp: 40, ox: 110, oy: 90, top: .7 }],
  toad: [{ n: '얼음 두꺼비', hp: 1350, ad: 46, r: 56, gold: 85, xp: 160, big: 1, top: 1.1 }]
};
export const CAMP_N = { blue: '푸른 정령 (스킬 가속·마나 재생 버프)', red: '붉은 골렘 (평타 둔화·화상 버프)', wolf: '늑대 무리', toad: '얼음 두꺼비' };
function spawnCamp(c) {
  const mn = G.t / 60; c.units = [];
  for (const m of MONS[c.type]) {
    const x = c.x + (m.ox || 0), y = c.y + (m.oy || 0);
    const u = mkUnit({ kind: 'monster', mon: c.type, big: !!m.big, top: m.top, name: m.n, team: 2, x, y, home: { x, y }, camp: c, mobile: true, maxHp: m.hp * (1 + mn * .07), ad: m.ad * (1 + mn * .05), def: 10 + mn * 1.2, range: 150, as: .7, r: m.r, ms: 330, gold: m.gold, xp: m.xp * .75 * (1 + mn * .02), face: Math.PI / 2 });
    c.units.push(u); G.units.push(u);
  }
  c.up = true; c.aggro = null;
}
const MINI = { m: { hp: 480, ad: 13, range: 100, as: .8, r: 26, ms: 310, gold: 22, xp: 60 }, c: { hp: 300, ad: 24, range: 480, as: .65, r: 22, ms: 310, gold: 16, xp: 32 }, s: { hp: 950, ad: 42, range: 320, as: .7, r: 32, ms: 300, gold: 50, xp: 90 } };
function mkMinion(k, team, x, y, lane, off) {
  const T = MINI[k], mn = G.t / 60;
  return mkUnit({ kind: 'minion', mk: k, team, x, y, mobile: true, maxHp: T.hp + mn * 28 * (k === 's' ? 2 : 1), ad: T.ad + mn * 2.5, def: mn * 1.5, range: T.range, as: T.as, r: T.r, ms: T.ms, gold: T.gold, xp: T.xp, lane, laneOff: off, aiT: 0, face: team ? Math.PI : 0 });
}
export function need(L) { return 180 + 60 * L; }
// 스킬 레벨업 규칙 (롤과 같음): Q·W·E 최대 5랭크, n랭크는 영웅 레벨 2n-1부터 / R은 6·11·16레벨
export function canLevel(u, i) {
  if (!u.pts || u.pts <= 0) return false; const r = u.rank[i];
  if (i === 3) return r < 3 && u.level >= [6, 11, 16][r];
  return r < 5 && u.level >= 2 * r + 1;
}
export function levelSkill(u, i) { if (!canLevel(u, i)) return false; u.rank[i]++; u.pts--; return true; }
function autoSkill(u) {
  while (u.pts > 0) {
    if (canLevel(u, 3)) { levelSkill(u, 3); continue; }
    const fresh = [0, 1, 2].find(i => u.rank[i] === 0 && canLevel(u, i)); if (fresh !== undefined) { levelSkill(u, fresh); continue; }
    const nxt = u.hd.order.find(i => canLevel(u, i)); if (nxt === undefined) break; levelSkill(u, nxt);
  }
}
// 랭크를 '스킬 수치를 계산할 레벨'로 환산: Q·W·E는 1랭크=1레벨 … 5랭크=18레벨, R은 1/2/3랭크=6/11/16레벨
export function rankLevel(u, i) { const r = u.rank[i]; return r <= 0 ? 1 : i === 3 ? 1 + 5 * r : 1 + (r - 1) * 4.25; }
export function cdOf(u, i) { const r = Math.max(1, u.rank[i]), ab = u.hd.ab[i]; return ab.cd * (i === 3 ? 1 - .15 * (r - 1) : 1 - .06 * (r - 1)) * 100 / (100 + u.ah + (u.buffs.some(b => b.type === 'blueb') ? 20 : 0)); }
export function costOf(u, i) { const c = u.hd.cost[i]; return c ? c + (i < 3 ? 5 * (Math.max(1, u.rank[i]) - 1) : 0) : 0; }
function heroesAlive(team) { return G.heroes.filter(h => !h.dead && h.team === team); }

/* ================= 게임 생성 ================= */
// opts: {mode:'1v1'|'5v5'|'rift', pick, enemy, diff, pos(협곡: top|jungle|mid|bot|sup)}
export function newGame(opts) {
  UID = 1;
  const mode = opts.mode || '1v1', rift = mode === 'rift';
  G = { mode, t: 0, units: [], heroes: [], projs: [], zones: [], fxq: [], events: [], kills: [0, 0], wave: 0, nextWave: rift ? 20 : 12, waveInt: rift ? 30 : 25, diff: opts.diff ?? 1, over: false, winner: -1, first: false, relics: [], struct: [{}, {}], camps: [], PID: 1, stats: { auto: 0, abil: 0 } };
  G.map = rift ? riftMap() : aramMap();
  for (const team of [0, 1]) {
    const list = G.map.structs(team), byId = {};
    for (const d of list) { const u = mkStruct(d.kind, team, d.x, d.y); u.sid = d.id; u.lane = d.lane || null; byId[d.id] = u; G.units.push(u); }
    for (const d of list) { const u = byId[d.id]; if (d.reqAll) u.reqAll = d.reqAll.map(k => byId[k]); if (d.reqAny) u.reqAny = d.reqAny.map(k => byId[k]); }
    // 각 라인 위에서의 위치 (라인 근처에 있는 구조물만)
    for (const u of Object.values(byId)) { u.lpos = {}; for (const [k, L] of Object.entries(G.map.lanes)) { const pr = laneProj(L, u.x, u.y); if (pr.d < 450) u.lpos[k] = pr.s; } }
    G.struct[team] = byId;
  }
  for (const [x, y] of G.map.relics) G.relics.push({ x, y, on: false, t: 60 });
  for (const c of G.map.camps) G.camps.push({ ...c, up: false, t: c.type === 'blue' || c.type === 'red' ? 60 : 50, units: [] });
  const ids = HEROES.map(h => h.id);
  const pickR = p => (!p || p === 'random') ? ids[Math.floor(Math.random() * ids.length)] : p;
  const pid = pickR(opts.pick);
  if (rift) {
    const order = ['top', 'jungle', 'mid', 'bot', 'sup'], myPos = order.includes(opts.pos) ? opts.pos : order[Math.floor(Math.random() * 5)];
    for (const team of [0, 1]) {
      const used = new Set(); if (team === 0) used.add(pid);
      for (const pos of order) {
        let hid;
        if (team === 0 && pos === myPos) hid = pid;
        else { hid = POS_POOL[pos].find(i => !used.has(i) && Math.random() < .75) || POS_POOL[pos].find(i => !used.has(i)) || ids.find(i => !used.has(i)); used.add(hid); }
        const h = mkHero(HMAP[hid], team, team === 0 && pos === myPos ? (opts.ctl0 || 'local') : 'ai', pos); G.heroes.push(h); if (team === 0 && pos === myPos) G.player = h;
      }
    }
  } else {
    const p = mkHero(HMAP[pid], 0, opts.ctl0 || 'local'); G.player = p; G.heroes.push(p);
    if (mode === '1v1') {
      G.heroes.push(mkHero(HMAP[pickR(opts.enemy)], 1, opts.ctl1 || 'ai'));
    } else {
      shuffle(ids.filter(i => i !== pid)).slice(0, 4).forEach(i => G.heroes.push(mkHero(HMAP[i], 0, 'ai')));
      shuffle(ids.slice()).slice(0, 5).forEach(i => G.heroes.push(mkHero(HMAP[i], 1, 'ai')));
    }
  }
  G.units.push(...G.heroes);
  for (const h of G.heroes) { if (h.ctl === 'ai') { aiShop(h); autoSkill(h); } }
  if (opts.autoSkill) { G.player.autoSkill = true; autoSkill(G.player); }
  ev({ t: 'banner', s: rift ? `협곡에 오신 것을 환영합니다 — ${POS[G.player.pos]}` : mode === '1v1' ? '1대1 결투! 상대 넥서스를 파괴하세요' : '시작 아이템을 사고 다리 중앙으로!', c: '#e6eefc', d: 3 });
  return G;
}
function spawnWave() {
  G.wave++;
  for (const [ln, L] of Object.entries(G.map.lanes)) for (const team of [0, 1]) {
    const dir = team ? -1 : 1, s0o = G.map.grid ? 300 : 160, s0 = team ? L.len - s0o : s0o;
    const list = ['m', 'm', 'm', 'c', 'c', 'c']; if (G.wave % 3 === 0) list.push('s');
    // 이 라인의 상대 포탑을 부쉈으면 매 웨이브 공성 미니언 추가 (밀어붙이기 쉽게)
    const et = Object.values(G.struct[1 - team]).find(t => t.kind === 'tower' && t.lane === ln && !t.reqAny && !t.reqAll);
    if (G.mode === 'rift' && et && et.dead && G.wave % 3) list.push('s');
    list.forEach((k, i) => { const row = k === 'm' ? 0 : k === 'c' ? 1 : 2, col = k === 's' ? 0 : i % 3 - 1; const p = lanePt(L, s0 - dir * row * 90); const off = col * 80 + rand(-10, 10); G.units.push(mkMinion(k, team, p.x - p.dy * off, p.y + p.dx * off, ln, off)); });
  }
}

/* ================= 전투 도우미 ================= */
export function canHitStructure(s) { if (s.reqAll && !s.reqAll.every(t => t.dead)) return false; if (s.reqAny && !s.reqAny.some(t => t.dead)) return false; return true; }
export function targetable(u, t) { return t && !t.dead && !t.reset && t.team !== u.team && (t.mobile || canHitStructure(t)); } // 캠프로 돌아가는 몬스터는 대상 불가
function enemiesIn(team, x, y, r, heroOnly) { return G.units.filter(e => !e.dead && e.team !== team && e.mobile && (!heroOnly || e.kind === 'hero') && Math.hypot(e.x - x, e.y - y) < r + e.hr); }
function alliesIn(team, x, y, r) { return G.heroes.filter(e => !e.dead && e.team === team && Math.hypot(e.x - x, e.y - y) < r + e.r); }
function stun(t, d) { if (t.mobile && !t.dead) t.cc.stun = Math.max(t.cc.stun, d); }
function root(t, d) { if (t.mobile && !t.dead) t.cc.root = Math.max(t.cc.root, d); }
function slow(t, p, d) { if (t.mobile && !t.dead) t.cc.slows.push({ p, t: d }); }
function buff(u, type, v, d, extra) { u.buffs.push(Object.assign({ type, v, t: d, rl: u.curRankL }, extra || {})); }
function shield(u, a, d) { u.shields.push({ a, t: d }); }
function heal(u, a, quiet) { if (u.dead) return; const h = Math.min(a, u.maxHp - u.hp); u.hp += h; if (h > 5 && !quiet) ev({ t: 'text', x: u.x, y: u.y, s: '+' + Math.round(h), k: 'heal', team: u.team, to: u.id }); }
function dashTo(u, x, y, speed, onEnd, forced, tgt) { [x, y] = clampMap(x, y, u.r); u.dash = { x, y, speed, onEnd, forced, tgt, rl: u.curRankL }; u.target = null; u.moveTo = null; }
function blink(u, x, y) { fx('blink', u.x, u.y, { c: u.hd ? u.hd.color : '#ffffff' }); [x, y] = clampMap(x, y, u.r); u.x = x; u.y = y; u.px = x; u.py = y; fx('blink', x, y, { c: '#ffffff' }); }
function aoeNow(u, x, y, r, fn, c) { for (const t of enemiesIn(u.team, x, y, r)) fn(t); fx('ring', x, y, { r, c: c || '#ffffff', fill: 1 }); }
function proj(o) { G.projs.push(Object.assign({ id: G.PID++, trav: 0, hit: new Set(), pierce: 1, rl: o.owner && o.owner.curRankL }, o)); }
function withRank(u, rl, fn) { const prev = u.curRankL; u.curRankL = rl; try { fn(); } finally { u.curRankL = prev; } }
function zone(o) { G.zones.push(Object.assign({ id: G.PID++, t: 0, rl: o.owner && o.owner.curRankL }, o)); }
export function pickTarget(u, tx, ty, range, heroOnly) {
  if (u.castTid) { const t = G.units.find(e => e.id === u.castTid); if (t && targetable(u, t) && t.mobile && (!heroOnly || t.kind === 'hero') && Math.hypot(t.x - u.x, t.y - u.y) < range + t.hr) return t; }
  let best = null, bs = 1e9;
  for (const e of enemiesIn(u.team, u.x, u.y, range, heroOnly)) { const s = Math.hypot(e.x - tx, e.y - ty) - (e.kind === 'hero' ? 180 : 0); if (s < bs) { bs = s; best = e; } } return best;
}
export function AD(u) { let a = u.ad; for (const b of u.buffs) if (b.type === 'ad') a += b.v; return a; }
export function asOf(u) { let m = 1; for (const b of u.buffs) if (b.type === 'as') m += b.v; return Math.min(2.8, u.as * m); }
export function defOf(u) { let d = u.def || 0; for (const b of u.buffs) if (b.type === 'def') d += b.v; return d; }
function addBleed(src, t, n) {
  if (!t.mobile || t.dead) return;
  if (!t.bleed || t.bleed.src !== src) t.bleed = { src, n: 0, tick: 1 };
  t.bleed.n = Math.min(5, t.bleed.n + n); t.bleed.t = 5;
  if (t.kind === 'hero' && t.bleed.n >= 5) { let b = src.buffs.find(x => x.tag === 'might'); if (!b) { b = { type: 'ad', tag: 'might', v: 0, t: 5 }; src.buffs.push(b); fx('aura', src.x, src.y, { c: '#fb7185', follow: src.id, dur: 5 }); } b.v = S(src, 30, 6); b.t = 5; }
}
export function effMs(u) { let b = 0, s = 0; for (const x of u.buffs) if (x.type === 'ms') b += x.v; for (const x of u.cc.slows) s = Math.max(s, x.p); return u.ms * (1 + b) * (1 - s); }
function moveToward(u, tx, ty, dt) {
  if (u.cc.root > 0 || u.cc.stun > 0) return false; const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy); if (d < 2) return true;
  const sp = effMs(u) * dt; let nx, ny, done = false; if (sp >= d) { nx = tx; ny = ty; done = true; } else { nx = u.x + dx / d * sp; ny = u.y + dy / d * sp; }
  const M = G.map; if (M.grid && !M.walk(nx, ny)) { // 벽에 막히면 벽을 따라 미끄러짐
    if (M.walk(nx, u.y)) ny = u.y; else if (M.walk(u.x, ny)) nx = u.x; else return false; done = false;
  }
  u.x = nx; u.y = ny; return done;
}
// 길찾기 이동: 곧장 갈 수 있으면 직진, 벽이 가로막으면 A* 경로를 따라감
function navMove(u, tx, ty, dt) {
  const M = G.map; if (!M.grid) return moveToward(u, tx, ty, dt);
  const n = u.nav; u.navAge = (u.navAge || 0) + dt;
  if (!n || u.navAge > 1 || (Math.hypot(n.gx - tx, n.gy - ty) > 120 && u.navAge > .25)) {
    u.navAge = 0; const pts = M.los(u.x, u.y, tx, ty) ? [] : (M.path(u.x, u.y, tx, ty) || []);
    u.nav = { gx: tx, gy: ty, pts };
  }
  const p = u.nav.pts; while (p.length > 1 && Math.hypot(p[0][0] - u.x, p[0][1] - u.y) < 6) p.shift();
  const ox = u.x, oy = u.y, want = effMs(u) * dt; let done;
  if (p.length > 1 || (p.length === 1 && Math.hypot(p[0][0] - tx, p[0][1] - ty) > 60)) { u.face = Math.atan2(p[0][1] - u.y, p[0][0] - u.x); if (moveToward(u, p[0][0], p[0][1], dt)) p.shift(); done = false; }
  else done = moveToward(u, tx, ty, dt);
  // 벽 모서리에 걸려 제대로 못 움직였으면 지금 위치에서 바로 길을 다시 찾음
  if (!done && want > 1 && Math.hypot(u.x - ox, u.y - oy) < want * .5 && u.cc.root <= 0 && u.cc.stun <= 0) u.navAge = Math.max(u.navAge, .9);
  return done;
}
export function inRange(u, t, extra) { return Math.hypot(t.x - u.x, t.y - u.y) <= u.range + u.r * .5 + t.r + (extra || 0); }
// 롤식 기본 공격: 선딜(공격 모션) 동안 멈춰 있다가 끝나는 순간 적중/발사. 선딜 중 이동하면 공격이 취소되고 쿨은 돌려받음
function windupTime(u) { return Math.min(.3, .22 / asOf(u)); }
function doAttack(u, dt) {
  const t = u.target; if (!targetable(u, t)) { u.target = null; return false; }
  if (u.wind) return true;
  if (inRange(u, t)) { u.face = Math.atan2(t.y - u.y, t.x - u.x); if (u.atkCd <= 0 && u.cc.stun <= 0) startAttack(u, t); return true; }
  navMove(u, t.x, t.y, dt); return true;
}
function startAttack(u, t) {
  u.atkCd = 1 / asOf(u); u.atkT = G.t; u.lastAtkT = G.t; u.face = Math.atan2(t.y - u.y, t.x - u.x);
  if (u.kind === 'tower') { autoAttack(u, t); return; }
  u.wind = { t: windupTime(u), tgt: t };
}
export function cancelWind(u) { if (u.wind) { u.wind = null; u.atkCd = 0; u.atkT = -9; } }
function tickWind(u, dt) {
  const w = u.wind; if (!w) return;
  if (u.cc.stun > 0 || !targetable(u, w.tgt) || !inRange(u, w.tgt, 120)) { cancelWind(u); return; }
  u.face = Math.atan2(w.tgt.y - u.y, w.tgt.x - u.x);
  w.t -= dt; if (w.t <= 0) { u.wind = null; autoAttack(u, w.tgt); }
}
function autoAttack(u, t) {
  let bonus = 0, sl = 0; const ei = u.buffs.findIndex(b => b.type === 'emp'); if (ei >= 0) { bonus = u.buffs[ei].v; sl = u.buffs[ei].slow; u.buffs.splice(ei, 1); }
  const crit = u.crit > 0 && Math.random() < u.crit;
  const amt = (AD(u) + bonus) * (crit ? 1.75 : 1);
  const hit = () => { const d = dmg(u, t, amt, crit ? 'crit' : 'p', true); if (d > 0 && u.hd && u.hd.onHit) u.hd.onHit(u, t, d); if (u.ls && d > 0 && t.kind !== 'tower' && t.kind !== 'nexus') heal(u, d * u.ls, true); if (sl) slow(t, sl, 1); if (d > 0 && u.buffs && u.buffs.some(b => b.type === 'redb')) { slow(t, .2, 1); dmg(u, t, 6 + u.level * 2.5, 'bleed', true); } if (bonus) fx('ring', t.x, t.y, { r: 60, c: '#fbbf24' }); fx('hit', t.x, t.y, { c: crit ? '#fde047' : u.hd ? u.hd.color : TEAMC[u.team], big: crit }); };
  if (u.range > 250 || u.kind === 'tower') { const tw = u.kind === 'tower'; G.projs.push({ id: G.PID++, homing: true, owner: u, tgt: t, x: u.x, y: u.y, speed: tw ? 1300 : 1800, cb: hit, r: tw ? 24 : u.kind === 'hero' ? 13 : 9, color: tw ? TEAMC[u.team] : u.hd ? u.hd.color : TEAMC[u.team], kind: tw ? 'tower' : 'auto', z0: tw ? 340 : 60 }); }
  else { hit(); fx('slash', t.x, t.y, { c: crit ? '#fde047' : u.hd ? u.hd.color : '#ffffff', a: Math.atan2(t.y - u.y, t.x - u.x), dur: .2 }); }
}
const ABILITY_MULT = .6; // 스킬 피해 비중을 낮추고 평타 비중을 높임
export function dmg(src, tg, amt, type, auto) {
  if (!tg || tg.dead) return 0;
  if (!tg.mobile && !canHitStructure(tg)) return 0;
  let a = amt;
  if (src && src.kind === 'hero' && !auto) a *= ABILITY_MULT;
  if (auto && type !== 'bleed') { const dg = tg.buffs.find(b => b.type === 'dodge'); if (dg) { dg.n++; ev({ t: 'text', x: tg.x, y: tg.y, s: '회피', k: 'dodge', from: src ? src.id : 0, to: tg.id }); return 0; } }
  if (src && src.kind === 'hero' && src.team === 1 && src.ctl === 'ai') a *= DIFF[G.diff].dmg;
  if (tg.kind === 'monster' && src && src.spells && src.spells.F === 'smite') a *= 1.35; // 정글러는 몬스터에게 더 강함
  if (src && src.kind === 'monster' && tg.kind === 'hero' && tg.spells && tg.spells.F === 'smite') a *= .6;
  if (type !== 't') a *= 100 / (100 + Math.max(0, defOf(tg)));
  if (!tg.mobile && G.mode === 'rift' && G.t > DECAY_T) a *= 1 + (G.t - DECAY_T) / 75; // 협곡 10분부터 구조물이 점점 약해짐 (15분 안에 끝나도록)
  if (type === 'bleed') type = 'p';
  if (type === 'crit') type = 'c';
  for (const b of tg.buffs) if (b.type === 'dr') a *= 1 - b.v;
  const shown = a;
  for (const s of tg.shields) { if (a <= 0) break; const k = Math.min(s.a, a); s.a -= k; a -= k; }
  if (tg.shields.length) tg.shields = tg.shields.filter(s => s.a > .5);
  tg.hp -= a; tg.lastDmgT = G.t; tg.hurtT = G.t;
  if (src && src.kind === 'hero') src.lastAtkAny = G.t;
  if (tg.kind === 'hero' && tg.recall && src) tg.recall = null; // 맞으면 귀환 취소
  if (tg.kind === 'monster' && src && src.kind === 'hero') { tg.camp.aggro = src; tg.camp.aggT = G.t; }
  if (src && tg.mobile && src.team !== tg.team) { tg.atkBy = src; tg.atkByT = G.t; } // 미니언 도움 요청용
  if (src && src.kind === 'hero' && tg.kind === 'hero') {
    G.stats[auto ? 'auto' : 'abil'] += shown;
    tg.lastHitBy[src.id] = G.t; src.lastDmgT = G.t;
    for (const tw of G.units) if (tw.kind === 'tower' && !tw.dead && tw.team === tg.team && Math.hypot(tw.x - src.x, tw.y - src.y) < tw.range + src.r) tw.aggro = { u: src, t: 2.5 };
  }
  if (shown >= 1 && ((src && src.ctl && src.ctl !== 'ai') || (tg.ctl && tg.ctl !== 'ai'))) ev({ t: 'text', x: tg.x, y: tg.y, s: Math.round(shown), k: type, from: src ? src.id : 0, to: tg.id });
  if (tg.hp <= 0) kill(tg, src);
  return shown;
}
function addXp(h, a) {
  if (h.level >= 18) return; h.xp += a;
  while (h.level < 18 && h.xp >= need(h.level)) { h.xp -= need(h.level); h.level++; recalc(h); fx('levelup', h.x, h.y, { c: '#fde68a', follow: h.id }); h.pts++; if (h.ctl === 'ai' || h.autoSkill) autoSkill(h); ev({ t: 'lvl', id: h.id, lv: h.level }); }
}
function shareXp(team, x, y, amt) { const hs = G.heroes.filter(h => !h.dead && h.team === team && Math.hypot(h.x - x, h.y - y) < 1600); if (!hs.length) return; const each = amt / hs.length * (hs.length > 1 ? 1.25 : 1); for (const h of hs) addXp(h, each); }
function kill(u, src) {
  if (u.dead) return; u.dead = true; u.hp = 0; u.deadT = G.t;
  if (u.kind === 'minion') { if (src && src.kind === 'hero') { src.gold += u.gold; src.cs++; if (src.ctl !== 'ai') ev({ t: 'gold', x: u.x, y: u.y, s: '+' + u.gold + 'G', to: src.id }); } shareXp(1 - u.team, u.x, u.y, u.xp); fx('death', u.x, u.y, { c: TEAMC[u.team], small: 1 }); return; }
  if (u.kind === 'monster') {
    const c = u.camp; let k = src && src.kind === 'hero' ? src : c.aggro && !c.aggro.dead ? c.aggro : null;
    if (k) {
      k.gold += u.gold; k.cs++; addXp(k, u.xp); if (k.spells.F === 'smite') heal(k, 35 + k.level * 6 + k.maxHp * .03, true);
      if (k.ctl !== 'ai') ev({ t: 'gold', x: u.x, y: u.y, s: '+' + u.gold + 'G', to: k.id });
      if (u.mon === 'blue' || u.mon === 'red') { k.buffs = k.buffs.filter(b => b.type !== u.mon + 'b'); buff(k, u.mon + 'b', 0, 90); fx('aura', k.x, k.y, { c: u.mon === 'blue' ? '#60a5fa' : '#f87171', follow: k.id, dur: 2 }); if (k.team === G.player.team) ev({ t: 'banner', s: `${k.hd.name}: ${u.mon === 'blue' ? '푸른 정령' : '붉은 골렘'} 버프 획득`, c: u.mon === 'blue' ? '#93c5fd' : '#fca5a5', d: 1.8 }); }
    }
    fx('death', u.x, u.y, { c: '#d6a85c', small: u.big ? 0 : 1 });
    if (c.units.every(m => m.dead)) { c.up = false; c.t = c.type === 'blue' || c.type === 'red' ? 100 : 75; c.aggro = null; }
    return;
  }
  if (u.kind === 'hero') {
    u.d++; u.respawnT = G.mode === 'rift' ? Math.min(32, 6 + u.level * 1.5 + G.t / 60 * .6) : Math.min(28, 5 + u.level * 1.4); u.recall = null; u.bleed = null; u.wind = null; u.pend = null; u.target = null; u.moveTo = null; u.dash = null; u.buffs = []; u.shields = []; u.mark = null;
    let killer = src && src.kind === 'hero' ? src : null;
    if (!killer) { let bt = -1; for (const h of G.heroes) if (h.team !== u.team && u.lastHitBy[h.id] && G.t - u.lastHitBy[h.id] < 10 && u.lastHitBy[h.id] > bt) { bt = u.lastHitBy[h.id]; killer = h; } }
    const assists = G.heroes.filter(h => h !== killer && h.team !== u.team && u.lastHitBy[h.id] && G.t - u.lastHitBy[h.id] < 10);
    G.kills[1 - u.team]++;
    // 1대1은 연속 처치 보상을 줄여 한쪽으로 너무 쏠리지 않게
    const bounty = G.mode === '1v1' ? 250 : 300;
    if (killer) { killer.k++; killer.gold += bounty; for (const a of assists) { a.a++; a.gold += 150; } killer.mk.n = G.t - killer.mk.t < 10 ? killer.mk.n + 1 : 1; killer.mk.t = G.t; }
    shareXp(1 - u.team, u.x, u.y, 100 + u.level * 25);
    const first = !G.first; G.first = true;
    ev({ t: 'kill', killer: killer ? killer.id : 0, victim: u.id, mk: killer ? killer.mk.n : 0, first });
    fx('death', u.x, u.y, { c: TEAMC[u.team] });
    u.lastHitBy = {}; return;
  }
  if (u.kind === 'tower') { for (const h of G.heroes) if (h.team !== u.team) h.gold += 150; ev({ t: 'banner', s: TEAMN[u.team] + '의 포탑이 파괴되었습니다', c: TEAMC[1 - u.team], d: 2.4 }); fx('collapse', u.x, u.y, { c: TEAMC[u.team], dur: 1.2 }); return; }
  if (u.kind === 'nexus') { fx('collapse', u.x, u.y, { c: TEAMC[u.team], dur: 2, big: 1 }); G.over = true; G.winner = 1 - u.team; ev({ t: 'end', winner: 1 - u.team }); }
}
function respawn(u) { u.dead = false; [u.x, u.y] = spawnPt(u.team); u.nav = null; u.px = u.x; u.py = u.y; u.hp = u.maxHp; u.cc = { stun: 0, root: 0, slows: [] }; u.retreat = false; u.mana = u.maxMana; u.shopOpen = true; u.spawnT = G.t; if (u.ctl === 'ai') aiShop(u); fx('ring', u.x, u.y, { r: 120, c: TEAMC[u.team] }); }
export const SPELLS = {
  flash: { n: '점멸', cd: 176, desc: '짧은 거리를 순간이동합니다.' },
  snow: { n: '눈덩이', cd: 47, desc: '눈덩이를 던져 맞은 적에게 표식을 남깁니다. 다시 누르면 표식 대상에게 돌진합니다.' },
  smite: { n: '강타', cd: 25, desc: '가까운 몬스터나 미니언에게 큰 고정 피해를 주고 체력을 회복합니다. (정글러 전용)' },
  heal: { n: '회복', cd: 150, desc: '자신과 체력이 가장 낮은 주변 아군 한 명을 치유하고 잠시 빨라집니다.' }
};
export const SPELL_CD = { D: 176, F: 47 }; // 예전 코드 호환
export function spellOf(u, k) { return SPELLS[(u.spells && u.spells[k]) || (k === 'D' ? 'flash' : 'snow')]; }
export function smiteDmg(u) { return 390 + u.level * 30; }
function smiteTarget(u, tx, ty) { let best = null, bd = 1e9; for (const e of G.units) { if (e.dead || e.team === u.team || (e.kind !== 'monster' && e.kind !== 'minion')) continue; const d = Math.hypot(e.x - u.x, e.y - u.y) - e.r; if (d > 560) continue; const s = Math.hypot(e.x - tx, e.y - ty) - (e.big ? 150 : 0); if (s < bd) { bd = s; best = e; } } return best; }
export function useSpell(u, k, tx, ty) {
  u.fail = '';
  if (u.dead || u.cc.stun > 0 || u.dash) { u.fail = failWhy(u); return; }
  const sp = u.spells[k], info = SPELLS[sp];
  if (sp === 'snow' && u.mark && u.mark.t > 0 && !u.mark.tgt.dead) { if (u.cc.root > 0) return; const t = u.mark.tgt; u.mark = null; u.spellCd.F = Math.max(0, u.spellCd.F - info.cd * .25); dashTo(u, t.x, t.y, 1900, () => fx('ring', u.x, u.y, { r: 90, c: '#e0f2fe' }), false, t); return; }
  if (u.spellCd[k] > 0) { u.fail = `${info.n} 재사용 대기 중 (${Math.ceil(u.spellCd[k])}초)`; return; }
  if (sp === 'flash') { const [x, y] = clampPt(u, tx, ty, 425); blink(u, x, y); u.recall = null; }
  else if (sp === 'snow') { const [dx, dy] = aimDir(u, tx, ty); proj({ owner: u, x: u.x, y: u.y, dx, dy, speed: 1500, range: 1600, r: 40, color: '#ffffff', kind: 'snow', onHit(t) { dmg(u, t, 20 + u.level * 10, 't'); u.mark = { tgt: t, t: 3 }; } }); }
  else if (sp === 'smite') { const t = smiteTarget(u, tx, ty); if (!t) { u.fail = '강타: 근처에 몬스터/미니언이 없음'; return; } fx('bolt', t.x, t.y, { x2: u.x, y2: u.y, c: '#fde68a' }); fx('ring', t.x, t.y, { r: 90, c: '#fde68a' }); dmg(u, t, smiteDmg(u), 't', true); heal(u, 70 + u.maxHp * .08); }
  else if (sp === 'heal') { const amt = 90 + u.level * 15; heal(u, amt); buff(u, 'ms', .3, 1); fx('heal', u.x, u.y, { c: '#86efac' }); const as = alliesIn(u.team, u.x, u.y, 850).filter(a => a !== u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp); if (as[0]) { heal(as[0], amt); buff(as[0], 'ms', .3, 1); fx('heal', as[0].x, as[0].y, { c: '#86efac' }); } }
  u.spellCd[k] = info.cd;
}
function failWhy(u) { return u.dead ? '사망 중' : u.cc.stun > 0 ? '기절 상태' : u.dash ? '이동 중' : ''; }
export function tryCast(u, i, tx, ty) {
  u.fail = '';
  if (u.dead || u.cc.stun > 0 || u.dash) { u.fail = failWhy(u); return false; }
  if (u.rank[i] <= 0) { u.fail = i === 3 && u.level < 6 ? '궁극기는 6레벨부터' : '아직 배우지 않은 스킬 (Shift+키 또는 + 버튼)'; return false; }
  if (u.cds[i] > 0) { u.fail = `재사용 대기 중 (${u.cds[i].toFixed(1)}초)`; return false; }
  const cost = costOf(u, i); if (cost > u.mana) { u.fail = `마나 부족 (${cost} 필요)`; return false; }
  const ab = u.hd.ab[i]; u.curRankL = rankLevel(u, i); const ok = ab.cast(u, tx, ty); u.curRankL = undefined;
  if (ok !== false) u.recall = null;
  if (ok === false) { u.fail = u.cc.root > 0 ? '속박 중에는 쓸 수 없음' : '사거리 안에 대상이 없음'; return false; }
  u.mana -= cost; u.cds[i] = cdOf(u, i); u.castT = G.t; u.castI = i;
  if (!SELF_T.includes(ab.ai.t)) u.face = Math.atan2(ty - u.y, tx - u.x);
  return true;
}

/* ================= 명령 (로컬 입력 / 원격 입력 공용) ================= */
export function inBase(u) { return G.map.inBase(u.team, u.x, u.y); }
export function canShop(u) { return u.dead || (G.mode === 'rift' ? inBase(u) : u.shopOpen); }
export const RECALL_T = 6;
export function cmd(h, c) {
  if (!h || G.over) return;
  switch (c.c) {
    case 'recall': if (h.dead || G.mode !== 'rift' || h.recall || h.dash || h.cc.stun > 0) return; cancelWind(h); h.pend = null; h.target = null; h.moveTo = null; h.recall = { t: RECALL_T }; break;
    case 'move': if (h.dead) return; h.recall = null; cancelWind(h); h.pend = null; h.target = null; { const [mx, my] = G.map.clampPt(c.x, c.y, h.r); h.moveTo = { x: mx, y: my }; } h.nav = null; h.amove = false; break;
    case 'atk': { if (h.dead) return; h.recall = null; const t = G.units.find(u => u.id === c.id); if (targetable(h, t)) { if (h.target !== t) cancelWind(h); h.pend = null; h.target = t; h.moveTo = null; h.amove = false; } break; }
    case 'amove': if (h.dead) return; h.recall = null; cancelWind(h); h.pend = null; { const [mx, my] = G.map.clampPt(c.x, c.y, h.r); h.moveTo = { x: mx, y: my }; } h.nav = null; h.amove = true; h.target = null; break;
    case 'lvl': levelSkill(h, c.i); break;
    case 'stop': cancelWind(h); h.pend = null; h.target = null; h.moveTo = null; h.amove = false; break;
    case 'cast': {
      h.castTid = c.tid || 0;
      const ab = h.hd.ab[c.i], tt = ab.ai.t;
      if ((tt === 'target' || tt === 'exec') && c.tid && h.cds[c.i] <= 0 && !(c.i === 3 && h.level < 6)) {
        const t = G.units.find(e => e.id === c.tid);
        if (t && targetable(h, t) && Math.hypot(t.x - h.x, t.y - h.y) > ab.ai.range + t.hr) { cancelWind(h); h.pend = { i: c.i, tid: c.tid }; h.target = null; h.moveTo = null; break; }
      }
      if (tryCast(h, c.i, c.x, c.y)) { h.pend = null; if (!SELF_T.includes(tt)) cancelWind(h); } else if (h.fail) ev({ t: 'fail', to: h.id, s: h.hd.ab[c.i].n + ': ' + h.fail });
      h.castTid = 0; break;
    }
    case 'spell': useSpell(h, c.k, c.x, c.y); if (h.fail) ev({ t: 'fail', to: h.id, s: h.fail }); break;
    case 'buy': { const it = ITEMS[c.id]; if (!it || !canShop(h) || h.items.includes(c.id) || h.gold < it.c || h.items.length >= 6) return; h.gold -= it.c; h.items.push(c.id); recalc(h); break; }
    case 'sell': { if (!canShop(h)) return; const id = h.items[c.i]; if (!id) return; h.gold += Math.floor(ITEMS[id].c * .7); h.items.splice(c.i, 1); recalc(h); break; }
  }
}

/* ================= AI ================= */
function aiShop(u) { const B = G.mode === 'rift' ? [STARTER[u.hd.role], ...BUILDS[u.hd.role]] : BUILDS[u.hd.role]; for (const id of B) { if (u.items.includes(id)) continue; if (u.items.length >= 6) break; const c = ITEMS[id].c; if (u.gold >= c) { u.gold -= c; u.items.push(id); } else break; } recalc(u); }
/* ---- 미니언 AI: 롤 미니언 규칙을 따름 ----
   - 0.25초마다 주변을 훑어 대상을 고름 (획득 범위 500)
   - 우선순위: ① 아군 영웅을 공격한 적 영웅(도움 요청, 1000 범위) ② 아군 영웅을 공격한 적 미니언
     ③ 아군 미니언을 공격한 적 미니언 ④ 아군 미니언을 공격한 적 포탑 ⑤ 가장 가까운 적 미니언
     ⑥ 가장 가까운 적 영웅 ⑦ 구조물
   - 지금 대상보다 순위가 "높을 때만" 바꿈 (같은 순위면 하던 대상 계속)
   - 대상이 획득 범위 밖으로 멀리 벗어나거나, 4초 동안 한 번도 못 때리거나, 영웅을 잡은 자리에서 600 넘게 끌려가면 포기 → 라인으로 복귀
   - 포탑을 치는 중이면 영웅끼리 싸우는 도움 요청은 무시 */
const M_ACQ = 500, M_HELP = 1000, M_LEASH = 700, M_GIVEUP = 4, M_CHASE = 600;
function minionSweep(u) {
  const now = G.t; let best = null, bc = 99, bd = 1e9;
  const consider = (e, c) => {
    if (!targetable(u, e) || (u.ign && u.ign[e.id] > now)) return;
    const d = dist(u, e); if (c < bc || (c === bc && d < bd)) { bc = c; bd = d; best = e; }
  };
  const onTower = u.target && !u.target.mobile && !u.target.dead;
  for (const a of G.units) { // 도움 요청: 최근 0.5초 안에 공격받은 아군
    if (a.dead || a.team !== u.team || !a.mobile || a === u || !a.atkBy || now - a.atkByT > .5) continue;
    const att = a.atkBy; if (!att || att.dead || att.team === u.team) continue;
    const dv = dist(u, a);
    if (a.kind === 'hero') {
      if (att.kind === 'hero') { if (!onTower && dv < M_HELP && dist(u, att) < M_HELP) consider(att, 1); }
      else if (att.kind === 'minion' && dv < M_ACQ) consider(att, 2);
    } else if (dv < M_ACQ) { if (att.kind === 'minion') consider(att, 3); else if (att.kind === 'tower') consider(att, 4); }
  }
  for (const e of G.units) { // 평소 탐색
    if (e.dead || e.team === u.team || e.team === 2) continue; if (dist(u, e) - e.r > M_ACQ) continue;
    consider(e, e.kind === 'minion' ? 5 : e.kind === 'hero' ? 6 : 7);
  }
  return [best, bc];
}
function aiMinion(u, dt) {
  const now = G.t;
  if (u.target) {
    const t = u.target; let ok = targetable(u, t) && !(u.ign && u.ign[t.id] > now);
    if (ok && dist(u, t) - t.r > M_LEASH) ok = false; // 멀리 달아남
    if (ok && t.kind === 'hero' && Math.hypot(u.x - u.ax, u.y - u.ay) > M_CHASE) { (u.ign || (u.ign = {}))[t.id] = now + 3; ok = false; } // 영웅을 잡은 자리에서 너무 멀리 끌려감 (롤의 금지 구역 대신)
    if (ok && now - Math.max(u.acqT || 0, u.lastAtkT || -9) > M_GIVEUP) { (u.ign || (u.ign = {}))[t.id] = now + 4; ok = false; } // 4초간 못 때림
    if (!ok) { u.target = null; u.tc = 99; u.aiT = 0; }
  }
  u.aiT -= dt;
  if (u.aiT <= 0) {
    u.aiT = .25; const [b, c] = minionSweep(u);
    if (b && (!u.target || c < u.tc)) { if (b !== u.target) { u.target = b; u.acqT = now; u.ax = u.x; u.ay = u.y; } u.tc = c; }
  }
  if (u.target) doAttack(u, dt);
  else { // 라인을 따라 전진
    const L = G.map.lanes[u.lane], dir = u.team ? -1 : 1, pr = laneProj(L, u.x, u.y), p = lanePt(L, pr.s + dir * 260);
    const tx = p.x - p.dy * u.laneOff, ty = p.y + p.dx * u.laneOff; u.face = Math.atan2(ty - u.y, tx - u.x);
    if (pr.d > 250) navMove(u, tx, ty, dt); else moveToward(u, tx, ty, dt);
  }
}
function aiTower(u, dt) {
  u.ad = 170 + G.t / 60 * 8;
  const inR = e => e && !e.dead && e.team !== u.team && Math.hypot(e.x - u.x, e.y - u.y) < u.range + e.r;
  if (u.aggro) { u.aggro.t -= dt; if (u.aggro.t <= 0) u.aggro = null; }
  if (u.aggro && inR(u.aggro.u)) u.target = u.aggro.u;
  else if (!inR(u.target)) { u.target = null; let bd = 1e9; for (const e of G.units) { if (!e.mobile || !inR(e)) continue; const d = Math.hypot(e.x - u.x, e.y - u.y) + (e.kind === 'hero' ? 5000 : 0); if (d < bd) { bd = d; u.target = e; } } }
  if (u.target && u.atkCd <= 0) startAttack(u, u.target);
}
function frontS(team, lane) { const L = G.map.lanes[lane], dir = team ? -1 : 1; let best = null; for (const m of G.units) { if (m.kind !== 'minion' || m.dead || m.team !== team || m.lane !== lane) continue; const sv = laneProj(L, m.x, m.y).s; if (best === null || sv * dir > best * dir) best = sv; } return best; }
function towerTanked(tw, team) { return G.units.some(m => m.kind === 'minion' && !m.dead && m.team === team && Math.hypot(m.x - tw.x, m.y - tw.y) < tw.range - 40); }
// 우리 팀이 이 라인에서 가장 앞에 가진 살아 있는 구조물의 라인 위치
function ownFrontS(team, lane) { const dir = team ? -1 : 1; let best = null; for (const t of Object.values(G.struct[team])) { if (t.dead || t.lpos[lane] === undefined) continue; if (best === null || t.lpos[lane] * dir > best * dir) best = t.lpos[lane]; } return best ?? (team ? G.map.lanes[lane].len : 0); }
function laneSpot(u, lane) {
  lane = lane || u.lane || 'mid'; const L = G.map.lanes[lane], dir = u.team ? -1 : 1; let fs = frontS(u.team, lane);
  if (fs === null) fs = ownFrontS(u.team, lane) + dir * 450;
  let sv = fs - dir * (u.range < 300 ? 60 : 230);
  for (const tw of Object.values(G.struct[1 - u.team])) { if (tw.kind !== 'tower' || tw.dead || tw.lpos[lane] === undefined) continue; const edge = tw.lpos[lane] - dir * (tw.range + 80); if ((sv - edge) * dir > 0 && !towerTanked(tw, u.team)) sv = edge; }
  const p = lanePt(L, sv); return { x: p.x - p.dy * u.yOff, y: p.y + p.dx * u.yOff };
}
function retreatSpot(u) {
  if (G.mode === 'rift') { const f = G.map.fountain[u.team]; return { x: f.x, y: f.y }; }
  const lane = u.lane || 'mid', L = G.map.lanes[lane], dir = u.team ? -1 : 1, p = lanePt(L, ownFrontS(u.team, lane) - dir * 260);
  return { x: p.x - p.dy * u.yOff * .5, y: p.y + p.dx * u.yOff * .5 };
}
function predict(u, t, a, D) { const d = dist(u, t); const tm = (a.speed ? d / a.speed : 0) + (a.delay || 0); return [t.x + t.vx * tm * D.acc + rand(-D.err, D.err), t.y + t.vy * tm * D.acc + rand(-D.err, D.err)]; }
function minionCluster(u, range, r) { const ms = G.units.filter(e => e.kind === 'minion' && !e.dead && e.team !== u.team && dist(u, e) < range); let best = null; for (const m of ms) { let n = 0; for (const o of ms) if (dist(m, o) < r) n++; if (!best || n > best.n) best = { n, x: m.x, y: m.y }; } return best; }
function dodgeVec(u) {
  for (const p of G.projs) { if (p.homing || p.owner.team === u.team) continue; const rx = u.x - p.x, ry = u.y - p.y; const along = rx * p.dx + ry * p.dy; if (along < 0 || along > 650) continue; const perp = rx * -p.dy + ry * p.dx; if (Math.abs(perp) < p.r + u.hr + 10) { const s = perp >= 0 ? 1 : -1; return [-p.dy * s, p.dx * s]; } }
  for (const z of G.zones) { if (z.fired || z.line || z.owner.team === u.team) continue; const d = Math.hypot(u.x - z.x, u.y - z.y); if (d < z.r + u.r) return norm(u.x - z.x, u.y - z.y); }
  return null;
}
function aiAbilities(u, D, t, mode) {
  const abs = u.hd.ab;
  for (let i = 0; i < 4; i++) {
    if (u.cds[i] > 0 || u.rank[i] <= 0 || costOf(u, i) > u.mana) continue;
    const a = abs[i].ai; let c = false; const d = t && !t.dead ? dist(u, t) : 1e9;
    switch (a.t) {
      case 'shot': case 'line': case 'global': case 'aoe': {
        const rng = a.t === 'aoe' ? a.range + a.r * .5 : a.range * .92;
        const ok = a.t === 'global' ? (d < a.range && (t.hp / t.maxHp < .5 || d < 1400)) : d < rng;
        if (ok && !(mode === 'flee' && a.t !== 'aoe' && a.t !== 'shot')) { const [px, py] = predict(u, t, a, D); c = tryCast(u, i, px, py); }
        if (!c && a.wc && mode !== 'flee' && d > 1300 && Math.random() < .3) { const cl = minionCluster(u, a.t === 'aoe' ? a.range : a.range * .8, a.r || 160); if (cl && cl.n >= 3) c = tryCast(u, i, cl.x, cl.y); }
        break;
      }
      case 'self': if (t && d < a.r + t.r * .5) c = tryCast(u, i, u.x, u.y); else if (a.wc && mode !== 'flee' && d > 1300) { if (enemiesIn(u.team, u.x, u.y, a.r).filter(e => e.kind === 'minion').length >= 3) c = tryCast(u, i, u.x, u.y); } break;
      case 'heal': if (alliesIn(u.team, u.x, u.y, a.range).some(x => x.hp / x.maxHp < a.th)) c = tryCast(u, i, u.x, u.y); break;
      case 'shieldAura': if (d < 900 && alliesIn(u.team, u.x, u.y, a.r).some(x => x.hp / x.maxHp < .85 && G.t - (x.lastDmgT || -99) < 1.5)) c = tryCast(u, i, u.x, u.y); break;
      case 'engage': if (mode === 'fight' && d < a.r && d > u.range + 80) c = tryCast(u, i, u.x, u.y); else if (mode === 'flee' && d < 700) c = tryCast(u, i, u.x, u.y); break;
      case 'dr': if (d < 650 && u.hp / u.maxHp < .7) c = tryCast(u, i, u.x, u.y); break;
      case 'dash': { const [hx, hy] = homeDir(u); if (mode === 'flee' && d < 600) c = tryCast(u, i, u.x + hx * 500 + rand(-120, 120), u.y + hy * 500 + rand(-120, 120)); else if (mode === 'fight' && t && t.hp / t.maxHp < .3 && d > u.range + 100 && d < u.range + a.range) c = tryCast(u, i, t.x, t.y); break; }
      case 'target': if (mode === 'fight' && t && d < a.range + t.r) c = tryCast(u, i, t.x, t.y); break;
      case 'exec': { let est = 0; if (t && d < a.range + t.r) withRank(u, rankLevel(u, i), () => { est = abs[i].est(u, t); }); if (est >= (t ? t.hp : 1e9) * .95) c = tryCast(u, i, t.x, t.y); break; }
      case 'empower': if (u.target && u.target.kind === 'hero' && inRange(u, u.target, 60) && mode !== 'flee') c = tryCast(u, i, u.x, u.y); break;
      case 'counter': if (t && d < 380 + (t.range > 300 ? 0 : 120)) c = tryCast(u, i, u.x, u.y); break;
      case 'buffFight': if (mode === 'fight' && t && d < 550) c = tryCast(u, i, u.x, u.y); break;
      case 'ring': if (t && d > 170 && d < a.r + t.hr * .3) c = tryCast(u, i, u.x, u.y); else if (mode !== 'flee' && enemiesIn(u.team, u.x, u.y, a.r).filter(e => e.kind === 'minion').length >= 4 && Math.random() < .2) c = tryCast(u, i, u.x, u.y); break;
      case 'cone': if (t && mode !== 'flee' && d > 200 && d < a.range + t.hr * .5) c = tryCast(u, i, t.x, t.y); break;
    }
  }
}
function aiHero(u, dt) {
  const D = u.team === 1 ? DIFF[G.diff] : DIFF[1];
  u.aiT -= dt; if (u.aiT <= 0) { u.aiT = D.react * rand(.8, 1.2); aiDecide(u, D); }
  if (u.recall) return;
  if (u.target) { if (!targetable(u, u.target)) u.target = null; else { doAttack(u, dt); return; } }
  if (u.wind) return;
  if (u.moveTo && navMove(u, u.moveTo.x, u.moveTo.y, dt)) u.moveTo = null;
}
function nextItemCost(u) { const B = G.mode === 'rift' ? [STARTER[u.hd.role], ...BUILDS[u.hd.role]] : BUILDS[u.hd.role]; const id = B.find(i => !u.items.includes(i)); return id && u.items.length < 6 ? ITEMS[id].c : 1e9; }
export const DECAY_T = 600;
const GROUP_T = 480; // 협곡: 8분부터 AI가 미드로 뭉쳐서 밀기 시작
function aiDecide(u, D) {
  const hp = u.hp / u.maxHp, rift = G.mode === 'rift', [hx, hy] = homeDir(u);
  const enemies = heroesAlive(1 - u.team);
  let eh = null, ehd = 1e9; for (const e of enemies) { const d = dist(u, e); if (d < ehd) { ehd = d; eh = e; } }
  if (u.recall) { if (ehd < 900) u.recall = null; else return; }
  const group = rift && G.t > GROUP_T;
  if (rift) {
    u.lane = group ? 'mid' : u.pos === 'top' ? 'top' : u.pos === 'bot' || u.pos === 'sup' ? 'bot' : u.pos === 'jungle' ? null : 'mid';
    if (inBase(u)) { // 기지: 쇼핑하고, 체력·마나가 차면 출발
      aiShop(u);
      if ((hp < .85 || (u.maxMana && u.mana / u.maxMana < .6)) && ehd > 900) { u.retreat = false; u.target = null; const f = G.map.fountain[u.team]; u.moveTo = Math.hypot(u.x - f.x, u.y - f.y) > 250 ? { x: f.x, y: f.y } : null; return; }
      u.retreat = false;
    }
  }
  const etw = G.units.filter(s => s.kind === 'tower' && s.team !== u.team && !s.dead);
  const inTw = (x, y, pad) => etw.find(s => Math.hypot(s.x - x, s.y - y) < s.range + (pad || 0));
  if (D.dodge > 0 && Math.random() < D.dodge) { const dv = dodgeVec(u); if (dv) { u.moveTo = { x: u.x + dv[0] * 180, y: u.y + dv[1] * 180 }; u.target = null; return; } }
  if ((hp < .3 && ehd < 1100) || hp < .18) u.retreat = true;
  u.retreatT = u.retreat ? (u.retreatT || 0) + D.react : 0;
  if (u.retreat && !rift && (hp > .5 || (u.retreatT > 15 && hp > .3))) u.retreat = false;
  if (u.retreat) {
    if (u.spells.F === 'heal' && u.spellCd.F <= 0 && hp < .25 && ehd < 900) useSpell(u, 'F', u.x, u.y);
    if (eh && ehd < 480 && hp < .22 && u.spellCd.D <= 0 && G.diff + (u.team ? 0 : 1) > 0 && Math.random() < .6) useSpell(u, 'D', u.x + hx * 500, u.y + hy * 500);
    if (eh) aiAbilities(u, D, eh, 'flee');
    if (rift && ehd > 1300 && !inBase(u)) { cmd(u, { c: 'recall' }); return; }
    let rel = null; for (const r of G.relics) if (r.on && Math.hypot(r.x - u.x, r.y - u.y) < 900 && (!eh || Math.hypot(r.x - eh.x, r.y - eh.y) > 500)) { rel = r; break; }
    u.moveTo = rel ? { x: rel.x, y: rel.y } : retreatSpot(u);
    u.target = null; return;
  }
  // 협곡: 체력·마나가 부족하거나 돈이 모이면 안전할 때 귀환
  if (rift && !inBase(u) && ehd > 1500 && !G.units.some(m => m.target === u && !m.dead)) {
    const want = hp < .3 || (u.maxMana && u.mana < u.maxMana * .15) || (u.gold >= nextItemCost(u) && u.gold >= 1000 && hp < .8) || u.gold >= 2400;
    if (want && !(u.pos === 'sup' && G.heroes.some(h => h.team === u.team && h.pos === 'bot' && !h.dead && !h.recall && dist(h, u) < 900 && h.hp / h.maxHp > .5) && hp > .3)) { cmd(u, { c: 'recall' }); return; }
  }
  const myTw = etw.find(s => s.target === u);
  let tgt = null, best = 1e9;
  for (const e of enemies) { const d = dist(u, e); if (d > u.range + u.r + e.r + 450) continue; const dive = e.hp / e.maxHp < .25 && hp > .5; if (inTw(e.x, e.y, 50) && !dive) continue; const sc = d * .5 + e.hp * .6; if (sc < best) { best = sc; tgt = e; } }
  let aggressive = false;
  if (tgt) {
    // 전투력 = 근처 영웅 체력 + 근처 미니언 (적 미니언 사이에서 싸우면 도움 요청으로 집중 공격받음)
    const minionW = 90 + G.t / 60 * 12;
    const pw = team => G.heroes.filter(h => !h.dead && h.team === team && dist(h, tgt) < 1100).reduce((s, h) => s + h.hp + h.level * 40, 0)
      + G.units.filter(m => m.kind === 'minion' && !m.dead && m.team === team && dist(m, team === u.team ? u : tgt) < 650).length * minionW;
    aggressive = pw(u.team) * (u.team === 1 ? D.agg : 1) * (u.gank ? 1.15 : 1) >= pw(tgt.team) * .85 || (tgt.hp / tgt.maxHp < .3 && hp > .35);
  }
  if (myTw && !(tgt && tgt.hp / tgt.maxHp < .2)) { u.target = null; const [ax, ay] = norm(u.x - myTw.x, u.y - myTw.y); u.moveTo = { x: myTw.x + ax * (myTw.range + 150), y: myTw.y + ay * (myTw.range + 150) }; if (eh) aiAbilities(u, D, eh, 'poke'); return; }
  aiAbilities(u, D, tgt || eh, tgt && aggressive ? 'fight' : 'poke');
  if (tgt && aggressive) { if (u.spells.F === 'heal' && u.spellCd.F <= 0 && hp < .2) useSpell(u, 'F', u.x, u.y); u.target = tgt; u.moveTo = null; return; }
  // 정글러: 갱킹 → 캠프 사냥
  if (rift && u.pos === 'jungle' && !group) { if (aiJungle(u, D, enemies, hp)) return; }
  if (rift && u.pos === 'sup') { // 서포터: 원딜 옆에 붙어 다님 (미니언 막타는 양보)
    const adc = G.heroes.find(h => h.team === u.team && h.pos === 'bot' && !h.dead && !h.recall && !inBase(h));
    if (adc) { u.target = null; const [x, y] = G.map.clampPt(adc.x + hx * 170 - hy * 120, adc.y + hy * 170 + hx * 120, u.r); u.moveTo = { x, y }; return; }
  }
  const reach = u.range + u.r + 300; let m = null, md = 1e9;
  for (const e of G.units) { if (e.dead || e.team === u.team || e.kind !== 'minion') continue; const d = dist(u, e); if (d > reach) continue; const tw = inTw(e.x, e.y, -30); if (tw && !towerTanked(tw, u.team)) continue; const sc = d + e.hp * 1.2; if (sc < md) { md = sc; m = e; } }
  if (m) { u.target = m; u.moveTo = null; return; }
  for (const s of G.units) {
    if (s.mobile || s.dead || s.team === u.team || !canHitStructure(s)) continue; if (dist(u, s) > 1400) continue;
    const safe = s.kind === 'nexus' || towerTanked(s, u.team) || (s.target && s.target.kind === 'minion');
    if (safe && !enemies.some(e => dist(e, s) < 700)) { u.target = s; u.moveTo = null; return; }
  }
  u.target = null; u.moveTo = laneSpot(u, u.lane || 'mid');
}
function aiJungle(u, D, enemies, hp) {
  // 갱킹: 체력이 낮거나 우리 쪽으로 깊이 들어온 적 라이너를 노림
  if (u.gank && (G.t > u.gank.until || u.gank.tgt.dead || inBase(u.gank.tgt) || hp < .4)) { u.gank = null; u.lastGank = G.t; }
  if (!u.gank && G.t > 140 && G.t - (u.lastGank || 0) > 40 && u.level >= 3 && hp > .6) {
    let best = null, bs = 1e9;
    for (const e of enemies) { if (e.pos === 'jungle' || inBase(e)) continue; const d = dist(u, e); if (d > 3200) continue; const own = Math.hypot(e.x - G.map.fountain[u.team].x, e.y - G.map.fountain[u.team].y), their = Math.hypot(e.x - G.map.fountain[e.team].x, e.y - G.map.fountain[e.team].y); const sc = d + e.hp / e.maxHp * 1500 - (own < their ? 900 : 0); if (sc < bs) { bs = sc; best = e; } }
    if (best && bs < 2600 && Math.random() < .5) u.gank = { tgt: best, until: G.t + 22 }; else u.lastGank = G.t - 25;
  }
  if (u.gank) { const t = u.gank.tgt; u.target = null; u.moveTo = { x: t.x, y: t.y }; return true; }
  // 캠프 고르기: 지금 잡던 캠프 → 가장 가까운 캠프 (상대 정글은 5분부터)
  let c = u.camp && u.camp.up ? u.camp : null;
  if (!c) { let bs = 1e9; for (const k of G.camps) { if (!k.up) continue; if (k.side !== u.team && G.t < 300) continue; const sc = Math.hypot(k.x - u.x, k.y - u.y) + (k.side !== u.team ? 1800 : 0); if (sc < bs) { bs = sc; c = k; } } u.camp = c; }
  if (!c) return false;
  if (enemies.some(e => Math.hypot(e.x - c.x, e.y - c.y) < 900 && e.hp > u.hp * 1.2)) { u.camp = null; return false; }
  const mons = c.units.filter(m => !m.dead);
  if (Math.hypot(u.x - c.x, u.y - c.y) < 700 && mons.length) {
    const big = mons.find(m => m.big);
    if (big && u.spellCd.F <= 0 && big.hp <= smiteDmg(u) * 1.0 && dist(u, big) < 520) useSpell(u, 'F', big.x, big.y);
    const t = mons.sort((a, b) => a.hp - b.hp)[0]; u.target = t; u.moveTo = null;
    // 스킬로 사냥 속도 올리기
    for (let i = 0; i < 3; i++) { const a = u.hd.ab[i].ai; if (u.cds[i] > 0 || u.rank[i] <= 0 || costOf(u, i) > u.mana * .7) continue; if (['self', 'ring', 'empower', 'target', 'aoe', 'shot', 'cone', 'buffFight'].includes(a.t) && dist(u, t) < (a.range || a.r || 300)) tryCast(u, i, t.x, t.y); }
    return true;
  }
  u.target = null; u.moveTo = { x: c.x, y: c.y + 120 }; return true;
}
function aiMonster(u, dt) {
  const c = u.camp, h = u.home, dh = Math.hypot(u.x - h.x, u.y - h.y);
  if (u.reset) { u.target = null; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .3 * dt); if (moveToward(u, h.x, h.y, dt * 2)) { u.reset = false; u.hp = u.maxHp; u.face = Math.PI / 2; } return; }
  const a = c.aggro;
  if (a && (a.dead || Math.hypot(a.x - h.x, a.y - h.y) > 850 || (G.t - c.aggT > 6 && !inRange(u, a, 30)))) { c.aggro = null; for (const m of c.units) if (!m.dead) { m.reset = true; m.target = null; } return; }
  if (c.aggro) { u.target = c.aggro; doAttack(u, dt); return; }
  if (dh > 20) moveToward(u, h.x, h.y, dt); else if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .1 * dt);
}

/* ================= 사람이 조작하는 영웅 ================= */
function nearestEnemy(u, r, noMon) { let best = null, bd = 1e9; for (const e of G.units) { if (!targetable(u, e) || (noMon && e.kind === 'monster')) continue; const d = Math.hypot(e.x - u.x, e.y - u.y) - e.r; if (d < r && d < bd) { bd = d; best = e; } } return best; }
function humanCtl(u, dt) {
  if (u.pend) { // 대상 지정 스킬: 사거리 안으로 걸어간 뒤 시전
    const t = G.units.find(e => e.id === u.pend.tid), ab = u.hd.ab[u.pend.i];
    if (!t || !targetable(u, t) || u.cds[u.pend.i] > 0) u.pend = null;
    else if (Math.hypot(t.x - u.x, t.y - u.y) <= ab.ai.range + t.hr) { u.castTid = t.id; tryCast(u, u.pend.i, t.x, t.y); u.castTid = 0; u.pend = null; u.target = t; }
    else { navMove(u, t.x, t.y, dt); return; }
  }
  if (u.recall) return;
  if (u.target && !targetable(u, u.target)) u.target = null;
  if (u.target) { doAttack(u, dt); return; }
  if (u.moveTo) {
    if (u.amove) { const e = nearestEnemy(u, u.range + u.r + 150); if (e) { u.target = e; u.moveTo = null; u.amove = false; doAttack(u, dt); return; } }
    u.face = Math.atan2(u.moveTo.y - u.y, u.moveTo.x - u.x);
    if (navMove(u, u.moveTo.x, u.moveTo.y, dt)) { u.moveTo = null; u.amove = false; } return;
  }
  if (u.wind) return; const e = nearestEnemy(u, u.range + u.r * .5, true); if (e && inRange(u, e) && u.atkCd <= 0 && u.cc.stun <= 0) startAttack(u, e);
}

/* ================= 업데이트 ================= */
function tickStatus(u, dt) {
  u.atkCd -= dt; const c = u.cc; c.stun = Math.max(0, c.stun - dt); c.root = Math.max(0, c.root - dt);
  if (u.airT) u.airT = Math.max(0, u.airT - dt);
  if (c.slows.length) { for (const s of c.slows) s.t -= dt; c.slows = c.slows.filter(s => s.t > 0); }
  if (u.shields.length) { for (const s of u.shields) s.t -= dt; u.shields = u.shields.filter(s => s.t > 0 && s.a > 0); }
  if (u.buffs.length) { for (const b of u.buffs) { b.t -= dt; if (b.type === 'spin') { b.tick -= dt; if (b.tick <= 0) { b.tick += b.int; for (const t of enemiesIn(u.team, u.x, u.y, b.r)) withRank(u, b.rl, () => dmg(u, t, b.dmgF(), 'p')); if (u.dead) return; } } } const ended = u.buffs.filter(b => b.t <= 0); u.buffs = u.buffs.filter(b => b.t > 0); for (const b of ended) if (b.onEnd) withRank(u, b.rl, () => b.onEnd(b)); }
  if (u.bleed) { const bl = u.bleed; bl.t -= dt; bl.tick -= dt; if (bl.tick <= 0) { bl.tick += 1; const src = bl.src; dmg(src.dead ? null : src, u, (2 + src.level * .7 + AD(src) * .05) * bl.n, 'bleed', true); fx('hit', u.x, u.y, { c: '#e11d48' }); } if (bl.t <= 0 || u.dead) u.bleed = null; }
}
function doDash(u, dt) {
  const d = u.dash;
  if (d.tgt) { if (d.tgt.dead) { u.dash = null; return; } d.x = d.tgt.x; d.y = d.tgt.y; }
  const dx = d.x - u.x, dy = d.y - u.y, dd = Math.hypot(dx, dy), st = d.speed * dt, stop = d.tgt ? u.r + d.tgt.r : 0;
  if (!d.forced) u.face = Math.atan2(dy, dx);
  if (dd - stop <= st) { if (dd > 1) { const k = Math.max(0, (dd - stop) / dd); u.x += dx * k; u.y += dy * k; } u.dash = null; if (d.onEnd) withRank(u, d.rl, d.onEnd); }
  else { u.x += dx / dd * st; u.y += dy / dd * st; }
}
export function update(dt) {
  if (G.over) return;
  G.t += dt;
  if (G.t >= G.nextWave) { spawnWave(); G.nextWave += G.waveInt; }
  if (G.mode === 'rift' && !G.decayMsg && G.t >= DECAY_T) { G.decayMsg = true; ev({ t: 'banner', s: '10분 — 이제부터 포탑과 넥서스가 점점 약해집니다!', c: '#fde68a', d: 3 }); }
  for (const c of G.camps) if (!c.up) { c.t -= dt; if (c.t <= 0) spawnCamp(c); }
  const rift = G.mode === 'rift';
  for (const r of G.relics) { if (!r.on) { r.t -= dt; if (r.t <= 0) r.on = true; } else for (const h of G.heroes) { if (!h.dead && Math.hypot(h.x - r.x, h.y - r.y) < h.r + 40) { for (const a of G.heroes) if (!a.dead && a.team === h.team && Math.hypot(a.x - r.x, a.y - r.y) < 600) { heal(a, a.maxHp * .18); if (a.maxMana) a.mana = Math.min(a.maxMana, a.mana + a.maxMana * .15); } r.on = false; r.t = 40; fx('heal', r.x, r.y, { c: '#86efac' }); break; } } }
  for (const u of G.units) {
    if (u.kind === 'hero') {
      if (u.dead) { u.respawnT -= dt; if (u.respawnT <= 0) respawn(u); continue; }
      if (rift) {
        u.gold += 2.2 * dt; addXp(u, 1.2 * dt);
        const f = G.map.fountain[u.team], atF = Math.hypot(u.x - f.x, u.y - f.y) < 800; // 협곡: 분수대에서 빠르게 회복
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * (atF ? .1 : .004) * dt);
        if (u.maxMana) u.mana = Math.min(u.maxMana, u.mana + (atF ? u.maxMana * .1 : (2.2 + u.level * .3) * (u.buffs.some(b => b.type === 'blueb') ? 2.5 : 1)) * dt);
        if (u.recall) { u.recall.t -= dt; if (u.recall.t <= 0) { u.recall = null; [u.x, u.y] = spawnPt(u.team); u.px = u.x; u.py = u.y; u.nav = null; u.target = null; u.moveTo = null; fx('ring', u.x, u.y, { r: 120, c: TEAMC[u.team] }); if (u.ctl === 'ai') aiShop(u); } }
      } else {
        u.gold += 3.5 * dt; addXp(u, 4.5 * dt);
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .003 * dt); // 칼바람: 기본 체력 재생만 (분수대·비전투 회복 없음)
        if (u.maxMana) u.mana = Math.min(u.maxMana, u.mana + (2 + u.level * .25) * dt);
        if (u.shopOpen && (!inBase(u) || (u.lastDmgT || -99) > u.spawnT)) u.shopOpen = false; // 기지를 떠나거나 맞으면 다음 사망까지 상점 닫힘
      }
      for (let i = 0; i < 4; i++) u.cds[i] = Math.max(0, u.cds[i] - dt);
      u.spellCd.D = Math.max(0, u.spellCd.D - dt); u.spellCd.F = Math.max(0, u.spellCd.F - dt);
      if (u.mark) { u.mark.t -= dt; if (u.mark.t <= 0 || u.mark.tgt.dead) u.mark = null; }
    }
    if (u.dead) continue;
    tickStatus(u, dt); if (u.dead) continue;
    if (u.kind === 'tower') { aiTower(u, dt); continue; }
    if (u.kind === 'nexus') continue;
    u.px = u.x; u.py = u.y;
    if (u.wind) tickWind(u, dt);
    if (u.dash) doDash(u, dt);
    else if (u.cc.stun <= 0) {
      if (u.kind === 'minion') aiMinion(u, dt);
      else if (u.kind === 'monster') aiMonster(u, dt);
      else if (u.ctl === 'ai' || u.autopilot) aiHero(u, dt);
      else humanCtl(u, dt);
    }
  }
  updateProjs(dt); updateZones(dt); physics();
  for (const u of G.units) if (u.mobile && !u.dead && u.px !== undefined) { u.vx = (u.x - u.px) / dt; u.vy = (u.y - u.py) / dt; if (u.vx * u.vx + u.vy * u.vy > 400 && !u.target) u.face = Math.atan2(u.vy, u.vx); }
  for (const h of G.heroes) { if (h.dead) continue; const ef = G.map.fountain[1 - h.team]; if (Math.hypot(h.x - ef.x, h.y - ef.y) < 520) dmg(null, h, 900 * dt, 't'); }
  G.units = G.units.filter(u => !(u.dead && (u.kind === 'minion' || u.kind === 'monster')));
}
function updateProjs(dt) {
  for (const p of G.projs) {
    if (p.homing) { if (p.tgt.dead) { p.done = true; continue; } const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, d = Math.hypot(dx, dy), st = p.speed * dt; if (d <= st + p.tgt.r * .5) { p.done = true; p.cb(); } else { p.x += dx / d * st; p.y += dy / d * st; } continue; }
    const st = p.speed * dt, ox = p.x, oy = p.y; p.x += p.dx * st; p.y += p.dy * st; p.trav += st;
    const hs = p.shared || p.hit;
    for (const e of G.units) { if (e.dead || !e.mobile || e.team === p.owner.team || hs.has(e.id)) continue; if (segDist(e.x, e.y, ox, oy, p.x, p.y) < p.r + e.hr) { hs.add(e.id); withRank(p.owner, p.rl, () => p.onHit(e)); fx('hit', e.x, e.y, { c: p.color }); if (--p.pierce <= 0) { p.done = true; break; } } }
    if (p.trav >= p.range || p.x < -200 || p.x > G.map.W + 200 || p.y < -200 || p.y > G.map.H + 200) p.done = true;
  }
  G.projs = G.projs.filter(p => !p.done);
}
function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = clamp(t, 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
function updateZones(dt) {
  for (const z of G.zones) {
    z.t += dt; if (z.follow) { if (z.follow.dead) { z.fired = true; continue; } z.x = z.follow.x; z.y = z.follow.y; }
    if (z.t >= z.delay) {
      const ts = z.line ? G.units.filter(e => !e.dead && e.mobile && e.team !== z.owner.team && segDist(e.x, e.y, z.x, z.y, z.x2, z.y2) < z.w / 2 + e.hr) : enemiesIn(z.owner.team, z.x, z.y, z.r);
      withRank(z.owner, z.rl, () => z.onTrigger(ts)); z.fired = true;
      if (z.line) fx('beam', z.x, z.y, { x2: z.x2, y2: z.y2, c: z.color, w: z.w, dur: .6 }); else fx(z.vines ? 'vines' : z.axe ? 'axe' : 'burst', z.x, z.y, { r: z.r, c: z.color });
    }
  }
  G.zones = G.zones.filter(z => !z.fired);
}
function physics() {
  const mob = G.units.filter(u => u.mobile && !u.dead);
  for (let i = 0; i < mob.length; i++) {
    const a = mob[i]; for (let j = i + 1; j < mob.length; j++) {
      const b = mob[j]; const rr = (a.r + b.r) * .75, dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue; const d = Math.hypot(dx, dy) || .01; if (d < rr) {
        const o = (rr - d) / 2, nx = dx / d, ny = dy / d;
        const la = a.kind === 'minion' || a.kind === 'monster', lb = b.kind === 'minion' || b.kind === 'monster'; // 영웅은 미니언·몬스터에게 밀리지 않음
        const wa = a.dash ? 0 : (a.kind === 'hero' && lb ? 0 : b.kind === 'hero' && la ? 2 : 1), wb = b.dash ? 0 : (b.kind === 'hero' && la ? 0 : a.kind === 'hero' && lb ? 2 : 1); a.x -= nx * o * wa; a.y -= ny * o * wa; b.x += nx * o * wb; b.y += ny * o * wb;
      }
    }
  }
  const st = G.units.filter(u => !u.mobile && !u.dead);
  for (const u of mob) {
    for (const s of st) { const dx = u.x - s.x, dy = u.y - s.y, d = Math.hypot(dx, dy) || .01, rr = u.r + s.r * .8; if (d < rr) {
      const nx = dx / d, ny = dy / d, mx = u.x - (u.px ?? u.x), my = u.y - (u.py ?? u.y); let side = Math.sign(mx * -ny + my * nx) || (u.id % 2 ? 1 : -1); // 구조물에 막히면 옆으로 돌아감
      u.x = s.x + nx * rr - ny * side * 4; u.y = s.y + ny * rr + nx * side * 4; } }
    if (!u.dash) [u.x, u.y] = G.map.clampPt(u.x, u.y, u.r);
  }
}
function fx(type, x, y, o) { G.fxq.push(Object.assign({ type, x, y, dur: .45 }, o || {})); }
function ev(e) { G.events.push(e); }
