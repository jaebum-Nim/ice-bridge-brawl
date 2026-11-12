// 마인크래프트 기본 스타일 블록 맵 (다리 + 기지만, 주변 지형 없음)
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
  const R = seeded(42);
  const cells = new Map(); // "x,y,z" -> type
  const put = (x, y, z, t) => cells.set(x + ',' + y + ',' + z, t);
  const X0 = -6, X1 = Math.ceil(L) + 6, Z0 = -2, Z1 = 16;
  const H = new Map();
  const baseZone = x => x <= 8 || x >= L - 8;
  // 1) 맵(다리 + 양쪽 기지)만 만들고 주변 지형·나무·물은 만들지 않음 (그릴 블록 수를 줄여 성능 확보)
  const inMap = (x, z) => (z >= 3 && z <= 11 && x >= -1 && x <= L + 1) || (baseZone(x) && x >= -4 && x <= L + 4 && z >= 0 && z <= 14);
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) if (inMap(x, z)) H.set(x + ',' + z, 0);
  const DEPTH = 3; // 가장자리는 3칸 두께의 벽으로 보이게
  const hAt = (x, z) => H.has(x + ',' + z) ? H.get(x + ',' + z) : -DEPTH;
  // 2) 블록 쌓기 (보이는 면이 있는 깊이까지만)
  for (const k of H.keys()) {
    const [x, z] = k.split(',').map(Number), h = 0, lane = z >= 3 && z <= 11;
    const minN = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1), h);
    for (let y = h - 1; y >= Math.min(h - 1, minN); y--) {
      const t = lane ? (y === h - 1 ? (R() < .16 ? 'cobble' : R() < .06 ? 'snow' : 'brick') : 'brick') : (y === h - 1 ? (R() < .25 ? 'snow' : 'cobble') : 'stone');
      put(x, y, z, t);
    }
  }
  // 3) 기지: 팀 색 블록 원, 분수 자리
  const fx = [1.7, L - 1.7];
  for (let t = 0; t < 2; t++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.hypot(x, z); if (d <= 2.2) put(Math.round(fx[t]) + x, -1, 7 + z, t ? 'red' : 'blue'); else if (d <= 3.2) put(Math.round(fx[t]) + x, -1, 7 + z, 'packed'); }
  // 5) 인스턴스 메시로 만들기
  const byType = {}; for (const [k, t] of cells) (byType[t] || (byType[t] = [])).push(k);
  const box = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), group = new THREE.Group();
  for (const [t, list] of Object.entries(byType)) {
    const im = new THREE.InstancedMesh(box, blockMats(t), list.length);
    list.forEach((k, i) => { const [x, y, z] = k.split(',').map(Number); m4.makeTranslation(x, y + .5, z); im.setMatrixAt(i, m4); });
    im.frustumCulled = false; group.add(im);
  }
  scene.add(group);
  // 7) 길 가장자리 돌담 + 등불
  const wallG = new THREE.BoxGeometry(1, .5, .36), postG = new THREE.BoxGeometry(.28, 1.1, .28), lampG = new THREE.BoxGeometry(.36, .4, .36);
  const nW = Math.floor(L - 14) + 1, walls = new THREE.InstancedMesh(wallG, lam('cobble'), nW * 2); let wi = 0;
  const posts = [], lamps = [];
  for (const z of [2.68, 11.32]) for (let x = 7; x <= L - 7; x++) { m4.makeTranslation(x, .25, z); walls.setMatrixAt(wi++, m4); if (x % 4 === 3) { posts.push([x, .55, z]); lamps.push([x, 1.3, z]); } }
  walls.count = wi; scene.add(walls);
  const postM = new THREE.InstancedMesh(postG, lam('logSide'), posts.length); posts.forEach((p, i) => { m4.makeTranslation(...p); postM.setMatrixAt(i, m4); }); scene.add(postM);
  const lampMat = new THREE.MeshBasicMaterial({ map: makeTextures().lantern });
  const lampM = new THREE.InstancedMesh(lampG, lampMat, lamps.length); lamps.forEach((p, i) => { m4.makeTranslation(...p); lampM.setMatrixAt(i, m4); }); scene.add(lampM);
  return { lampPos: lamps, update: () => { } };
}

/* ---------- 협곡 월드: 맵 격자(1칸 = 블록 1개)로부터 생성 ---------- */
// 칸 종류: 0 벽(눈 덮인 숲), 1 라인(돌길), 2 정글 길(눈밭), 3 강(얼음), 4 기지
export function buildRiftWorld(scene, M) {
  const R = seeded(7), N = M.N, g = M.grid, at = (x, z) => x < 0 || z < 0 || x >= N || z >= N ? 0 : g[z * N + x];
  const lists = {}; const put = (t, x, y, z) => (lists[t] || (lists[t] = [])).push(x, y, z);
  const nz = noise2(3);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const t = at(x, z), cx = x + .5, cz = z + .5;
    if (t === 0) {
      put('grass', cx, -1, cz);
      // 길에서 가까운 벽은 낮게 (카메라 쪽으로 영웅을 가리지 않게), 깊은 숲은 높게
      let near = 9; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (at(x + dx, z + dz)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dz)));
      const n = nz(x * .35, z * .35);
      if (near === 1) put(R() < .2 ? 'log' : 'leaf', cx, 0, cz);
      else if (near === 2) { put('log', cx, 0, cz); put('leaf', cx, 1, cz); }
      else { put('log', cx, 0, cz); put('leaf', cx, 1, cz); put('leaf', cx, 2, cz); if (n > .6) put('leaf', cx, 3, cz); }
    } else if (t === 1) put(R() < .2 ? 'gravel' : R() < .12 ? 'snow' : 'cobble', cx, -1, cz);
    else if (t === 2) put(R() < .1 ? 'gravel' : 'grass', cx, -1, cz);
    else if (t === 3) put('ice', cx, -1, cz);
    else put('packed', cx, -1, cz);
  }
  // 기지: 분수대 팀 색 원
  M.fountain.forEach((f, t) => { const fx = f.x / 100, fz = f.y / 100; for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d = Math.hypot(x, z); if (d <= 2.6) put(t ? 'red' : 'blue', Math.floor(fx) + x + .5, -.98, Math.floor(fz) + z + .5); } });
  const box = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), group = new THREE.Group();
  for (const [t, a] of Object.entries(lists)) {
    const n = a.length / 3, im = new THREE.InstancedMesh(box, blockMats(t), n);
    for (let i = 0; i < n; i++) { m4.makeTranslation(a[i * 3], a[i * 3 + 1] + .5, a[i * 3 + 2]); im.setMatrixAt(i, m4); }
    im.frustumCulled = false; group.add(im);
  }
  // 맵 바깥 바닥 (빈 공간이 보이지 않게)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(N + 120, N + 120), new THREE.MeshLambertMaterial({ color: 0xe9f0f8 })); floor.rotation.x = -Math.PI / 2; floor.position.set(N / 2, -1.01, N / 2); group.add(floor);
  scene.add(group);
  return { group, update: () => { } };
}
