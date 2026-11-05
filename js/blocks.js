// 마인크래프트 기본 스타일 블록 월드
// - 16x16 픽셀 텍스처를 코드로 그림 (외부 이미지 없음)
// - 블록 종류마다 InstancedMesh 하나 → 수천 개 블록도 적은 그리기 호출로 처리
// - 재질은 전부 MeshLambertMaterial(텍스처 있음) 한 종류라 셰이더 프로그램이 하나만 생김
import * as THREE from 'three';

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/* ---------- 픽셀 텍스처 ---------- */
const TEX = {};
function px(draw, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const img = g.createImageData(16, 16); const R = seeded(seed);
  const set = (x, y, col, j = 0) => { const i = (y * 16 + x) * 4, v = 1 + (R() - .5) * j; img.data[i] = Math.min(255, col[0] * v); img.data[i + 1] = Math.min(255, col[1] * v); img.data[i + 2] = Math.min(255, col[2] * v); img.data[i + 3] = 255; };
  draw(set, R); g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const C = { snow: [242, 247, 252], dirt: [134, 96, 67], stone: [125, 125, 125], mortar: [78, 78, 82], log: [74, 52, 30], logD: [52, 36, 20], leaf: [44, 78, 52], ice: [150, 196, 250], water: [52, 98, 214], plank: [112, 80, 48], gravel: [128, 122, 118] };
function makeTextures() {
  if (TEX.snow) return TEX;
  TEX.snow = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, C.snow, .06); }, 1);
  TEX.snowSide = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = 3 + ((x * 7 + 3) % 3 === 0 ? 1 : 0) + (x % 5 === 0 ? 1 : 0); s(x, y, y < edge ? C.snow : C.dirt, y < edge ? .06 : .22); } }, 2);
  TEX.dirt = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, C.dirt, .25); }, 3);
  TEX.stone = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, R() < .12 ? [100, 100, 100] : C.stone, .15); }, 4);
  TEX.cobble = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const cell = ((x >> 2) + (y >> 2) * 3) % 4, edge = x % 4 === 0 || y % 4 === 0 || (x + y * 3) % 7 === 0; s(x, y, edge ? [70, 70, 72] : [110 + cell * 12, 110 + cell * 12, 112 + cell * 12], .12); } }, 5);
  TEX.brick = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 3, off = row ? 4 : 0, mort = y % 8 === 7 || (x + off) % 8 === 7; s(x, y, mort ? C.mortar : [122, 122, 126], mort ? .1 : .14); } }, 6);
  TEX.logSide = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, x % 4 === 1 || x % 5 === 3 ? C.logD : C.log, .15); }, 7);
  TEX.logTop = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); s(x, y, d > 6.5 ? C.logD : Math.floor(d) % 2 ? [150, 112, 70] : [176, 136, 86], .08); } }, 8);
  TEX.leaf = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = R(); s(x, y, y < 4 && r < .55 ? C.snow : r < .2 ? [28, 50, 34] : C.leaf, .2); } }, 9);
  TEX.ice = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, (x + y) % 11 === 0 || (x - y + 16) % 13 === 0 ? [205, 228, 255] : C.ice, .06); }, 10);
  TEX.water = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, (y + (x >> 2)) % 6 === 0 ? [92, 140, 236] : C.water, .08); }, 11);
  TEX.plank = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, y % 4 === 3 || (x === (y >> 2) * 5 % 16) ? [80, 56, 32] : C.plank, .12); }, 12);
  TEX.gravel = px((s, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, R() < .3 ? [96, 90, 86] : R() < .2 ? [160, 154, 150] : C.gravel, .15); }, 13);
  TEX.lantern = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const inner = x > 3 && x < 12 && y > 3 && y < 13; s(x, y, inner ? (x > 5 && x < 10 && y > 5 && y < 11 ? [255, 236, 160] : [255, 176, 70]) : [60, 60, 70], .05); } }, 14);
  TEX.blue = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, [44, 116, 214], .06); }, 15);
  TEX.red = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, [196, 52, 52], .06); }, 16);
  TEX.packed = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, [160, 190, 236], .1); }, 17);
  TEX.cloud = px(s => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s(x, y, [255, 255, 255], 0); }, 18);
  return TEX;
}
const MAT = {};
function lam(name) { return MAT[name] || (MAT[name] = new THREE.MeshLambertMaterial({ map: makeTextures()[name] })); }
// 블록 종류: [옆, 위, 아래] 텍스처
const BLOCKS = {
  grass: ['snowSide', 'snow', 'dirt'], dirt: ['dirt', 'dirt', 'dirt'], stone: ['stone', 'stone', 'stone'], cobble: ['cobble', 'cobble', 'cobble'],
  brick: ['brick', 'brick', 'brick'], snow: ['snow', 'snow', 'snow'], log: ['logSide', 'logTop', 'logTop'], leaf: ['leaf', 'leaf', 'leaf'],
  gravel: ['gravel', 'gravel', 'gravel'], plank: ['plank', 'plank', 'plank'], blue: ['blue', 'blue', 'blue'], red: ['red', 'red', 'red'], packed: ['packed', 'packed', 'packed'], ice: ['ice', 'ice', 'ice']
};
function blockMats(type) { const [s, t, b] = BLOCKS[type]; const S = lam(s); if (s === t && t === b) return S; return [S, S, lam(t), lam(b), S, S]; }

/* ---------- 노이즈 ---------- */
function noise2(seed) {
  const R = seeded(seed), N = 64, g = []; for (let i = 0; i < N * N; i++) g.push(R());
  const at = (x, y) => g[((y % N + N) % N) * N + ((x % N + N) % N)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi); const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}

/* ---------- 월드 생성 ---------- */
// 좌표: 블록 1칸 = 월드 1 = 게임 100. 길 윗면 y=0, 길은 z 3~11, x 0~60
export function buildBlockWorld(scene, L, teamColors) {
  const R = seeded(42), n1 = noise2(7), n2 = noise2(19);
  const cells = new Map(); // "x,y,z" -> type
  const put = (x, y, z, t) => cells.set(x + ',' + y + ',' + z, t);
  const WATER = -6, X0 = -18, X1 = Math.ceil(L) + 18, Z0 = -26, Z1 = 28;
  const H = new Map();
  const baseZone = x => x <= 8 || x >= L - 8;
  // 1) 지형 높이
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    let h;
    if (z >= 3 && z <= 11 && x >= -1 && x <= L + 1) h = 0; // 길
    else if (baseZone(x) && z >= -4 && z <= 18) h = 0; // 기지 광장
    else if ((z >= -3 && z <= 2) || (z >= 12 && z <= 17)) h = WATER; // 협곡 (물)
    else { const d = z < 3 ? -4 - z : z - 18; h = Math.floor(n1(x * .12, z * .12) * 4 + n2(x * .05, z * .05) * 5 + Math.min(4, d * .35)) - 1; if (x < -4 || x > L + 4) h = Math.max(h, Math.floor(n1(x * .1, z * .1) * 3)); }
    H.set(x + ',' + z, h);
  }
  const hAt = (x, z) => H.has(x + ',' + z) ? H.get(x + ',' + z) : 0;
  // 2) 블록 쌓기 (보이는 면이 있는 깊이까지만)
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const h = hAt(x, z), lane = z >= 3 && z <= 11 && x >= -1 && x <= L + 1, plaza = !lane && baseZone(x) && z >= -4 && z <= 18;
    const minN = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1), h);
    const bottom = Math.min(h - 1, minN) - (h === WATER ? 1 : 0);
    for (let y = h - 1; y >= bottom; y--) {
      let t;
      if (lane) t = y === h - 1 ? (R() < .16 ? 'cobble' : R() < .06 ? 'snow' : 'brick') : 'brick';
      else if (plaza) t = y === h - 1 ? (R() < .25 ? 'snow' : 'cobble') : 'stone';
      else if (h === WATER) t = 'gravel';
      else t = y === h - 1 ? 'grass' : y >= h - 3 ? 'dirt' : 'stone';
      put(x, y, z, t);
    }
  }
  // 3) 기지: 팀 색 블록 원, 분수 자리
  const fx = [1.7, L - 1.7];
  for (let t = 0; t < 2; t++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.hypot(x, z); if (d <= 2.2) put(Math.round(fx[t]) + x, -1, 7 + z, t ? 'red' : 'blue'); else if (d <= 3.2) put(Math.round(fx[t]) + x, -1, 7 + z, 'packed'); }
  // 4) 가문비나무
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(X0 + R() * (X1 - X0)), z = R() < .5 ? Math.floor(Z0 + R() * (-6 - Z0)) : Math.floor(20 + R() * (Z1 - 20));
    const h = hAt(x, z); if (h <= WATER) continue; const th = 4 + Math.floor(R() * 3);
    for (let y = h; y < h + th; y++) put(x, y, z, 'log');
    const top = h + th;
    for (let ly = 0; ly < 5; ly++) { const r = ly === 4 ? 0 : ly % 2 === 0 ? 2 : 1; const yy = top - 3 + ly; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; if (dx === 0 && dz === 0 && yy < top) continue; put(x + dx, yy, z + dz, 'leaf'); } }
  }
  // 5) 인스턴스 메시로 만들기
  const byType = {}; for (const [k, t] of cells) (byType[t] || (byType[t] = [])).push(k);
  const box = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), group = new THREE.Group();
  for (const [t, list] of Object.entries(byType)) {
    const im = new THREE.InstancedMesh(box, blockMats(t), list.length);
    list.forEach((k, i) => { const [x, y, z] = k.split(',').map(Number); m4.makeTranslation(x, y + .5, z); im.setMatrixAt(i, m4); });
    im.frustumCulled = false; group.add(im);
  }
  scene.add(group);
  // 6) 물, 얼음 조각
  const wt = makeTextures().water.clone(); wt.needsUpdate = true; wt.repeat.set(L + 40, 6);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(L + 40, 6), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: .88 })); water.rotation.x = -Math.PI / 2;
  const w2 = water.clone(); water.position.set(L / 2, WATER + .7, -.5); w2.position.set(L / 2, WATER + .7, 14.5); scene.add(water, w2);
  const iceG = new THREE.BoxGeometry(1, .15, 1), ice = new THREE.InstancedMesh(iceG, lam('ice'), 60);
  for (let i = 0; i < 60; i++) { const x = 9 + Math.floor(R() * (L - 18)), z = R() < .5 ? -3 + Math.floor(R() * 6) : 12 + Math.floor(R() * 6); m4.makeTranslation(x, WATER + .75, z); ice.setMatrixAt(i, m4); }
  scene.add(ice);
  // 7) 길 가장자리 돌담 + 등불
  const wallG = new THREE.BoxGeometry(1, .5, .36), postG = new THREE.BoxGeometry(.28, 1.1, .28), lampG = new THREE.BoxGeometry(.36, .4, .36);
  const nW = Math.floor(L - 14) + 1, walls = new THREE.InstancedMesh(wallG, lam('cobble'), nW * 2); let wi = 0;
  const posts = [], lamps = [];
  for (const z of [2.68, 11.32]) for (let x = 7; x <= L - 7; x++) { m4.makeTranslation(x, .25, z); walls.setMatrixAt(wi++, m4); if (x % 4 === 3) { posts.push([x, .55, z]); lamps.push([x, 1.3, z]); } }
  walls.count = wi; scene.add(walls);
  const postM = new THREE.InstancedMesh(postG, lam('logSide'), posts.length); posts.forEach((p, i) => { m4.makeTranslation(...p); postM.setMatrixAt(i, m4); }); scene.add(postM);
  const lampMat = new THREE.MeshBasicMaterial({ map: makeTextures().lantern });
  const lampM = new THREE.InstancedMesh(lampG, lampMat, lamps.length); lamps.forEach((p, i) => { m4.makeTranslation(...p); lampM.setMatrixAt(i, m4); }); scene.add(lampM);
  // 8) 구름 (평평한 흰 블록)
  const cloudG = new THREE.BoxGeometry(1, 1, 1), cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false });
  const clouds = new THREE.InstancedMesh(cloudG, cloudM, 40); const cl = [];
  for (let i = 0; i < 40; i++) { const sx = 4 + R() * 9, sz = 3 + R() * 6; cl.push({ x: -40 + R() * (L + 80), z: -40 + R() * 70, sx, sz }); }
  scene.add(clouds);
  const updateClouds = (t) => { cl.forEach((c, i) => { const x = ((c.x + t * .6 + 60) % (L + 120)) - 60; m4.makeScale(c.sx, .8, c.sz).setPosition(x, 22, c.z); clouds.setMatrixAt(i, m4); }); clouds.instanceMatrix.needsUpdate = true; };
  updateClouds(0);
  return { water: [wt], lampPos: lamps, update: (t, dt) => { wt.offset.x += dt * .15; updateClouds(t); } };
}
