// 1대1 상성표: 모든 영웅 조합을 양쪽 진영으로 반복 대전시켜 승률을 냅니다.
// 사용법: node tools/balance.mjs [조합당 판수] [작업 번호] [작업 수]  (여러 개를 동시에 돌린 뒤 --merge 로 합치기)
import * as S from '../js/sim.js';
import fs from 'fs';
const args = process.argv.slice(2);
const ids = S.HEROES.map(h => h.id);
if (args[0] === '--merge') {
  const all = args.slice(1).flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  report(all); process.exit(0);
}
const reps = +(args[0] || 2), part = +(args[1] || 0), parts = +(args[2] || 1);
const jobs = [];
for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) if (i !== j) for (let r = 0; r < reps; r++) jobs.push([ids[i], ids[j]]);
const res = [];
jobs.forEach(([a, b], n) => {
  if (n % parts !== part) return;
  const G = S.newGame({ mode: '1v1', pick: a, enemy: b, diff: 1, ctl0: 'ai' });
  while (!G.over && G.t < 30 * 60) { S.update(1 / 30); G.events.length = 0; G.fxq.length = 0; }
  res.push({ a, b, w: G.over ? (G.winner === 0 ? a : b) : null, min: G.t / 60, auto: G.stats.auto, abil: G.stats.abil });
});
if (args[3]) fs.writeFileSync(args[3], JSON.stringify(res)); else report(res);

function report(res) {
  const name = id => S.HMAP[id].name, stat = {};
  for (const id of ids) stat[id] = { w: 0, n: 0 };
  const mx = {};
  let A = 0, B = 0, mins = 0;
  for (const r of res) {
    A += r.auto; B += r.abil; mins += r.min;
    for (const id of [r.a, r.b]) { if (!r.w) continue; stat[id].n++; if (r.w === id) stat[id].w++; }
    if (r.w) { const k = r.a + '>' + r.b, k2 = r.b + '>' + r.a; mx[k] = mx[k] || { w: 0, n: 0 }; mx[k2] = mx[k2] || { w: 0, n: 0 }; mx[k].n++; mx[k2].n++; if (r.w === r.a) mx[k].w++; else mx[k2].w++; }
  }
  console.log(`대전 ${res.length}판 · 평균 ${(mins / res.length).toFixed(1)}분 · 영웅 간 피해 중 평타 ${(A / (A + B) * 100).toFixed(0)}%`);
  console.table(Object.entries(stat).sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n).map(([id, s]) => ({ 영웅: name(id), 승률: (s.w / s.n * 100).toFixed(0) + '%', 판수: s.n })));
  const rows = {}; for (const a of ids) { rows[name(a)] = {}; for (const b of ids) { if (a === b) { rows[name(a)][name(b)] = '-'; continue; } const m = mx[a + '>' + b]; rows[name(a)][name(b)] = m ? Math.round(m.w / m.n * 100) : ''; } }
  console.log('행 영웅이 열 영웅을 상대로 이긴 비율(%)'); console.table(rows);
}
