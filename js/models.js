// 로우폴리 3D 모델 (모두 코드로 생성, 외부 에셋 없음)
import * as THREE from 'three';

export const K = 0.01; // 게임 좌표 1 = 0.01 월드 단위

let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.75)'); gr.addColorStop(.6, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace; return _glow;
}
export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}
export function mat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: .08, flatShading: true }, o)); }
export function emis(color, intensity = 2, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, emissive: color, emissiveIntensity: intensity, roughness: .3, flatShading: true }, o)); }
function M(geo, m, x = 0, y = 0, z = 0, shadow = true) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = shadow; return me; }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 7);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const sph = (r, w = 9, h = 7) => new THREE.SphereGeometry(r, w, h);
const cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

/* ---------- 영웅 ---------- */
// 정면 = +X, 오른쪽 = +Z
function rig(spec, teamColor) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const main = mat(spec.main, { metalness: spec.metal || .05, roughness: spec.metal ? .45 : .65 }), dark = mat(spec.dark), skin = mat(0xf2d3b8), team = mat(teamColor, { roughness: .8 });
  const mats = [main, dark, skin, team];
  const R = { g, body, mats, main, dark, skin, team };
  if (!spec.skirt) {
    for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(0, .52, .12 * s); leg.add(M(cap(.085, .3), dark, 0, -.24, 0)); leg.add(M(box(.2, .08, .13), dark, .04, -.48, 0)); body.add(leg); R[s < 0 ? 'legL' : 'legR'] = leg; }
  } else {
    const sk = M(cone(.38, .78, 9), main, 0, .4, 0); body.add(sk); R.skirt = sk;
    R.legL = new THREE.Group(); R.legR = new THREE.Group();
  }
  const torso = M(cap(.2, .3), main, 0, .9, 0); torso.scale.set(.85, 1, 1.05); body.add(torso); R.torso = torso;
  body.add(M(box(.34, .07, .44), dark, 0, .7, 0)); // 벨트
  const head = new THREE.Group(); head.position.set(0, 1.33, 0); head.add(M(sph(.16), skin)); body.add(head); R.head = head;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0, 1.12, .29 * s);
    arm.add(M(cap(.065, .28), main, 0, -.2, 0));
    const hand = new THREE.Group(); hand.position.set(0, -.42, 0); hand.add(M(sph(.07, 6, 5), skin)); arm.add(hand);
    body.add(arm); R[s < 0 ? 'armL' : 'armR'] = arm; R[s < 0 ? 'handL' : 'handR'] = hand;
  }
  // 망토 (팀 색)
  const capeG = new THREE.Group(); capeG.position.set(-.17, 1.2, 0);
  const cp = M(box(.03, .75, .46), team, 0, -.37, 0); capeG.add(cp); body.add(capeG); R.cape = capeG;
  return R;
}
const SPEC = {
  graff: { main: 0x9aa7ba, dark: 0x4a5466, metal: .3, scale: 1.12 },
  solin: { main: 0xf3e3a6, dark: 0xb88a2a, skirt: 1 },
  kaira: { main: 0x5f8a2c, dark: 0x33421e },
  valkan: { main: 0xe0952a, dark: 0x6b4516, metal: .25, scale: 1.05 },
  niya: { main: 0x5d3592, dark: 0x22143a },
  tera: { main: 0xeea0c4, dark: 0x4c8a48, skirt: 1 }
};
export function buildHero(id, teamColor) {
  const sp = SPEC[id], R = rig(sp, teamColor);
  const { head, handR, handL, body, main, dark } = R;
  if (id === 'graff') {
    head.add(M(box(.34, .3, .32), main, .01, .02, 0)); head.add(M(box(.04, .05, .24), emis(0x67e8f9, 3), .17, .02, 0, false));
    for (const s of [-1, 1]) { body.add(M(sph(.17, 7, 5), main, 0, 1.2, .3 * s)); }
    handR.add(M(box(.26, .24, .24), dark)); handL.add(M(box(.26, .24, .24), dark));
    const ch = M(new THREE.TorusGeometry(.2, .05, 5, 10), mat(0x9ca3af, { metalness: .8, roughness: .3 }), -.24, .95, 0); ch.rotation.y = Math.PI / 2; body.add(ch);
    R.weapon = handR;
  } else if (id === 'solin') {
    head.add(M(sph(.17, 9, 6), mat(0xfff2c2), -.03, .05, 0)); // 머리카락
    const halo = M(new THREE.TorusGeometry(.17, .022, 5, 18), emis(0xfff3a0, 3), 0, .3, 0, false); halo.rotation.x = Math.PI / 2; head.add(halo); R.halo = halo;
    const staff = new THREE.Group(); staff.add(M(cyl(.025, .025, 1.5, 6), dark, 0, .1, 0)); const orb = M(sph(.11, 10, 8), emis(0xfff08a, 4), 0, .9, 0, false); staff.add(orb); orb.add(glowSprite(0xfff08a, .9, .8)); staff.rotation.x = .15; handR.add(staff); R.weapon = staff; R.orb = orb;
  } else if (id === 'kaira') {
    head.add(M(cone(.2, .28, 8), dark, -.02, .14, 0));
    const bow = new THREE.Group(); const arc = M(new THREE.TorusGeometry(.42, .025, 4, 14, Math.PI), mat(0x7c4a1e)); arc.rotation.z = -Math.PI / 2; bow.add(arc);
    bow.add(M(cyl(.006, .006, .84, 3), emis(0xd9f99d, 2), -0, 0, 0, false)); bow.rotation.y = Math.PI / 2; bow.position.set(.08, 0, 0); handL.add(bow);
    const q = M(cyl(.07, .07, .5, 7), mat(0x7c4a1e), -.2, 1.0, -.1); q.rotation.x = .4; body.add(q);
    for (let i = 0; i < 3; i++) body.add(M(cone(.025, .08, 4), emis(0xbef264, 2), -.2, 1.3, -.1 + (i - 1) * .04, false));
    R.weapon = handR;
  } else if (id === 'valkan') {
    head.add(M(box(.32, .26, .3), main, 0, .03, 0));
    for (const s of [-1, 1]) { const h = M(cone(.05, .26, 5), mat(0xf5f5f4), 0, .2, .15 * s); h.rotation.x = -.5 * s; head.add(h); }
    for (const s of [-1, 1]) body.add(M(box(.2, .12, .22), main, 0, 1.22, .3 * s));
    const sw = new THREE.Group(); sw.add(M(box(.06, .22, .06), dark, 0, -.02, 0)); sw.add(M(box(.08, .06, .3), mat(0xfacc15, { metalness: .7, roughness: .3 }), 0, -.14, 0));
    const blade = M(box(.04, 1.05, .14), mat(0xe5e7eb, { metalness: .9, roughness: .2, emissive: 0xfbbf24, emissiveIntensity: .15 }), 0, -.7, 0); sw.add(blade);
    sw.rotation.z = Math.PI / 2 + .2; handR.add(sw); R.weapon = sw;
  } else if (id === 'niya') {
    const hood = M(cone(.22, .42, 7), main, -.03, .12, 0); head.add(hood);
    head.add(M(box(.03, .04, .18), emis(0xe9d5ff, 3), .15, 0, 0, false));
    const scarf = M(new THREE.TorusGeometry(.16, .05, 5, 10), R.team, 0, 1.17, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
    for (const h of [handR, handL]) { const dg = new THREE.Group(); const bl = M(cone(.035, .45, 4), mat(0xe9d5ff, { emissive: 0xc084fc, emissiveIntensity: 1.2, metalness: .7 }), 0, -.25, 0); bl.rotation.x = Math.PI; dg.add(bl); dg.rotation.z = Math.PI / 2; h.add(dg); }
    R.weapon = handR;
  } else if (id === 'tera') {
    head.add(M(sph(.17, 9, 6), mat(0x7c3a2e), -.04, .03, 0));
    const crown = M(new THREE.TorusGeometry(.16, .03, 4, 12), mat(0x4ade80), 0, .1, 0); crown.rotation.x = Math.PI / 2; head.add(crown);
    const staff = new THREE.Group(); staff.add(M(cyl(.025, .03, 1.4, 6), mat(0x6b4423), 0, .1, 0));
    const fl = new THREE.Group(); fl.position.y = .85; for (let i = 0; i < 5; i++) { const p = M(sph(.08, 6, 5), mat(0xf9a8d4, { emissive: 0xf472b6, emissiveIntensity: .8 }), Math.cos(i * 1.256) * .1, 0, Math.sin(i * 1.256) * .1, false); p.scale.y = .5; fl.add(p); }
    const ctr = M(sph(.06, 7, 5), emis(0xfde047, 3), 0, .02, 0, false); fl.add(ctr); fl.add(glowSprite(0xfbcfe8, .7, .6)); staff.add(fl); staff.rotation.x = .15; handR.add(staff); R.weapon = staff; R.orb = fl;
  }
  if (sp.scale) R.g.scale.setScalar(sp.scale);
  return R;
}

/* ---------- 미니언 (팀별 공유 재질) ---------- */
const minionMats = {};
function mm(team, tc) {
  if (minionMats[team]) return minionMats[team];
  const c = new THREE.Color(tc);
  return minionMats[team] = { body: mat(c.clone().multiplyScalar(.55)), trim: mat(c), metal: mat(0xb8c2cf, { metalness: .7, roughness: .35 }), orb: emis(c.getHex(), 3), wood: mat(0x6b4a2b) };
}
const MG = {};
function mg() {
  if (MG.ok) return MG; MG.ok = 1;
  MG.body = box(.3, .32, .3); MG.head = sph(.14, 7, 5); MG.sword = box(.04, .4, .06); MG.leg = box(.09, .18, .09);
  MG.robe = cone(.24, .55, 7); MG.orb = sph(.08, 7, 5); MG.cart = box(.65, .3, .45); MG.wheel = cyl(.14, .14, .06, 8); MG.cannon = cyl(.08, .11, .55, 8); MG.shield = box(.04, .26, .2);
  return MG;
}
export function buildMinion(kind, team, tc) {
  const m = mm(team, tc), G = mg(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const R = { g, body };
  if (kind === 'm') {
    body.add(M(G.body, m.body, 0, .38, 0)); body.add(M(G.head, m.trim, 0, .66, 0));
    const legL = M(G.leg, m.body, 0, .12, .08), legR = M(G.leg, m.body, 0, .12, -.08); body.add(legL, legR); R.legL = legL; R.legR = legR;
    const arm = new THREE.Group(); arm.position.set(0, .45, .2); const sw = M(G.sword, m.metal, .12, -.05, 0); sw.rotation.z = -1.2; arm.add(sw); body.add(arm); R.armR = arm;
    body.add(M(G.shield, m.trim, .1, .4, -.18));
  } else if (kind === 'c') {
    body.add(M(G.robe, m.body, 0, .3, 0)); body.add(M(G.head, m.trim, 0, .63, 0));
    const orb = M(G.orb, m.orb, .2, .6, .15, false); body.add(orb); orb.add(glowSprite(tc, .5, .7)); R.orb = orb;
  } else {
    body.add(M(G.cart, m.wood, 0, .32, 0));
    for (const sx of [-.22, .22]) for (const sz of [-.25, .25]) { const w = M(G.wheel, m.body, sx, .14, sz); w.rotation.x = Math.PI / 2; body.add(w); }
    const c = M(G.cannon, m.metal, .2, .55, 0); c.rotation.z = -Math.PI / 2 + .3; body.add(c);
    body.add(M(box(.02, .3, .18), m.trim, -.25, .7, 0));
  }
  return R;
}

/* ---------- 포탑 / 넥서스 ---------- */
export function buildTower(team, tc) {
  const g = new THREE.Group(), stone = mat(0x7d8ba1), dstone = mat(0x4b566b), trim = emis(tc, 1.6);
  g.add(M(cyl(.8, .95, .35, 8), dstone, 0, .17, 0));
  const shaft = M(cyl(.38, .5, 2.5, 8), stone, 0, 1.6, 0); g.add(shaft);
  for (const y of [.8, 1.7, 2.6]) { const r = M(new THREE.TorusGeometry(.47 - y * .03, .04, 5, 16), trim, 0, y, 0, false); r.rotation.x = Math.PI / 2; g.add(r); }
  g.add(M(cyl(.62, .45, .3, 8), dstone, 0, 2.95, 0));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(M(cone(.09, .5, 4), stone, Math.cos(a) * .5, 3.3, Math.sin(a) * .5)); }
  const crystal = M(new THREE.OctahedronGeometry(.34, 0), emis(tc, 1.6, { transparent: true, opacity: .95 }), 0, 3.6, 0, false); crystal.scale.y = 1.6; g.add(crystal);
  const glow = glowSprite(tc, 1.8, .45); glow.position.y = 3.6; g.add(glow);
  const rubble = new THREE.Group(); for (let i = 0; i < 9; i++) { const r = M(new THREE.DodecahedronGeometry(.18 + Math.random() * .2, 0), i % 3 ? stone : dstone, (Math.random() - .5) * 1.4, .12, (Math.random() - .5) * 1.4); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); rubble.add(r); } rubble.visible = false; g.add(rubble);
  const alive = g.children.filter(c => c !== rubble);
  return { g, crystal, glow, rubble, alive };
}
export function buildNexus(team, tc) {
  const g = new THREE.Group(), stone = mat(0x6b7890), dstone = mat(0x3d475a);
  g.add(M(cyl(1.35, 1.55, .5, 6), dstone, 0, .25, 0));
  g.add(M(cyl(1.0, 1.2, .35, 6), stone, 0, .65, 0));
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const p = M(box(.18, 1.1, .18), stone, Math.cos(a) * 1.15, 1.0, Math.sin(a) * 1.15); g.add(p); g.add(M(sph(.1, 6, 4), emis(tc, 3), Math.cos(a) * 1.15, 1.62, Math.sin(a) * 1.15, false)); }
  const cr = new THREE.Group(); cr.position.y = 2.1;
  const cm = emis(tc, 1.3, { transparent: true, opacity: .92 });
  const c0 = M(new THREE.OctahedronGeometry(.6, 0), cm, 0, 0, 0, false); c0.scale.y = 1.9; cr.add(c0);
  for (let i = 0; i < 3; i++) { const a = i * 2.09; const c = M(new THREE.OctahedronGeometry(.28, 0), cm, Math.cos(a) * .7, -.4, Math.sin(a) * .7, false); c.scale.y = 1.7; c.rotation.z = Math.cos(a) * .4; c.rotation.x = Math.sin(a) * .4; cr.add(c); }
  g.add(cr); const glow = glowSprite(tc, 3.5, .35); glow.position.y = 2.1; g.add(glow);
  const rubble = new THREE.Group(); for (let i = 0; i < 14; i++) { const r = M(new THREE.OctahedronGeometry(.15 + Math.random() * .3, 0), i % 2 ? cm : stone, (Math.random() - .5) * 2.4, .5, (Math.random() - .5) * 2.4); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); rubble.add(r); } rubble.visible = false; g.add(rubble);
  const alive = g.children.filter(c => c !== rubble);
  return { g, crystal: cr, glow, rubble, alive };
}
