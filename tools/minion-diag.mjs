// 협곡 미니언 행동 진단: 막힘, 떨림, 라인 이탈, 대상 교체, 웨이브 충돌 지점
// 사용법: node tools/minion-diag.mjs [분]
import * as S from '../js/sim.js';
const MIN = +(process.argv[2] || 6);
const G = S.newGame({ mode: 'rift', pos: 'mid', diff: 1, ctl0: 'ai' });
const appr = []; const apS = new Map();
const st = { frames: 0, idleMove: 0, attack: 0, chase: 0, chaseBlocked: 0, atkJitter: 0, atkJitterSum: 0, offLane: 0, inJungle: 0, switches: 0, overlap: 0, rangedFront: 0, rangedN: 0 };
const prev = new Map(), meet = {};
const dt = 1 / 30;
while (G.t < MIN * 60) {
  S.update(dt); G.events.length = 0; G.fxq.length = 0;
  const ms = G.units.filter(u => u.kind === 'minion' && !u.dead);
  for (const u of ms) {
    const p = prev.get(u.id); const L = G.map.lanes[u.lane], pr = S.laneProj(L, u.x, u.y);
    st.frames++; if (pr.d > 330) st.offLane++; if (G.map.cellAt(u.x, u.y) === 2) st.inJungle++;
    if (p) {
      const mv = Math.hypot(u.x - p.x, u.y - p.y), sp = S.effMs(u) * dt;
      if (!u.target) st.idleMove++;
      else if (S.inRange(u, u.target)) { st.attack++; if (mv > 1) { st.atkJitter++; st.atkJitterSum += mv; } }
      else { st.chase++; if (mv < sp * .4) st.chaseBlocked++; }
      if (p.tg && u.target && p.tg !== u.target.id) st.switches++;
      if (u.target) { const k = u.id + ':' + u.target.id; if (!apS.has(k)) apS.set(k, { t0: G.t, d0: Math.hypot(u.x - u.target.x, u.y - u.target.y) - u.range }); const a = apS.get(k); if (!a.done && S.inRange(u, u.target)) { a.done = 1; if (a.d0 > 50) appr.push((G.t - a.t0) / (a.d0 / u.ms)); } }
    }
    prev.set(u.id, { x: u.x, y: u.y, tg: u.target && u.target.id });
    if (!meet[u.lane] && u.target && u.target.kind === 'minion') meet[u.lane] = { t: +G.t.toFixed(1), at: +(pr.s / L.len).toFixed(2) };
  }
  // 겹침: 같은 팀 미니언끼리 반지름 합의 60%보다 가까움
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const a = ms[i], b = ms[j]; if (a.team !== b.team) continue; if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * .6) st.overlap++; }
  // 원거리 미니언이 근접보다 앞에 있는 비율
  for (const lane of Object.keys(G.map.lanes)) for (const team of [0, 1]) {
    const L = G.map.lanes[lane], dir = team ? -1 : 1, w = ms.filter(m => m.lane === lane && m.team === team && !m.target);
    const mel = w.filter(m => m.mk === 'm'), rng = w.filter(m => m.mk === 'c');
    if (!mel.length || !rng.length) continue; const front = Math.max(...mel.map(m => S.laneProj(L, m.x, m.y).s * dir));
    for (const r of rng) { st.rangedN++; if (S.laneProj(L, r.x, r.y).s * dir > front + 20) st.rangedFront++; }
  }
}
const pc = (a, b) => (a / Math.max(1, b) * 100).toFixed(1) + '%';
console.log({ 분: MIN, 미니언프레임: st.frames, 라인이탈: pc(st.offLane, st.frames), 정글진입: pc(st.inJungle, st.frames),
  추격중막힘: pc(st.chaseBlocked, st.chase), 공격중떨림: pc(st.atkJitter, st.attack), 떨림평균: (st.atkJitterSum / Math.max(1, st.atkJitter)).toFixed(2),
  대상교체수: st.switches, 접근지연배수_중앙: appr.sort((a,b)=>a-b)[appr.length>>1]?.toFixed(2), 접근지연배수_90: appr[Math.floor(appr.length*.9)]?.toFixed(2), 접근수: appr.length, 겹침쌍프레임: st.overlap, 원거리가앞장: pc(st.rangedFront, st.rangedN), 첫충돌: meet });
