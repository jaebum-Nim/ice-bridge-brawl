// 협곡 지형: 바닥은 평평한 2D 그림(소환사의 협곡 느낌), 벽(숲)만 부드럽게 솟은 입체
import * as THREE from 'three';

export const RIFT_COL = { wall: '#2c4224', lane: '#8a7a5c', jungle: '#66713f', river: '#2f6f93', base: '#5b626e' };

// 바닥 그림: 지형마다 잔무늬 타일(풀, 흙, 물, 돌판)을 만들어 반복 무늬로 채움 → 선명하고 빠름
function paintGround(M, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), k = size / M.W, px = size / 4096, TS = 1024;
  let sd = 11; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const strokePoly = (c, pts, w) => { c.lineWidth = w * k; c.lineCap = c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)); c.stroke(); };
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x * k, y * k, r * k, 0, 7); c.fill(); };
  // 잔무늬 도우미 (색깔별로 한 경로에 모아 그림). 타일 가장자리를 넘는 건 반대편에도 그려 이음새를 없앰
  const wrap = (c, fn) => { for (const ox of [0, -TS, TS]) for (const oy of [0, -TS, TS]) { c.save(); c.translate(ox, oy); fn(); c.restore(); } };
  const speck = (c, n, cols, r0, r1) => { for (const col of cols) { const pts = []; for (let i = 0; i < n / cols.length; i++) pts.push([R() * TS, R() * TS, r0 + R() * (r1 - r0), .5 + R() * .5, R() * 3]); c.fillStyle = col; wrap(c, () => { c.beginPath(); for (const [x, y, a, e, r] of pts) { c.moveTo(x + a, y); c.ellipse(x, y, a, a * e, r, 0, 6.29); } c.fill(); }); } };
  const blades = (c, n, cols, len) => { c.lineCap = 'round'; for (const col of cols) for (const w of [1.3, 2.2]) { const pts = []; for (let i = 0; i < n / cols.length / 2; i++) { const a = -Math.PI / 2 + (R() - .5) * 1.2, l = len * .5 + R() * len; pts.push([R() * TS, R() * TS, Math.cos(a) * l, Math.sin(a) * l]); } c.strokeStyle = col; c.lineWidth = w; wrap(c, () => { c.beginPath(); for (const [x, y, dx, dy] of pts) { c.moveTo(x, y); c.lineTo(x + dx, y + dy); } c.stroke(); }); } };
  const tile = (base, fn) => { const t = document.createElement('canvas'); t.width = t.height = TS; const c = t.getContext('2d'); c.fillStyle = base; c.fillRect(0, 0, TS, TS); fn(c); return g.createPattern(t, 'repeat'); };
  const forest = tile('#1f301b', c => speck(c, 160, ['rgba(40,62,32,.6)', 'rgba(14,24,12,.6)'], 20, 70));
  const grass = tile('#56683a', c => { speck(c, 140, ['rgba(90,110,55,.45)', 'rgba(60,75,38,.45)', 'rgba(110,105,60,.3)'], 15, 60); blades(c, 4400, ['#6f8447', '#4c5f30', '#83955a', '#5e7039', '#3f5228'], 9); speck(c, 100, ['rgba(130,115,80,.5)', 'rgba(70,60,40,.4)'], 2, 5); });
  const dirt = tile('#8f7a57', c => { speck(c, 160, ['rgba(160,140,100,.18)', 'rgba(110,92,64,.18)', 'rgba(125,108,78,.2)'], 10, 40); speck(c, 900, ['#7b6a50', '#a8977a', '#6a5a43', '#b5a789', '#8a8a86'], 1.5, 5); });
  const water = tile('#25597a', c => { c.lineCap = 'round'; for (const al of [.09, .15, .21]) { const pts = []; for (let i = 0; i < 60; i++) pts.push([R() * TS, R() * TS, 8 + R() * 22]); c.strokeStyle = `rgba(200,230,245,${al})`; c.lineWidth = 1.5; wrap(c, () => { c.beginPath(); for (const [x, y, l] of pts) { c.moveTo(x - l, y); c.quadraticCurveTo(x, y - 4, x + l, y); } c.stroke(); }); } });
  const stone = tile('#6a6f78', c => { const T = 120 * k / px; for (let x = 0; x < TS; x += T) for (let y = 0; y < TS; y += T) { c.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${R() * .07})`; c.fillRect(x + 1, y + 1, T - 2, T - 2); } c.strokeStyle = 'rgba(40,44,52,.55)'; c.lineWidth = 2; for (let x = 0; x <= TS; x += T) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, TS); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(TS, x); c.stroke(); } });
  if (px !== 1) for (const p of [forest, grass, dirt, water, stone]) p.setTransform(new DOMMatrix().scale(px));
  const fill = (pat, shape) => { g.fillStyle = g.strokeStyle = pat; shape(); };

  // 칸 단위로 채우기 (종류별 무늬). 벽 경계는 지형이 솟는 위치와 정확히 같음
  // 모양의 너비는 맵의 이동 판정(M.SH)과 똑같이 → 평평한 곳 = 다닐 수 있는 곳
  const SH = M.SH;
  g.fillStyle = forest; g.fillRect(0, 0, size, size);
  g.fillStyle = g.strokeStyle = grass; for (const L of Object.values(M.lanes)) strokePoly(g, L.pts, SH.lane * 2);
  // 3) 정글 풀밭
  fill(grass, () => { for (const p of M.paths) strokePoly(g, p, SH.path * 2); for (const cp of M.camps) circle(g, cp.x, cp.y, SH.camp); });
  // 4) 강: 물가 → 물(가운데 밝게) → 물가 거품
  g.strokeStyle = '#6d6a4c'; strokePoly(g, M.river, SH.river * 2);
  fill(water, () => strokePoly(g, M.river, SH.river * 2 - 50));
  g.strokeStyle = 'rgba(70,140,185,.35)'; strokePoly(g, M.river, 470); g.strokeStyle = 'rgba(90,160,200,.3)'; strokePoly(g, M.river, 300);
  g.strokeStyle = 'rgba(225,240,245,.18)'; g.lineWidth = 6 * px; g.setLineDash([14 * px, 10 * px]); for (const off of [-1, 1]) { g.beginPath(); M.river.forEach(([x, y], i) => { const X = (x + off * 216) * k, Y = (y - off * 216) * k; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); } g.setLineDash([]);
  // 5) 라인: 풀과 섞인 가장자리 → 흙길 → 가운데 밝은 띠, 바퀴 자국
  g.strokeStyle = '#6f6a45'; for (const L of Object.values(M.lanes)) strokePoly(g, L.pts, SH.lane * 2 - 10);
  fill(dirt, () => { for (const L of Object.values(M.lanes)) strokePoly(g, L.pts, SH.lane * 2 - 50); });
  g.strokeStyle = 'rgba(180,160,120,.3)'; for (const L of Object.values(M.lanes)) strokePoly(g, L.pts, 260);
  g.strokeStyle = 'rgba(80,66,46,.25)'; g.lineWidth = 3 * px; for (const L of Object.values(M.lanes)) for (const off of [-90, 90]) { g.beginPath(); L.pts.forEach(([x, y], i) => { const X = (x + off * .7) * k, Y = (y + off * .7) * k; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
  // 6) 기지 돌판 + 팀 색 분수대
  fill(stone, () => M.fountain.forEach((f, tm) => { const b = tm ? [M.W - 700, M.H - 6300] : [700, 6300]; circle(g, b[0], b[1], SH.base); }));
  M.fountain.forEach((f, tm) => { g.fillStyle = tm ? '#5e2c33' : '#22406a'; circle(g, f.x, f.y, 360); g.fillStyle = tm ? '#9b4a52' : '#3b6db0'; circle(g, f.x, f.y, 300); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4 * px; g.beginPath(); g.arc(f.x * k, f.y * k, 230 * k, 0, 7); g.stroke(); });
  // 7) 맵 가장자리 숲
  g.fillStyle = forest; const e = 250 * k; g.fillRect(0, 0, size, e); g.fillRect(0, size - e, size, e); g.fillRect(0, 0, e, size); g.fillRect(size - e, 0, e, size);
  return cv;
}

export function buildRiftTerrain(group, M, K, maxAniso = 4) {
  const N = M.N, W = M.W * K, C = M.W / N; // C: 격자 한 칸의 게임 단위 크기
  const wall = (x, z) => x < 0 || z < 0 || x >= N || z >= N ? 1 : (M.grid[z * N + x] === 0 ? 1 : 0);
  // 점에서 가장 가까운 '반대 종류' 칸까지의 거리 (벽 안이면 길까지, 길 위면 벽까지)
  const distTo = (px, pz, wantWall, R) => { const cx = Math.floor(px / C), cz = Math.floor(pz / C); let best = 1e9; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { if (wall(cx + dx, cz + dz) !== wantWall) continue; const x0 = (cx + dx) * C, z0 = (cz + dz) * C, ex = Math.max(x0 - px, 0, px - x0 - C), ez = Math.max(z0 - pz, 0, pz - z0 - C), d = Math.hypot(ex, ez); if (d < best) best = d; } return best; };
  // 높이: 이동 가능한 칸은 정확히 평평(0), 벽 칸은 경계에서부터 솟아오름 → 화면의 벽 = 실제로 못 가는 곳
  const RISE = 60;
  const heightAt = (wx, wz) => { const px = wx / K, pz = wz / K, d = M.sdf(px, pz); if (d <= 0) return 0; const t = Math.min(1, d / RISE), h = t * t * (3 - 2 * t); return h * 1.5 + (d > RISE * 1.5 ? Math.sin(px * .017) * Math.cos(pz * .013) * .15 : 0); };
  const S = N * 2, geo = new THREE.PlaneGeometry(W, W, S, S); geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, W / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  // 경사면은 바위색, 꼭대기는 이끼색 (바닥 그림에 곱해짐)
  const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), ny = nrm.getY(i), steep = Math.max(0, Math.min(1, (0.93 - ny) * 3)) * (y > .05 ? 1 : 0); const top = Math.min(1, y / 1.3);
    let ao = 1; if (y < .01) { const d = -M.sdf(pos.getX(i) / K, pos.getZ(i) / K); ao = .72 + .28 * Math.min(1, Math.max(0, d) / 70); } // 벽 밑 그늘
    col[i * 3] = (1 + steep * .55 - top * .05) * ao; col[i * 3 + 1] = (1 + steep * .2 + top * .08) * ao; col[i * 3 + 2] = (1 + steep * .25 - top * .1) * ao; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tex = new THREE.CanvasTexture(paintGround(M, 4096)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true })); group.add(mesh);
  // 벽 위 나무 (낮은 다각형 원뿔, 한 번에 그림)
  const trees = []; let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (!wall(x, z) || (x + z) % 2) continue; const px = (x + .5) * C, pz = (z + .5) * C;
    if (M.sdf(px, pz) > 160 && rnd() < .22) trees.push([px + (rnd() - .5) * C, pz + (rnd() - .5) * C, .8 + rnd() * .5]);
  }
  const tg = new THREE.ConeGeometry(.6, 1.5, 7); tg.translate(0, .7, 0);
  const tm = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), trees.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
  trees.forEach(([x, z, s], i) => { m4.makeScale(s, s * (.9 + (i % 5) * .08), s); m4.setPosition(x * K, 1.35, z * K); tm.setMatrixAt(i, m4); tm.setColorAt(i, c.setHSL(.31 + (i % 7) * .01, .45, .085 + (i % 4) * .015)); });
  tm.frustumCulled = false; group.add(tm);
  // 맵 바깥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 120, W + 120), new THREE.MeshLambertMaterial({ color: 0x33482a })); floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 1.45, W / 2); floor.renderOrder = -1;
  const ring = new THREE.Mesh(new THREE.RingGeometry(W * .72, W * 1.6, 4, 1), floor.material); ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.set(W / 2, 1.45, W / 2); group.add(ring);
  return { group, heightAt, update: () => { } };
}
