// 영웅 3D 모델 (코드로 생성)
// - 관절 뼈대: 골반 → 척추 → 머리/어깨 → 팔꿈치 → 손, 골반 → 허벅지 → 무릎
// - 뼈대마다 부품을 한 덩어리로 합쳐(정점 색) 그리기 호출을 줄임
// - 카툰 셰이딩(MeshToonMaterial) + 외곽선(뒷면 확장)으로 애니메이션 같은 그림체
import * as THREE from 'three';
import { glowSprite } from './models.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SKIN = 0xf1c9a5, DARK = 0x1d2028;

/* ---------- 공유 재질 ---------- */
let GRAD = null, OUTLINE = null;
function gradient() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; return GRAD;
}
function outlineMat() {
  if (OUTLINE) return OUTLINE;
  OUTLINE = new THREE.MeshBasicMaterial({ color: 0x15171d, side: THREE.BackSide });
  OUTLINE.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normal * 0.016;'); };
  return OUTLINE;
}

/* ---------- 지오메트리 도우미 ---------- */
const G_ = {
  sph: (r, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h),
  cyl: (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 14) => new THREE.ConeGeometry(r, h, s),
  tor: (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  // 점 순서가 위→아래면 면이 뒤집히므로 항상 아래→위로 정렬
  lathe: (pts, s = 20) => { if (pts[0][1] > pts[pts.length - 1][1]) pts = pts.slice().reverse(); return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s); },
  tube: (pts, r, s = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), s, r, 8, false),
  extrude: (shape, depth, bevel = .01) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g; },
};
// 부품: [지오메트리, 색, 위치, 회전, 크기]
function P(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
  return { geo, color: new THREE.Color(color), m };
}
function merge(parts) {
  const pos = [], nor = [], col = [], idx = []; let off = 0;
  for (const p of parts) {
    let g = p.geo.clone(); g.applyMatrix4(p.m);
    if (!g.index) { const n = g.attributes.position.count, a = new Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(a); }
    const P_ = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P_.count; i++) { pos.push(P_.getX(i), P_.getY(i), P_.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(p.color.r, p.color.g, p.color.b); }
    for (const i of g.index.array) idx.push(i + off); off += P_.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeBoundingSphere(); return g;
}

/* ---------- 기본 체형 ---------- */
const BONES = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'cape'];
function skeleton() {
  const B = {}; for (const n of BONES) B[n] = new THREE.Group();
  B.hips.position.set(0, .98, 0);
  B.spine.position.set(0, .05, 0); B.hips.add(B.spine);
  B.head.position.set(0, .74, 0); B.spine.add(B.head);
  for (const [s, k] of [[-1, 'L'], [1, 'R']]) {
    B['shoulder' + k].position.set(0, .47, .25 * s); B.spine.add(B['shoulder' + k]);
    B['elbow' + k].position.set(0, -.3, 0); B['shoulder' + k].add(B['elbow' + k]);
    B['hand' + k].position.set(0, -.29, 0); B['elbow' + k].add(B['hand' + k]);
    B['thigh' + k].position.set(0, -.04, .1 * s); B.hips.add(B['thigh' + k]);
    B['knee' + k].position.set(0, -.43, 0); B['thigh' + k].add(B['knee' + k]);
  }
  B.cape.position.set(-.13, .52, 0); B.spine.add(B.cape);
  return B;
}
// 기본 몸 부품 (영웅별로 색/두께를 바꿔 씀)
function baseBody(L, o) {
  const c = o.colors;
  const torso = G_.lathe([[.001, 0], [.15, 0], [.165, .08], [.152, .2], [.2, .38], [.222, .46], [.17, .55], [.07, .6], [.001, .6]]);
  L.hips.push(P(G_.sph(.155), c.pants, [0, 0, 0], [0, 0, 0], [.95 * o.bulk, .72, 1.2 * o.bulk]));
  L.spine.push(P(torso, c.body, [0, 0, 0], [0, 0, 0], [.74 * o.bulk, 1, 1 * o.bulk]));
  L.spine.push(P(G_.cyl(.055, .06, .12), SKIN, [0, .62, 0]));
  L.head.push(P(G_.sph(.155), SKIN, [0, .02, 0], [0, 0, 0], [1, 1.08, .96]));
  if (!o.noEyes) for (const s of [-1, 1]) L.head.push(P(G_.sph(.022, 8, 6), 0x1b1d26, [.142, .03, .055 * s], [0, 0, 0], [.5, 1.2, 1]));
  for (const k of ['L', 'R']) {
    L['shoulder' + k].push(P(G_.sph(.07), c.arm, [0, -.01, 0]));
    L['shoulder' + k].push(P(G_.cyl(.062 * o.bulk, .05 * o.bulk, .3), c.arm, [0, -.15, 0]));
    L['elbow' + k].push(P(G_.sph(.05), c.arm, [0, 0, 0]));
    L['elbow' + k].push(P(G_.cyl(.05 * o.bulk, .043 * o.bulk, .27), c.fore || c.arm, [0, -.135, 0]));
    L['hand' + k].push(P(G_.sph(.052), c.hand || SKIN, [0, -.02, 0], [0, 0, 0], [1, 1.2, .8]));
    L['thigh' + k].push(P(G_.cyl(.085 * o.bulk, .062 * o.bulk, .43), c.pants, [0, -.215, 0]));
    L['knee' + k].push(P(G_.sph(.06), c.boots, [0, 0, 0]));
    L['knee' + k].push(P(G_.cyl(.062 * o.bulk, .048 * o.bulk, .4), c.boots, [0, -.2, 0]));
    L['knee' + k].push(P(G_.sph(.075), c.boots, [.045, -.42, 0], [0, 0, 0], [1.7, .75, 1.05]));
  }
}
const cape = (L, color, h = .8, w = .48, d = .035) => { L.cape.push(P(G_.box(d, h, w), color, [-.01, -h / 2, 0])); L.cape.push(P(G_.box(d * 1.4, .06, w * 1.02), color, [0, -h + .03, 0])); };

/* ---------- 영웅별 디자인 ---------- */
const DESIGN = {
  graff(L, tc, glow) {
    const steel = 0x8d99ab, dk = 0x3b4352, gold = 0xc9a34a;
    baseBody(L, { bulk: 1.22, colors: { body: steel, pants: dk, arm: steel, fore: dk, boots: dk, hand: dk } });
    L.spine.push(P(G_.sph(.21), steel, [.07, .33, 0], [0, 0, 0], [.55, .75, 1.15]));
    L.spine.push(P(G_.tor(.19, .035), dk, [0, .02, 0], [Math.PI / 2, 0, 0], [.8, 1.25, 1]));
    L.spine.push(P(G_.sph(.035), gold, [.17, .02, 0]));
    // 투구
    L.head.push(P(G_.sph(.178), steel, [-.005, .03, 0], [0, 0, 0], [1, 1.05, 1]));
    L.head.push(P(G_.box(.2, .05, .04), tc, [-.02, .21, 0]));
    L.head.push(P(G_.box(.06, .2, .3), steel, [.15, -.04, 0], [0, 0, .1]));
    glow('head', G_.box(.02, .028, .2), 0x67e8f9, [.183, .02, 0]);
    // 거대한 어깨 갑옷
    for (const k of ['L', 'R']) {
      const s = k === 'L' ? -1 : 1;
      L['shoulder' + k].push(P(G_.sph(.15, 16, 10, 0), steel, [0, .04, .02 * s], [0, 0, 0], [1.05, .78, 1.05]));
      L['shoulder' + k].push(P(G_.tor(.135, .022), tc, [0, -.02, .02 * s], [Math.PI / 2, 0, 0]));
      L['hand' + k].push(P(G_.sph(.1), dk, [0, -.04, 0], [0, 0, 0], [1.15, 1.05, 1]));
      L['elbow' + k].push(P(G_.cyl(.08, .095, .16), steel, [0, -.2, 0]));
    }
    for (let i = 0; i < 4; i++) L.elbowR.push(P(G_.tor(.05, .013, 6, 12), 0xa9b1bd, [0, -.05 - i * .06, 0], [i % 2 ? Math.PI / 2 : 0, i % 2 ? 0 : Math.PI / 2, 0]));
    L.spine.push(P(G_.tor(.13, .03, 6, 16), 0xa9b1bd, [-.2, .2, 0], [0, Math.PI / 2, 0]));
    cape(L, tc, .78, .5, .04);
    return { style: 'punch', scale: 1.04 };
  },
  solin(L, tc, glow, R) {
    const cream = 0xf4ead0, gold = 0xd4a83a, hair = 0xf6dc8a;
    baseBody(L, { bulk: .95, colors: { body: cream, pants: cream, arm: cream, boots: gold } });
    // 로브 (허리에서 발목까지 퍼짐)
    L.hips.push(P(G_.lathe([[.15, .06], [.19, -.2], [.27, -.55], [.36, -.88], [.001, -.88]], 22), cream, [0, 0, 0], [0, 0, 0], [.95, 1, 1.05]));
    L.hips.push(P(G_.tor(.355, .025, 6, 28), gold, [0, -.87, 0], [Math.PI / 2, 0, 0], [.95, 1.05, 1]));
    L.hips.push(P(G_.tor(.16, .03), gold, [0, .05, 0], [Math.PI / 2, 0, 0]));
    L.spine.push(P(G_.tor(.1, .035), gold, [0, .57, 0], [Math.PI / 2, 0, 0]));
    for (const k of ['L', 'R']) { L['elbow' + k].push(P(G_.cyl(.05, .11, .22, 16), cream, [0, -.17, 0])); L['shoulder' + k].push(P(G_.sph(.085), gold, [0, .02, 0], [0, 0, 0], [1, .7, 1])); }
    // 머리카락
    L.head.push(P(G_.sph(.168), hair, [-.025, .04, 0], [0, 0, 0], [1, 1.06, 1.03]));
    L.head.push(P(G_.cyl(.13, .05, .55, 14), hair, [-.11, -.25, 0], [0, 0, -.18]));
    L.head.push(P(G_.sph(.06), hair, [.1, .1, .1])); L.head.push(P(G_.sph(.06), hair, [.1, .1, -.1]));
    R.halo = glow('head', G_.tor(.16, .015, 6, 28), 0xfff3a0, [0, .3, 0], [Math.PI / 2, 0, 0]);
    // 지팡이: 초승달 머리 + 떠 있는 구슬
    L.handR.push(P(G_.cyl(.022, .022, 1.7, 8), 0x8a6a2a, [0, .2, 0]));
    L.handR.push(P(G_.tor(.13, .022, 6, 18, Math.PI * 1.4), gold, [0, 1.12, 0], [0, Math.PI / 2, -Math.PI * .2]));
    R.orb = glow('handR', G_.sph(.075), 0xfff08a, [0, 1.1, 0]); R.orb.add(glowSprite(0xfff08a, .8, .7));
    cape(L, tc, .55, .4, .03);
    return { style: 'staff', scale: 1 };
  },
  kaira(L, tc, glow) {
    const green = 0x4f7d2c, leather = 0x7a5230, dk = 0x33421e, hair = 0x5a3a20;
    baseBody(L, { bulk: .92, colors: { body: green, pants: leather, arm: green, fore: leather, boots: 0x4a3218 } });
    L.spine.push(P(G_.tor(.165, .025), leather, [0, .04, 0], [Math.PI / 2, 0, 0], [.75, 1.05, 1]));
    L.spine.push(P(G_.box(.03, .5, .04), leather, [.11, .3, 0], [.6, 0, 0]));
    // 후드
    L.head.push(P(G_.sph(.2, 18, 12), dk, [-.04, .04, 0], [0, 0, 0], [1, 1.04, 1.05]));
    L.head.push(P(G_.cone(.12, .22, 12), dk, [-.18, .07, 0], [0, 0, Math.PI / 2 + .5]));
    L.head.push(P(G_.sph(.15), SKIN, [.045, .0, 0], [0, 0, 0], [.95, 1.02, .9]));
    for (const s of [-1, 1]) L.head.push(P(G_.sph(.02, 8, 6), 0x1b1d26, [.172, .02, .05 * s], [0, 0, 0], [.5, 1.2, 1]));
    // 화살통
    L.spine.push(P(G_.cyl(.065, .055, .5, 12), leather, [-.2, .3, .08], [.35, 0, .25]));
    for (let i = 0; i < 4; i++) L.spine.push(P(G_.cone(.03, .1, 6), 0xf5f5f4, [-.27 + i * .005, .58, .03 + i * .035], [.35, 0, .25]));
    // 활: 손 좌표계에서 앞(+X) 방향으로 축, 겨눌 때 세로가 됨
    L.handL.push(P(G_.tube([[-.62, -.03, 0], [-.35, -.16, 0], [0, -.07, 0], [.35, -.16, 0], [.62, -.03, 0]], .02, 30), 0x5b3a1e));
    L.handL.push(P(G_.cyl(.004, .004, 1.24, 4), 0xeeeeee, [0, -.03, 0], [0, 0, Math.PI / 2]));
    for (const x of [-.62, .62]) L.handL.push(P(G_.sph(.025), 0xd4a83a, [x, -.03, 0]));
    cape(L, tc, .9, .5, .035);
    return { style: 'bow', scale: .98 };
  },
  valkan(L, tc, glow) {
    const gold = 0xd18a24, dk = 0x5a3a12, fur = 0xe8dcc8, steel = 0xdfe3e8;
    baseBody(L, { bulk: 1.12, colors: { body: gold, pants: dk, arm: gold, fore: dk, boots: dk, hand: dk } });
    L.spine.push(P(G_.tor(.16, .075, 8, 18), fur, [0, .5, 0], [Math.PI / 2, 0, 0], [.85, 1.1, 1]));
    L.spine.push(P(G_.sph(.2), gold, [.07, .3, 0], [0, 0, 0], [.55, .7, 1.1]));
    L.hips.push(P(G_.lathe([[.17, .05], [.2, -.1], [.24, -.3], [.001, -.3]], 16), dk, [0, 0, 0], [0, 0, 0], [.95, 1, 1.1]));
    // 뿔 투구
    L.head.push(P(G_.sph(.172), gold, [-.01, .04, 0], [0, 0, 0], [1, 1.02, 1]));
    L.head.push(P(G_.box(.05, .12, .26), dk, [.15, -.02, 0]));
    for (const s of [-1, 1]) L.head.push(P(G_.tube([[0, .1, .13 * s], [0, .22, .24 * s], [.04, .38, .28 * s], [.1, .46, .22 * s]], .028, 12), 0xf5f0e6));
    for (const k of ['L', 'R']) { const s = k === 'L' ? -1 : 1; L['shoulder' + k].push(P(G_.sph(.14), gold, [0, .04, .02 * s], [0, 0, 0], [1.05, .75, 1.05])); L['shoulder' + k].push(P(G_.cone(.04, .16, 8), steel, [0, .14, .06 * s], [.4 * s, 0, 0])); }
    // 대검: 손 좌표계에서 칼날이 앞쪽(+X)으로
    const sh = new THREE.Shape(); sh.moveTo(0, -.075); sh.lineTo(1.08, -.06); sh.lineTo(1.28, 0); sh.lineTo(1.08, .06); sh.lineTo(0, .075); sh.closePath();
    L.handR.push(P(G_.extrude(sh, .028), steel, [.12, -.03, 0], [Math.PI / 2, 0, 0]));
    L.handR.push(P(G_.box(.05, .045, .36), 0xfacc15, [.1, -.03, 0]));
    L.handR.push(P(G_.cyl(.024, .024, .22, 8), dk, [-.02, -.03, 0], [0, 0, Math.PI / 2]));
    L.handR.push(P(G_.sph(.035), 0xfacc15, [-.14, -.03, 0]));
    cape(L, tc, .82, .52, .04);
    return { style: 'slash', scale: 1.02 };
  },
  niya(L, tc, glow) {
    const blk = 0x2a1840, pur = 0x6b3fa0, steel = 0xe9d5ff;
    baseBody(L, { bulk: .9, colors: { body: blk, pants: blk, arm: blk, fore: pur, boots: 0x1a0f29, hand: pur }, noEyes: 1 });
    L.spine.push(P(G_.box(.03, .5, .05), pur, [.12, .3, 0], [-.6, 0, 0]));
    L.spine.push(P(G_.tor(.16, .03), pur, [0, .04, 0], [Math.PI / 2, 0, 0], [.75, 1.05, 1]));
    // 두건 + 마스크 + 빛나는 눈
    L.head.push(P(G_.sph(.185), pur, [-.03, .05, 0], [0, 0, 0], [1.02, 1.05, 1.02]));
    L.head.push(P(G_.cone(.1, .25, 10), pur, [-.18, .14, 0], [0, 0, Math.PI / 2 + .8]));
    L.head.push(P(G_.sph(.158), blk, [.03, -.02, 0], [0, 0, 0], [.95, .9, .92]));
    for (const s of [-1, 1]) glow('head', G_.box(.02, .022, .06), 0xf0abfc, [.18, .04, .055 * s]);
    // 목도리 (팀 색) + 휘날리는 꼬리는 망토 뼈대에
    L.spine.push(P(G_.tor(.1, .045, 8, 18), tc, [0, .56, 0], [Math.PI / 2, 0, 0]));
    L.cape.push(P(G_.box(.03, .75, .12), tc, [-.01, -.37, .08], [.12, 0, 0])); L.cape.push(P(G_.box(.03, .6, .12), tc, [-.01, -.3, -.08], [-.12, 0, 0]));
    // 쌍단검 (휘어진 칼날)
    const sh = new THREE.Shape(); sh.moveTo(0, -.03); sh.quadraticCurveTo(.3, -.06, .52, .07); sh.quadraticCurveTo(.28, .02, 0, .03); sh.closePath();
    for (const k of ['L', 'R']) { L['hand' + k].push(P(G_.extrude(sh, .015, .005), steel, [.05, -.03, 0], [Math.PI / 2, 0, 0])); L['hand' + k].push(P(G_.box(.04, .03, .12), pur, [.04, -.03, 0])); }
    return { style: 'slash2', scale: .96 };
  },
  tera(L, tc, glow, R) {
    const pink = 0xf2a7c6, green = 0x4c8a48, hair = 0x8a3f2a, wood = 0x6b4423;
    baseBody(L, { bulk: .93, colors: { body: green, pants: pink, arm: SKIN, fore: SKIN, boots: green } });
    L.hips.push(P(G_.lathe([[.15, .06], [.2, -.15], [.33, -.5], [.4, -.62], [.001, -.62]], 22), pink, [0, 0, 0], [0, 0, 0], [.95, 1, 1.05]));
    L.hips.push(P(G_.tor(.39, .03, 6, 28), green, [0, -.61, 0], [Math.PI / 2, 0, 0], [.95, 1.05, 1]));
    for (const k of ['L', 'R']) { const s = k === 'L' ? -1 : 1; for (let i = 0; i < 3; i++) L['shoulder' + k].push(P(G_.sph(.09), i % 2 ? 0x65a95c : green, [-.05 + i * .05, .05, .03 * s], [0, 0, .5 - i * .5], [1.4, .35, .8])); }
    // 머리카락 + 땋은 머리 + 꽃 왕관
    L.head.push(P(G_.sph(.168), hair, [-.03, .04, 0], [0, 0, 0], [1, 1.05, 1.04]));
    for (let i = 0; i < 5; i++) L.head.push(P(G_.sph(.05 - i * .005), hair, [-.13 - i * .012, -.1 - i * .085, .02]));
    L.head.push(P(G_.tor(.155, .02, 6, 22), green, [0, .11, 0], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; L.head.push(P(G_.sph(.035), i % 2 ? 0xfde047 : 0xf472b6, [Math.cos(a) * .155, .13, Math.sin(a) * .155])); }
    // 나뭇가지 지팡이 + 꽃
    L.handR.push(P(G_.tube([[0, -.5, 0], [.03, 0, .02], [-.02, .6, -.02], [.05, 1.0, 0]], .025, 20), wood));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; L.handR.push(P(G_.sph(.07), 0xf9a8d4, [.05 + Math.cos(a) * .09, 1.06, Math.sin(a) * .09], [0, 0, 0], [1, .45, 1])); }
    L.handR.push(P(G_.cone(.05, .14, 6), 0x65a95c, [-.02, .82, .06], [.6, 0, .4]));
    R.orb = glow('handR', G_.sph(.05), 0xfef08a, [.05, 1.08, 0]); R.orb.add(glowSprite(0xfbcfe8, .7, .6));
    cape(L, tc, .5, .38, .03);
    return { style: 'staff', scale: .97 };
  }
};

/* ---------- 빌드 ---------- */
export function buildHero(id, teamColor) {
  const B = skeleton(), L = {}; for (const n of BONES) L[n] = [];
  const R = { g: new THREE.Group(), B, phase: 0, mv: 0 };
  const glow = (bone, geo, color, pos, rot = [0, 0, 0]) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })); m.position.set(...pos); m.rotation.set(...rot); B[bone].add(m); return m; };
  const info = DESIGN[id](L, teamColor, glow, R);
  const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient() });
  const ol = outlineMat();
  for (const n of BONES) {
    if (!L[n].length) continue;
    const geo = merge(L[n]);
    B[n].add(new THREE.Mesh(geo, toon), new THREE.Mesh(geo, ol));
  }
  R.g.add(B.hips); R.g.scale.setScalar(info.scale || 1);
  R.mats = [toon]; R.style = info.style; R.hipY = .98;
  R.animate = (dt, s) => animate(R, dt, s);
  return R;
}

/* ---------- 애니메이션 ---------- */
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
function animate(R, dt, s) {
  const B = R.B;
  R.mv += ((s.moving ? 1 : 0) - R.mv) * Math.min(1, dt * 10); const m = R.mv;
  R.phase += s.moving ? s.speed * dt * .026 : 0; const p = R.phase, sw = Math.sin(p) * m;
  // 다리: 허벅지 앞뒤, 무릎은 뒤로 굽힘
  B.thighL.rotation.z = sw * .7; B.thighR.rotation.z = -sw * .7;
  B.kneeL.rotation.z = -Math.max(0, Math.sin(p - 1.3)) * 1.1 * m - .06;
  B.kneeR.rotation.z = -Math.max(0, Math.sin(p - 1.3 + Math.PI)) * 1.1 * m - .06;
  B.thighL.rotation.x = .04; B.thighR.rotation.x = -.04;
  // 골반, 척추
  const breathe = Math.sin(s.t * 2.2) * (1 - m);
  B.hips.position.y = R.hipY + Math.abs(Math.cos(p)) * .045 * m - .02 * m + breathe * .006;
  B.hips.rotation.y = -Math.sin(p) * .1 * m;
  B.spine.rotation.y = Math.sin(p) * .14 * m; B.spine.rotation.z = -.1 * m + breathe * .015; B.spine.rotation.x = 0;
  B.head.rotation.set(0, -B.spine.rotation.y * .6, .1 * m);
  // 팔 기본: 걸을 때 반대로 흔들고, 서 있을 땐 살짝 벌림
  let sR = -sw * .55, sL = sw * .55, eR = .2 + .35 * m, eL = .2 + .35 * m, oR = .14, oL = .14, twist = 0;
  const st = R.style;
  if (st === 'bow' && !s.moving) { sL = .25; eL = .35; }
  // 기본 공격
  if (s.atk >= 0) {
    const k = s.atk;
    if (st === 'slash' || st === 'slash2') {
      if (k < .4) { const q = k / .4; sR = lerp(sR, 2.7, q); eR = lerp(eR, .9, q); twist = -.45 * q; oR = .14 + .3 * q; }
      else if (k < .62) { const q = (k - .4) / .22; sR = lerp(2.7, -.35, q); eR = lerp(.9, .1, q); twist = lerp(-.45, .5, q); oR = lerp(.44, .1, q); }
      else { const q = (k - .62) / .38; sR = lerp(-.35, sR, q); eR = lerp(.1, eR, q); twist = lerp(.5, 0, q); }
      if (st === 'slash2') { sL = k < .5 ? lerp(sL, -.6, k * 2) : lerp(-.6, 2.2, (k - .5) * 2); eL = .6; }
    } else if (st === 'punch') {
      if (k < .45) { const q = k / .45; sR = lerp(sR, -.7, q); eR = lerp(eR, 1.6, q); twist = -.35 * q; }
      else if (k < .65) { const q = (k - .45) / .2; sR = lerp(-.7, 1.55, q); eR = lerp(1.6, .05, q); twist = lerp(-.35, .45, q); }
      else { const q = (k - .65) / .35; sR = lerp(1.55, sR, q); eR = lerp(.05, eR, q); twist = lerp(.45, 0, q); }
    } else if (st === 'bow') {
      sL = 1.55; eL = .05; oL = .05; twist = -.25;
      sR = 1.5; eR = k < .75 ? lerp(.4, 2.3, k / .75) : lerp(2.3, .6, (k - .75) / .25); oR = .05;
    } else { // staff
      if (k < .45) { const q = k / .45; sR = lerp(sR, 2.2, q); eR = lerp(eR, 1.2, q); }
      else { const q = (k - .45) / .55; sR = lerp(2.2, 1.0, Math.min(1, q * 2)); eR = lerp(1.2, .1, Math.min(1, q * 2)); if (q > .5) { sR = lerp(1.0, sR, (q - .5) * 2); } }
    }
  }
  // 스킬 시전
  if (s.cast >= 0) {
    const k = s.cast, up = Math.sin(Math.min(1, k) * Math.PI);
    if (st === 'bow') { sL = 1.55; sR = 1.5; eR = lerp(2.3, .5, k); eL = .05; twist = -.25; }
    else if (st === 'slash' || st === 'slash2' || st === 'punch') { sR = lerp(2.6, -.4, k); eR = .4; twist = lerp(-.4, .5, k); sL = Math.max(sL, up * 1.2); }
    else { sR = Math.max(sR, up * 2.7); eR = .25; sL = Math.max(sL, up * 2.0); eL = .4; oL = .14 + up * .5; }
  }
  // 돌진: 앞으로 숙이고 팔을 뒤로
  if (s.dash) { B.spine.rotation.z = -.55; sR = sL = -1; eR = eL = .3; B.thighL.rotation.z = .9; B.thighR.rotation.z = -.5; }
  // 기절: 고개 숙이고 비틀거림
  if (s.stun) { B.head.rotation.z = -.35 + Math.sin(s.t * 6) * .1; B.spine.rotation.z = -.2; sR = sL = -.15; }
  // 공중에 뜸: 몸을 젖힘
  if (s.air) { B.spine.rotation.z = .4; sR = 2.4; sL = 2.4; B.thighL.rotation.z = .5; B.thighR.rotation.z = -.2; }
  B.spine.rotation.y += twist;
  B.shoulderR.rotation.set(-oR, 0, sR); B.shoulderL.rotation.set(oL, 0, sL);
  B.elbowR.rotation.z = eR; B.elbowL.rotation.z = eL;
  // 지팡이는 손목으로 세워 들고, 공격할 땐 앞으로 기울여 찌름
  if (st === 'staff') { let tilt = .12; if (s.atk >= 0) tilt = .12 + Math.sin(Math.min(1, s.atk) * Math.PI) * 1.1; if (s.cast >= 0) tilt = .05; B.handR.rotation.z = -(sR + eR) - tilt; }
  else B.handR.rotation.z = 0;
  // 망토: 달릴수록 뒤로 날림
  B.cape.rotation.z = -(.08 + m * .55 + Math.sin(p * 2) * .07 * m + Math.sin(s.t * 1.7) * .035) - (s.dash ? .6 : 0);
  if (R.halo) R.halo.rotation.z += dt * 1.5;
  if (R.orb) R.orb.position.y += (1.1 + Math.sin(s.t * 3) * .04 - R.orb.position.y) * .2;
}
