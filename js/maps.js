// 맵 정의 (DOM 없음): 칼바람(일자 다리)과 협곡(3라인 + 정글)
// 좌표는 게임 단위. 렌더러는 1칸(100) = 월드 1.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = clamp(t, 0, 1); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
function polyD(pts, x, y) { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segD(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return m; }

/* ---------- 라인(경로) ---------- */
// pts는 블루 넥서스 → 레드 넥서스 순서. s = 블루 쪽 끝에서 잰 길이
export function makeLane(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; }
export function laneProj(L, x, y) {
  let best = { d: 1e9, s: 0, x: 0, y: 0 };
  for (let i = 0; i < L.pts.length - 1; i++) {
    const [ax, ay] = L.pts[i], [bx, by] = L.pts[i + 1], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = clamp(l ? ((x - ax) * dx + (y - ay) * dy) / l : 0, 0, 1), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { d, s: L.cum[i] + t * Math.sqrt(l), x: px, y: py };
  }
  return best;
}
// s 위치의 점과 진행 방향(블루→레드) 단위벡터
export function lanePt(L, s) {
  s = clamp(s, 0, L.len); let i = 0; while (i < L.pts.length - 2 && L.cum[i + 1] < s) i++;
  const [ax, ay] = L.pts[i], [bx, by] = L.pts[i + 1], seg = L.cum[i + 1] - L.cum[i] || 1, t = (s - L.cum[i]) / seg;
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / seg, dy: (by - ay) / seg };
}

/* ---------- 칼바람 나락 ---------- */
export function aramMap() {
  const W = 6000, Y1 = 250, Y2 = 1150, MY = 700;
  const X = (t, x) => t ? W - x : x;
  return {
    id: 'aram', W, H: 1400, grid: null, Y1, Y2, MY,
    fountain: [{ x: 170, y: MY }, { x: W - 170, y: MY }],
    lanes: { mid: makeLane([[560, MY], [W - 560, MY]]) },
    walk: (x, y) => x >= 40 && x <= W - 40 && y >= Y1 && y <= Y2,
    clampPt: (x, y, r) => [clamp(x, 40, W - 40), clamp(y, Y1 + r * .6, Y2 - r * .6)],
    inBase(t, x) { return Math.abs(x - this.fountain[t].x) < 700; },
    // 바깥 → 안쪽 → 넥서스 순서로만 공격 가능
    structs: t => [{ id: 'outer', kind: 'tower', x: X(t, 1950), y: MY, lane: 'mid' }, { id: 'inner', kind: 'tower', x: X(t, 1200), y: MY, lane: 'mid', reqAll: ['outer'] }, { id: 'nexus', kind: 'nexus', x: X(t, 560), y: MY, reqAll: ['outer', 'inner'] }],
    relics: [[2500, MY - 300], [2500, MY + 300], [3500, MY - 300], [3500, MY + 300]],
    camps: [], spawn: t => ({ x: X(t, 560), y: MY })
  };
}

/* ---------- 협곡 (3라인 + 간단한 정글) ---------- */
// 블루 기지 왼쪽 아래, 레드 기지 오른쪽 위. 레드 쪽은 블루 쪽을 점대칭(S-x, S-y)으로 뒤집은 것
export const CELL = 100;
export function riftMap() {
  const S = 7000, N = S / CELL, MIR = p => [S - p[0], S - p[1]];
  const lanes = {
    top: makeLane([[900, 6100], [650, 5300], [650, 1100], [1100, 650], [5300, 650], [6100, 900]]),
    mid: makeLane([[900, 6100], [6100, 900]]),
    bot: makeLane([[900, 6100], [1700, 6350], [5900, 6350], [6350, 5900], [6350, 1700], [6100, 900]])
  };
  const river = [[900, 900], [3500, 3500], [6100, 6100]];
  // 블루 쪽 정글 캠프 (레드 쪽은 점대칭)
  const campB = [
    { type: 'blue', x: 1700, y: 3200 }, { type: 'wolf', x: 1500, y: 4700 },
    { type: 'red', x: 3500, y: 5300 }, { type: 'toad', x: 4700, y: 5700 }];
  const pathB = [
    [[1400, 5500], [1500, 4700], [1700, 3200], [2400, 2700]], [[1700, 3200], [650, 3000]], [[1500, 4700], [2300, 4700]],
    [[1600, 5800], [2500, 5500], [3500, 5300], [4700, 5700], [5300, 5300]], [[3500, 5300], [3500, 4300], [3300, 3700]], [[4700, 5700], [4900, 6350]]];
  const camps = [];
  campB.forEach((c, i) => { camps.push({ id: 'b' + i, side: 0, ...c }); const [x, y] = MIR([c.x, c.y]); camps.push({ id: 'r' + i, side: 1, type: c.type, x, y }); });
  const paths = []; for (const p of pathB) { paths.push(p); paths.push(p.map(MIR)); }
  const fountain = [{ x: 350, y: 6650 }, { x: S - 350, y: 350 }];
  const baseC = [[700, 6300], MIR([700, 6300])];
  // 칸 종류: 0 벽(나무), 1 라인, 2 정글 길, 3 강, 4 기지
  const grid = new Uint8Array(N * N);
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    const x = cx * CELL + 50, y = cy * CELL + 50; let t = 0;
    if (baseC.some(b => Math.hypot(x - b[0], y - b[1]) < 1150)) t = 4;
    else if (Object.values(lanes).some(L => polyD(L.pts, x, y) < 310)) t = 1;
    else if (polyD(river, x, y) < 300) t = 3;
    else if (camps.some(c => Math.hypot(x - c.x, y - c.y) < 400) || paths.some(p => polyD(p, x, y) < 210)) t = 2;
    if (x < 250 || y < 250 || x > S - 250 || y > S - 250) t = 0;
    grid[cy * N + cx] = t;
  }
  const cellAt = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= N || cy >= N ? 0 : grid[cy * N + cx]; };
  const walk = (x, y) => cellAt(x, y) !== 0;
  function nearestCell(x, y) {
    const cx0 = clamp(Math.floor(x / CELL), 0, N - 1), cy0 = clamp(Math.floor(y / CELL), 0, N - 1);
    if (grid[cy0 * N + cx0]) return [cx0, cy0];
    for (let r = 1; r < 25; r++) { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const cx = cx0 + dx, cy = cy0 + dy; if (cx < 0 || cy < 0 || cx >= N || cy >= N || !grid[cy * N + cx]) continue; const d = Math.hypot((cx + .5) * CELL - x, (cy + .5) * CELL - y); if (d < bd) { bd = d; best = [cx, cy]; } } if (best) return best; }
    return [cx0, cy0];
  }
  function clampPt(x, y) {
    x = clamp(x, 40, S - 40); y = clamp(y, 40, S - 40); if (walk(x, y)) return [x, y];
    const [cx, cy] = nearestCell(x, y); return [clamp(x, cx * CELL + 8, cx * CELL + CELL - 8), clamp(y, cy * CELL + 8, cy * CELL + CELL - 8)];
  }
  function los(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 40); for (let i = 1; i <= n; i++) { const k = i / n; if (!walk(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) return false; } return true; }
  // A* (8방향, 대각선은 양옆이 모두 열려 있을 때만)
  const gS = new Float32Array(N * N), from = new Int32Array(N * N), seen = new Uint32Array(N * N), closed = new Uint32Array(N * N); let stamp = 0;
  function path(x0, y0, x1, y1) {
    const [sx, sy] = nearestCell(x0, y0), [gx, gy] = nearestCell(x1, y1); const s = sy * N + sx, g = gy * N + gx;
    stamp++; const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const h = i => { const dx = Math.abs(i % N - gx), dy = Math.abs(((i / N) | 0) - gy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    seen[s] = stamp; gS[s] = 0; from[s] = -1; push(s, h(s)); let found = false, it = 0;
    while (heap.length && it++ < 6000) {
      const c = pop(); if (closed[c] === stamp) continue; closed[c] = stamp; if (c === g) { found = true; break; }
      const cx = c % N, cy = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const ni = ny * N + nx;
        if (!grid[ni] || closed[ni] === stamp) continue; if (dx && dy && (!grid[cy * N + nx] || !grid[ny * N + cx])) continue;
        const ng = gS[c] + (dx && dy ? Math.SQRT2 : 1); if (seen[ni] === stamp && ng >= gS[ni]) continue;
        seen[ni] = stamp; gS[ni] = ng; from[ni] = c; push(ni, ng + h(ni));
      }
    }
    if (!found) return null;
    const cellsP = []; for (let c = g; c !== -1; c = from[c]) cellsP.push(c); cellsP.reverse();
    const pts = cellsP.map(c => [(c % N + .5) * CELL, (((c / N) | 0) + .5) * CELL]);
    pts[pts.length - 1] = clampPt(x1, y1);
    // 줄 당기기: 보이는 가장 먼 점으로 건너뜀
    const out = []; let cx = x0, cy = y0, i = 0;
    while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(cx, cy, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [cx, cy] = pts[j]; i = j + 1; }
    return out;
  }
  const X = (t, p) => t ? MIR(p) : p;
  return {
    id: 'rift', W: S, H: S, N, grid, cellAt, walk, clampPt, los, path, lanes, river, camps, paths, fountain,
    inBase(t, x, y) { const f = this.fountain[t]; return Math.hypot(x - f.x, y - f.y) < 1000; },
    // 라인 포탑 3개 중 하나라도 부서지면 넥서스 포탑, 넥서스 포탑이 부서지면 넥서스
    structs: t => {
      const P = p => { const [x, y] = X(t, p); return { x, y }; };
      return [{ id: 'top', kind: 'tower', lane: 'top', ...P([650, 3600]) }, { id: 'mid', kind: 'tower', lane: 'mid', ...P([2400, 4600]) }, { id: 'bot', kind: 'tower', lane: 'bot', ...P([3400, 6350]) },
        { id: 'base', kind: 'tower', lane: 'mid', reqAny: ['top', 'mid', 'bot'], ...P([1350, 5650]) }, { id: 'nexus', kind: 'nexus', reqAll: ['base'], ...P([900, 6100]) }];
    },
    relics: [], spawn: t => { const [x, y] = X(t, [900, 6100]); return { x, y }; }
  };
}
