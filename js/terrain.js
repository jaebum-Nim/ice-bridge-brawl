// 협곡 지형: 바닥은 평평한 2D 그림(소환사의 협곡 느낌), 벽(숲)만 부드럽게 솟은 입체
import * as THREE from 'three';

export const RIFT_COL = { wall: '#2c4224', lane: '#8a7a5c', jungle: '#66713f', river: '#2f6f93', base: '#5b626e' };

function paintGround(M, size) {
  // 작은 캔버스에 모양을 그리고 크게 늘려서 가장자리를 부드럽게 (블러 필터는 느려서 안 씀)
  const small = paintShapes(M, size / 4), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, size, size);
  const k = size / M.W; let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) { g.fillStyle = R() < .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(R() * size, R() * size, 2 * size / 2048, 2 * size / 2048); }
  return cv;
}
function paintShapes(M, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), k = size / M.W;
  const poly = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w * k; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.stroke(); };
  const circ = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x * k, y * k, r * k, 0, 7); g.fill(); };
  g.fillStyle = RIFT_COL.wall; g.fillRect(0, 0, size, size);
  // 숲 바닥 얼룩
  let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { g.fillStyle = R() < .5 ? 'rgba(60,90,45,.35)' : 'rgba(20,35,18,.35)'; g.beginPath(); g.arc(R() * size, R() * size, (8 + R() * 30) * size / 2048, 0, 7); g.fill(); }
  // 정글 길·캠프
  for (const p of M.paths) poly(p, 440, RIFT_COL.jungle);
  for (const c of M.camps) circ(c.x, c.y, 410, RIFT_COL.jungle);
  // 강
  poly(M.river, 640, RIFT_COL.river); poly(M.river, 360, '#3a82ab');
  // 라인
  for (const L of Object.values(M.lanes)) poly(L.pts, 640, RIFT_COL.lane);
  for (const L of Object.values(M.lanes)) poly(L.pts, 300, '#978666');
  // 기지
  M.fountain.forEach((f, t) => { const b = t ? [M.W - 700, M.H - 6300] : [700, 6300]; circ(b[0], b[1], 1180, RIFT_COL.base); circ(f.x, f.y, 330, t ? '#7a3b3b' : '#33557f'); });
  return cv;
}

export function buildRiftTerrain(group, M, K, maxAniso = 4) {
  const N = M.N, W = M.W * K;
  // 벽 비율을 살짝 번지게 한 값 → 부드러운 높이
  const wall = (x, z) => x < 0 || z < 0 || x >= N || z >= N ? 1 : (M.grid[z * N + x] === 0 ? 1 : 0);
  const F = new Float32Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { let a = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) a += wall(x + dx, z + dz) * (dx || dz ? 1 : 2); F[z * N + x] = a / 10; }
  const f = (x, z) => F[Math.max(0, Math.min(N - 1, z)) * N + Math.max(0, Math.min(N - 1, x))];
  const S = N * 3, geo = new THREE.PlaneGeometry(W, W, S, S); geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, W / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const gx = pos.getX(i) / W * N - .5, gz = pos.getZ(i) / W * N - .5, x0 = Math.floor(gx), z0 = Math.floor(gz), tx = gx - x0, tz = gz - z0;
    const v = (f(x0, z0) * (1 - tx) + f(x0 + 1, z0) * tx) * (1 - tz) + (f(x0, z0 + 1) * (1 - tx) + f(x0 + 1, z0 + 1) * tx) * tz;
    const t = Math.max(0, Math.min(1, (v - .45) / .3)), h = t * t * (3 - 2 * t);
    pos.setY(i, h * 1.5 + h * Math.sin(gx * 1.7) * Math.cos(gz * 1.3) * .15);
  }
  geo.computeVertexNormals();
  // 경사면은 바위색, 꼭대기는 이끼색 (바닥 그림에 곱해짐)
  const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), ny = nrm.getY(i), steep = Math.max(0, Math.min(1, (0.93 - ny) * 3)) * (y > .05 ? 1 : 0); const top = Math.min(1, y / 1.3);
    col[i * 3] = 1 + steep * .55 - top * .05; col[i * 3 + 1] = 1 + steep * .2 + top * .08; col[i * 3 + 2] = 1 + steep * .25 - top * .1; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tex = new THREE.CanvasTexture(paintGround(M, 2048)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true })); group.add(mesh);
  // 벽 위 나무 (낮은 다각형 원뿔, 한 번에 그림)
  const trees = []; let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (!wall(x, z)) continue; let near = 9; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!wall(x + dx, z + dz)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dz)));
    if (near >= 3 && rnd() < .22) trees.push([x + .2 + rnd() * .6, z + .2 + rnd() * .6, .8 + rnd() * .5]);
  }
  const tg = new THREE.ConeGeometry(.6, 1.5, 7); tg.translate(0, .7, 0);
  const tm = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), trees.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
  trees.forEach(([x, z, s], i) => { m4.makeScale(s, s * (.9 + (i % 5) * .08), s); m4.setPosition(x * W / N, 1.35, z * W / N); tm.setMatrixAt(i, m4); tm.setColorAt(i, c.setHSL(.31 + (i % 7) * .01, .45, .085 + (i % 4) * .015)); });
  tm.frustumCulled = false; group.add(tm);
  // 맵 바깥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 120, W + 120), new THREE.MeshLambertMaterial({ color: 0x33482a })); floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 1.45, W / 2); floor.renderOrder = -1;
  const ring = new THREE.Mesh(new THREE.RingGeometry(W * .72, W * 1.6, 4, 1), floor.material); ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.set(W / 2, 1.45, W / 2); group.add(ring);
  return { group, update: () => { } };
}
