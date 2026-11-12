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
export const CELL = 50; // 벽 격자 한 칸 (화면의 벽 모양과 실제 이동 가능 영역을 맞추려고 촘촘하게)
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
  // 부호 거리: 음수 = 다닐 수 있는 곳(가장 가까운 모양 안쪽 깊이), 양수 = 벽 안쪽으로 들어간 거리
  // 화면의 벽 높이와 실제 이동 판정이 모두 이 함수 하나에서 나옴
  const W_LANE = 310, W_RIVER = 300, W_CAMP = 400, W_PATH = 210, W_BASE = 1150, EDGE = 250;
  const SH = { lane: W_LANE, river: W_RIVER, camp: W_CAMP, path: W_PATH, base: W_BASE };
  function sdf(x, y) {
    let d = 1e9;
    for (const b of baseC) d = Math.min(d, Math.hypot(x - b[0], y - b[1]) - W_BASE);
    for (const L of Object.values(lanes)) d = Math.min(d, polyD(L.pts, x, y) - W_LANE);
    d = Math.min(d, polyD(river, x, y) - W_RIVER);
    for (const c of camps) d = Math.min(d, Math.hypot(x - c.x, y - c.y) - W_CAMP);
    for (const p of paths) d = Math.min(d, polyD(p, x, y) - W_PATH);
    return Math.max(d, EDGE - x, EDGE - y, x - (S - EDGE), y - (S - EDGE));
  }
  // 이동 판정용 고해상도 비트맵 (10단위)
  const FR = 10, FN = S / FR, fine = new Uint8Array(FN * FN);
  for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) fine[j * FN + i] = sdf((i + .5) * FR, (j + .5) * FR) < 0 ? 1 : 0;
  const walk = (x, y) => { const i = Math.floor(x / FR), j = Math.floor(y / FR); return i >= 0 && j >= 0 && i < FN && j < FN && fine[j * FN + i] === 1; };
  // 길찾기용 격자: 칸 가운데가 다닐 수 있으면 열림. 종류 0 벽, 1 라인, 2 정글 길, 3 강, 4 기지 (미니맵·바닥 그림용)
  // open: 칸 전체가 확실히 다닐 수 있는 칸만 (가운데 부호 거리 < -칸 반대각선) → 길찾기 경로가 벽을 스치지 않음
  const grid = new Uint8Array(N * N), open = new Uint8Array(N * N), HALF = CELL * Math.SQRT1_2;
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    const x = (cx + .5) * CELL, y = (cy + .5) * CELL; let t = 0; const sd = sdf(x, y);
    open[cy * N + cx] = sd < -HALF ? 1 : 0;
    if (sd < 0) {
      if (baseC.some(b => Math.hypot(x - b[0], y - b[1]) < W_BASE)) t = 4;
      else if (Object.values(lanes).some(L => polyD(L.pts, x, y) < W_LANE)) t = 1;
      else if (polyD(river, x, y) < W_RIVER) t = 3;
      else t = 2;
    }
    grid[cy * N + cx] = t;
  }
  const cellAt = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= N || cy >= N ? 0 : grid[cy * N + cx]; };
  function nearestCell(x, y) {
    const cx0 = clamp(Math.floor(x / CELL), 0, N - 1), cy0 = clamp(Math.floor(y / CELL), 0, N - 1);
    if (open[cy0 * N + cx0]) return [cx0, cy0];
    for (let r = 1; r < 50; r++) { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const cx = cx0 + dx, cy = cy0 + dy; if (cx < 0 || cy < 0 || cx >= N || cy >= N || !open[cy * N + cx]) continue; const d = Math.hypot((cx + .5) * CELL - x, (cy + .5) * CELL - y); if (d < bd) { bd = d; best = [cx, cy]; } } if (best) return best; }
    return [cx0, cy0];
  }
  // 벽 안의 점 → 가장 가까운 다닐 수 있는 점 (가까운 열린 칸 가운데에서 원래 점 쪽으로 벽 직전까지)
  function clampPt(x, y) {
    x = clamp(x, 40, S - 40); y = clamp(y, 40, S - 40); if (walk(x, y)) return [x, y];
    const [cx, cy] = nearestCell(x, y); let ax = (cx + .5) * CELL, ay = (cy + .5) * CELL, bx = x, by = y;
    for (let i = 0; i < 10; i++) { const mx = (ax + bx) / 2, my = (ay + by) / 2; if (walk(mx, my)) { ax = mx; ay = my; } else { bx = mx; by = my; } }
    const [dx, dy] = [x - ax, y - ay], l = Math.hypot(dx, dy) || 1, bk = Math.min(6, l); // 경계에서 살짝 안쪽
    const px = ax - dx / l * bk, py = ay - dy / l * bk; return walk(px, py) ? [px, py] : [(cx + .5) * CELL, (cy + .5) * CELL];
  }
  // 직선으로 갈 수 있는지: 가운데 선과 양옆 선(여유 cl)을 촘촘히 검사 → 벽 모서리를 스치지 않음
  function los(x0, y0, x1, y1, cl = 18) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 15); if (!d) return walk(x1, y1);
    const nx = -(y1 - y0) / d * cl, ny = (x1 - x0) / d * cl;
    for (let i = 1; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; if (!walk(x, y) || (cl && (!walk(x + nx, y + ny) || !walk(x - nx, y - ny)))) return false; }
    return true;
  }
  // A* (8방향, 대각선은 양옆이 모두 열려 있을 때만)
  const gS = new Float32Array(N * N), from = new Int32Array(N * N), seen = new Uint32Array(N * N), closed = new Uint32Array(N * N); let stamp = 0;
  function path(x0, y0, x1, y1) {
    const [sx, sy] = nearestCell(x0, y0), [gx, gy] = nearestCell(x1, y1); const s = sy * N + sx, g = gy * N + gx;
    stamp++; const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const h = i => { const dx = Math.abs(i % N - gx), dy = Math.abs(((i / N) | 0) - gy); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    seen[s] = stamp; gS[s] = 0; from[s] = -1; push(s, h(s)); let found = false, it = 0;
    while (heap.length && it++ < 40000) {
      const c = pop(); if (closed[c] === stamp) continue; closed[c] = stamp; if (c === g) { found = true; break; }
      const cx = c % N, cy = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const ni = ny * N + nx;
        if (!open[ni] || closed[ni] === stamp) continue; if (dx && dy && (!open[cy * N + nx] || !open[ny * N + cx])) continue;
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
    id: 'rift', W: S, H: S, N, grid, cellAt, walk, clampPt, los, path, sdf, SH, lanes, river, camps, paths, fountain,
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
