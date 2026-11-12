// 협곡 AI 대전: 모두 AI로 돌려 경기 시간·역할별 행동을 확인합니다.
// 사용법: node tools/rift-test.mjs [판수] [난이도]
import * as S from '../js/sim.js';
const N = +(process.argv[2] || 3), diff = +(process.argv[3] ?? 1);
const out = [];
for (let g = 0; g < N; g++) {
  const G = S.newGame({ mode: 'rift', pos: 'mid', diff, ctl0: 'ai' });
  const role = {}; for (const h of G.heroes) role[h.id] = { pos: h.pos, inLane: 0, samples: 0, nearAdc: 0, campT: 0, recalls: 0 };
  let t5 = null, firstTower = null, wasRecall = new Set(); let stuck = 0, lastPos = new Map();
  while (!G.over && G.t < 25 * 60) {
    S.update(1 / 30); G.events.length = 0; G.fxq.length = 0;
    const fr = Math.round(G.t * 30);
    if (fr % 30 === 0) for (const h of G.heroes) {
      if (h.dead) continue; const r = role[h.id]; r.samples++;
      if (h.recall && !wasRecall.has(h.id)) { r.recalls++; wasRecall.add(h.id); } if (!h.recall) wasRecall.delete(h.id);
      if (G.t < 480 && h.lane) { const L = G.map.lanes[h.lane]; if (S.laneProj(L, h.x, h.y).d < 400) r.inLane++; }
      if (h.pos === 'sup') { const adc = G.heroes.find(x => x.team === h.team && x.pos === 'bot'); if (adc && !adc.dead && S.dist(adc, h) < 700) r.nearAdc++; }
      if (h.pos === 'jungle' && G.map.cellAt(h.x, h.y) === 2) r.campT++;
      const lp = lastPos.get(h.id); if (lp && Math.hypot(lp[0] - h.x, lp[1] - h.y) < 1 && !h.recall && !h.target && h.moveTo && !S.inBase(h)) stuck++; lastPos.set(h.id, [h.x, h.y]);
    }
    if (!firstTower) { const d = G.units.find(u => u.kind === 'tower' && u.dead); if (d) firstTower = G.t; }
  }
  const lv = G.heroes.map(h => h.level), cs = G.heroes.map(h => h.cs);
  out.push({ min: +(G.t / 60).toFixed(1), winner: G.winner, kills: G.kills.join(':'), firstTower: firstTower && +(firstTower / 60).toFixed(1), lv: Math.round(lv.reduce((a, b) => a + b) / 10), stuck });
  console.log(JSON.stringify(out[out.length - 1]));
  if (g === 0) console.table(G.heroes.map(h => { const r = role[h.id]; return { team: h.team, hero: h.hd.name, pos: h.pos, lv: h.level, k: h.k, d: h.d, cs: h.cs, gold: Math.round(h.gold), items: h.items.length, inLane: (r.inLane / Math.max(1, Math.min(r.samples, 480)) * 100).toFixed(0) + '%', nearAdc: r.nearAdc, jungleT: r.campT, recalls: r.recalls }; }));
}
console.log('평균 경기 시간', (out.reduce((a, b) => a + b.min, 0) / out.length).toFixed(1), '분 · 15분 이내', out.filter(o => o.min <= 15).length + '/' + out.length);
