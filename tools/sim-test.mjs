// 화면 없이 AI끼리 끝까지 대전시켜 결과를 표로 출력: node tools/sim-test.mjs [판수] [1v1|5v5]
import * as S from '../js/sim.js';
const runs = +(process.argv[2] || 6), mode = process.argv[3] || '1v1', out = [];
for (let r = 0; r < runs; r++) {
  const G = S.newGame({ mode, pick: 'random', enemy: 'random', diff: r % 3, ctl0: 'ai' });
  while (!G.over && G.t < 50 * 60) { S.update(1 / 30); G.fxq.length = 0; G.events.length = 0; }
  out.push({ mode, diff: S.DIFF[G.diff].name, min: (G.t / 60).toFixed(1), over: G.over, winner: G.winner, kills: G.kills.join(':'),
    heroes: G.heroes.map(h => h.name + h.level).join(' '), towers: [0, 1].map(t => ['outer', 'inner', 'nexus'].map(k => G.struct[t][k].dead ? 'X' : 'o').join('')).join(' ') });
}
console.table(out);
