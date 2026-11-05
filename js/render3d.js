// Three.js 3D 렌더러
import * as THREE from 'three';
import { buildBlockWorld } from './blocks.js';
import { K, glowTex, glowSprite, mat, emis, buildMinion, buildTower, buildNexus } from './models.js';
import { buildHero } from './heroes3d.js';
import { MAP_W, LANE_Y1, LANE_Y2, MID_Y, FOUNTAIN, TEAMC, clampPt, pickTarget } from './sim.js';

const W2 = (x) => x * K;
const UP = new THREE.Vector3(0, 1, 0);

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/* ---------- 파티클 ---------- */
class Particles {
  constructor(scene, n = 500) {
    this.pool = []; this.live = [];
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); this.pool.push(s); }
  }
  emit(x, y, z, o) {
    const s = this.pool.pop(); if (!s) return;
    s.visible = true; s.position.set(x, y, z); s.material.color.set(o.c || 0xffffff); s.material.opacity = o.a ?? 1; s.material.rotation = Math.random() * 6;
    const p = { s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 0, life: o.life || .6, t: 0, size: o.size || .3, grow: o.grow ?? 0, a: o.a ?? 1, drag: o.drag ?? 1 };
    s.scale.set(p.size, p.size, 1); this.live.push(p);
  }
  burst(x, y, z, n, o) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (.4 + Math.random() * .6), up = o.up ?? 2; this.emit(x, y, z, { ...o, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: up * (.3 + Math.random()), size: (o.size || .3) * (.6 + Math.random() * .8) }); } }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.t += dt; const k = p.t / p.life;
      if (k >= 1) { p.s.visible = false; this.pool.push(p.s); this.live.splice(i, 1); continue; }
      p.vy -= p.g * dt; const dr = Math.pow(p.drag, dt * 60); p.vx *= dr; p.vz *= dr; p.vy *= dr;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      if (p.s.position.y < .03) { p.s.position.y = .03; p.vy = 0; }
      const sz = p.size * (1 + p.grow * k); p.s.scale.set(sz, sz, 1); p.s.material.opacity = p.a * (1 - k) * (k < .1 ? k * 10 : 1);
    }
  }
}

/* ---------- 바닥 표시 ---------- */
const RING_G = new THREE.RingGeometry(.9, 1, 64); RING_G.rotateX(-Math.PI / 2);
const DISC_G = new THREE.CircleGeometry(1, 48); DISC_G.rotateX(-Math.PI / 2);
const PLANE_G = new THREE.PlaneGeometry(1, 1); PLANE_G.rotateX(-Math.PI / 2); PLANE_G.translate(.5, 0, 0);
function decal(geo, color, opacity, add = false) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide })); m.renderOrder = 2; return m; }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    // 셰이더 최소화: 톤매핑·그림자·후처리(빛 번짐) 없이 Lambert 조명 하나로 그림
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = false;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x9ec7ff); this.scene.fog = new THREE.Fog(0xbcd8ff, 26, 62);
    this.cam = new THREE.PerspectiveCamera(38, 1, .5, 200);
    this.ray = new THREE.Raycaster(); this.groundPlane = new THREE.Plane(UP, 0);
    this.quality = 'high'; this.shake = 0; this.camT = new THREE.Vector3(30, 0, 7);
    this.buildWorld();
    this.parts = new Particles(this.scene);
    this.views = new Map(); this.pviews = new Map(); this.zviews = new Map(); this.fxl = []; this.pools = {};
    this.geo = { arrow: new THREE.ConeGeometry(.05, .5, 5), bigArrow: new THREE.ConeGeometry(.35, 2.2, 6), chain: new THREE.OctahedronGeometry(.18, 0), snow: new THREE.SphereGeometry(.28, 10, 8), towerShot: new THREE.SphereGeometry(.2, 10, 8), orb: new THREE.SphereGeometry(.26, 12, 10), auto: new THREE.SphereGeometry(.09, 8, 6),
      spike: new THREE.ConeGeometry(.12, .9, 5), unitBox: new THREE.BoxGeometry(1, 1, 1), slash: new THREE.TorusGeometry(.55, .05, 4, 16, 2.4), sphere: new THREE.SphereGeometry(1, 24, 16), column: new THREE.CylinderGeometry(.6, .6, 3, 20, 1, true), swordBlade: new THREE.BoxGeometry(.25, 3.2, .7) };
    this.aim = this.buildAim();
    this.clickRing = decal(RING_G, 0x4ade80, 0); this.scene.add(this.clickRing); this.clickT = 9;
    this.towerRange = decal(RING_G, 0xff5a5a, 0); this.scene.add(this.towerRange);
    this.resize();
  }
  setQuality(q) { this.quality = q; this.resize(); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const pr = this.quality === 'high' ? Math.min(dpr, 1.5) : this.quality === 'mid' ? 1 : Math.min(1, dpr) * .75;
    this.r.setPixelRatio(pr); this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.W = w; this.H = h;
  }

  /* ---------- 월드 ---------- */
  buildWorld() {
    const S = this.scene, L = MAP_W * K, zm = MID_Y * K;
    S.add(new THREE.HemisphereLight(0xdbe9ff, 0x7a6a58, 1.9));
    const sun = new THREE.DirectionalLight(0xfff6e5, 1.7); sun.position.set(6, 14, 4); S.add(sun); S.add(sun.target); sun.target.position.set(0, 0, 0); this.sun = sun;
    this.world = buildBlockWorld(S, L, TEAMC);
    // 분수: 신호기처럼 위로 뻗는 빛 기둥 (단순 반투명 기둥)
    for (const t of [0, 1]) {
      const fx = FOUNTAIN[t].x * K, tc = new THREE.Color(TEAMC[t]);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.9, 30, .9), new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.set(fx, 15, zm); S.add(beam);
      const core = new THREE.Mesh(new THREE.BoxGeometry(.4, 30, .4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })); core.position.copy(beam.position); S.add(core);
    }
    this.relicMeshes = [];
  }
  buildAim() {
    const g = new THREE.Group(); g.visible = false; this.scene.add(g);
    const range = decal(RING_G, 0xffffff, .35); const line = decal(PLANE_G, 0xffffff, .18); const circ = decal(DISC_G, 0xffffff, .2); const circR = decal(RING_G, 0xffffff, .6);
    const coneG = new THREE.CircleGeometry(1, 24, -.38, .76); coneG.rotateX(-Math.PI / 2); const cone = decal(coneG, 0xffffff, .18);
    const tgt = decal(RING_G, 0xfde047, .9);
    g.add(range, line, circ, circR, cone, tgt); [range, line, circ, circR, cone, tgt].forEach(m => m.position.y = .04);
    return { g, range, line, circ, circR, cone, tgt };
  }

  blob(r) { const m = new THREE.Mesh(DISC_G, this.blobMat || (this.blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false }))); m.scale.setScalar(r); m.position.y = .02; m.renderOrder = 1; return m; }
  /* ---------- 좌표 ---------- */
  pick(sx, sy) {
    const v = new THREE.Vector2((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1); this.ray.setFromCamera(v, this.cam);
    const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.groundPlane, p)) return { x: 0, y: 0 };
    return { x: p.x / K, y: p.z / K };
  }
  pickAt(sx, sy, h) {
    const v = new THREE.Vector2((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1); this.ray.setFromCamera(v, this.cam);
    const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(new THREE.Plane(UP, -h), p)) return { x: 0, y: 0 };
    return { x: p.x / K, y: p.z / K };
  }
  project(x, y, h) { const v = new THREE.Vector3(x * K, h, y * K).project(this.cam); return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, vis: v.z < 1 }; }

  /* ---------- 유닛 뷰 ---------- */
  viewFor(u) {
    let v = this.views.get(u.id); if (v) return v;
    const tc = TEAMC[u.team]; let root;
    if (u.kind === 'hero') {
      const R = buildHero(u.hd.id, tc);
      const ring = decal(RING_G, u.isPlayer ? 0xffd166 : tc, .9, true); ring.scale.setScalar(.62); ring.position.y = .03;
      const disc = this.blob(.5);
      root = new THREE.Group(); root.add(R.g, ring, disc);
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(.85, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false })); bubble.position.y = .8; bubble.visible = false; root.add(bubble);
      const spin = decal(new THREE.RingGeometry(.5, 1, 32, 1, 0, 1.4), 0xffffff, .5, true); spin.geometry.rotateX(-Math.PI / 2); spin.position.y = .3; spin.visible = false; root.add(spin);
      const spin2 = spin.clone(); spin2.rotation.y = Math.PI; spin.add(spin2);
      const stars = new THREE.Group(); for (let i = 0; i < 3; i++) { const s = glowSprite(0xfde68a, .28, 1); s.position.set(Math.cos(i * 2.1) * .35, 0, Math.sin(i * 2.1) * .35); stars.add(s); } stars.position.y = 2.2; stars.visible = false; root.add(stars);
      const roots = decal(RING_G, 0x86efac, .9, true); roots.scale.setScalar(.6); roots.position.y = .06; roots.visible = false; root.add(roots);
      v = { kind: 'hero', root, R, ring, bubble, spin, stars, roots, phase: 0, dieT: 0 };
    } else if (u.kind === 'minion') {
      const R = buildMinion(u.mk, u.team, tc); R.g.scale.setScalar(1.2); root = new THREE.Group(); root.add(R.g, this.blob(u.mk === 's' ? .5 : .35));
      v = { kind: 'minion', root, R, phase: Math.random() * 6 };
    } else {
      const R = u.kind === 'tower' ? buildTower(u.team, tc) : buildNexus(u.team, tc); root = R.g; root.add(this.blob(u.kind === 'tower' ? 1.1 : 1.7));
      v = { kind: u.kind, root, R, wasDead: false };
    }
    root.position.set(u.x * K, 0, u.y * K); this.scene.add(root); this.views.set(u.id, v); return v;
  }
  syncUnits(G, dt) {
    const seen = new Set(), t = G.t;
    for (const u of G.units) {
      seen.add(u.id); const v = this.viewFor(u);
      const p = v.root.position;
      if (v.kind === 'hero') {
        if (u.dead) {
          v.dieT += dt; const k = Math.min(1, v.dieT / .6);
          v.R.g.rotation.z = -k * 1.45; v.R.g.position.y = -k * .15; v.root.visible = v.dieT < 2.5; v.ring.visible = false; continue;
        }
        if (v.dieT > 0 || !v.root.visible) { v.dieT = 0; v.R.g.rotation.z = 0; v.R.g.position.y = 0; v.root.visible = true; v.ring.visible = true; p.set(u.x * K, 0, u.y * K); }
        const tx = u.x * K, tz = u.y * K; const jump = Math.hypot(tx - p.x, tz - p.z) > 1.5;
        if (jump) p.set(tx, 0, tz); else { p.x += (tx - p.x) * Math.min(1, dt * 25); p.z += (tz - p.z) * Math.min(1, dt * 25); }
        this.animHero(v, u, dt, t);
      } else if (v.kind === 'minion') {
        p.set(u.x * K, 0, u.y * K);
        const sp = Math.hypot(u.vx, u.vy); v.phase += sp * dt * .05;
        if (u.face !== undefined) v.R.g.rotation.y = lerpAng(v.R.g.rotation.y, -u.face, dt * 10);
        v.R.body.position.y = Math.abs(Math.sin(v.phase)) * .04 * (sp > 20 ? 1 : 0);
        if (v.R.legL) { v.R.legL.rotation.z = Math.sin(v.phase) * .5 * (sp > 20 ? 1 : 0); v.R.legR.rotation.z = -v.R.legL.rotation.z; }
        const at = t - u.atkT; if (v.R.armR) v.R.armR.rotation.z = at < .3 ? Math.sin(at / .3 * Math.PI) * 1.6 : 0;
        if (v.R.orb) v.R.orb.position.y = .6 + Math.sin(t * 4 + u.id) * .05;
        const hurt = t - (u.hurtT || -9); v.R.g.scale.setScalar(hurt < .12 ? 1.08 : 1);
      } else {
        if (u.dead && !v.wasDead) { v.wasDead = true; v.R.alive.forEach(o => o.visible = false); v.R.rubble.visible = true; }
        if (!u.dead) { v.R.crystal.rotation.y += dt * (v.kind === 'nexus' ? .6 : 1.2); v.R.crystal.position.y = (v.kind === 'nexus' ? 2.1 : 3.6) + Math.sin(t * 2 + u.id) * .08; const hurt = t - (u.hurtT || -9); v.R.glow.material.opacity = (v.kind === 'nexus' ? .35 : .45) * (hurt < .15 ? 2 : 1); }
      }
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { this.scene.remove(v.root); this.views.delete(id); }
  }
  animHero(v, u, dt, t) {
    const R = v.R, sp = Math.hypot(u.vx, u.vy);
    if (u.face !== undefined) R.g.rotation.y = lerpAng(R.g.rotation.y, -u.face, dt * 14);
    const atkDur = Math.min(.55, Math.max(.3, .75 / u.as)), at = t - u.atkT, ct = t - u.castT;
    R.animate(dt, { t, speed: sp, moving: sp > 40 && !u.dash, atk: at >= 0 && at < atkDur ? at / atkDur : -1, cast: ct >= 0 && ct < .5 ? ct / .5 : -1,
      dash: !!(u.dash && !u.dash.forced), stun: u.cc.stun > 0 && !u.airT, air: u.airT > 0 });
    // 공중에 뜸 / 끌려감
    R.g.position.y = u.airT > 0 ? Math.sin((1 - u.airT / .75) * Math.PI) * .7 : (u.dash && u.dash.forced ? .2 : 0);
    // 상태 표시
    const spin = u.buffs.find(b => b.type === 'spin');
    v.spin.visible = !!spin; if (spin) { v.spin.rotation.y += dt * 16; v.spin.scale.setScalar(spin.r * K); v.spin.material.color.set(spin.col); R.g.rotation.y += dt * 22; }
    v.bubble.visible = u.shields.length > 0; if (v.bubble.visible) v.bubble.material.opacity = .12 + Math.sin(t * 6) * .04;
    v.stars.visible = u.cc.stun > 0 && !u.airT; if (v.stars.visible) v.stars.rotation.y += dt * 5;
    v.roots.visible = u.cc.root > 0; if (v.roots.visible) v.roots.scale.setScalar(.55 + Math.sin(t * 10) * .03);
    const hurt = t - (u.hurtT || -9), slowed = u.cc.slows.length > 0, e = hurt < .08 ? .35 : 0;
    for (const m of R.mats) m.emissive.setRGB(e, e + (slowed ? .04 : 0), e + (slowed ? .16 : 0));
    v.ring.material.opacity = .75 + Math.sin(t * 3) * .15;
  }

  /* ---------- 오브젝트 풀 (매번 새로 만들지 않아 끊김·메모리 정리 지연을 줄임) ---------- */
  take(key, make) { const pool = this.pools[key] || (this.pools[key] = []); let o = pool.pop(); if (!o) { o = make(); o.userData.poolKey = key; this.scene.add(o); } o.visible = true; return o; }
  give(o) { if (!o) return; o.visible = false; (this.pools[o.userData.poolKey] || (this.pools[o.userData.poolKey] = [])).push(o); }
  /* ---------- 투사체 ---------- */
  syncProjs(G, dt) {
    const seen = new Set();
    for (const p of G.projs) {
      seen.add(p.id); let v = this.pviews.get(p.id);
      if (!v) v = this.makeProj(p);
      const h = p.homing ? (p.kind === 'tower' ? lerp(p.z0 * K, .7, clampN(1 - Math.hypot(p.tgt.x - p.x, p.tgt.y - p.y) / 750)) : .75) : (p.kind === 'big' ? .9 : .75);
      v.o.position.set(p.x * K, h, p.y * K);
      if (p.dx !== undefined) v.o.rotation.y = -Math.atan2(p.dy, p.dx);
      if (v.line) { const o = p.owner, a = v.line.geometry.attributes.position; a.setXYZ(0, o.x * K, .9, o.y * K); a.setXYZ(1, v.o.position.x, h, v.o.position.z); a.needsUpdate = true; v.line.geometry.computeBoundingSphere(); }
      v.trailT -= dt; if (v.trailT <= 0) { v.trailT = p.kind === 'big' ? .02 : .04; this.parts.emit(v.o.position.x, h, v.o.position.z, { c: p.color, size: p.kind === 'big' ? 1.2 : p.kind === 'tower' ? .7 : .35, life: p.kind === 'big' ? .5 : .3, a: .7 }); }
    }
    for (const [id, v] of this.pviews) if (!seen.has(id)) { this.give(v.o); if (v.line) this.give(v.line); this.pviews.delete(id); }
  }
  makeProj(p) {
    const c = new THREE.Color(p.color), kind = p.kind || 'auto';
    const o = this.take('proj-' + kind, () => {
      const g = new THREE.Group(); const m = (geo) => { const me = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff })); g.add(me); return me; };
      if (kind === 'arrow') { const me = m(this.geo.arrow); me.rotation.z = -Math.PI / 2; g.add(glowSprite(0xffffff, .6, .8)); }
      else if (kind === 'big') { const me = m(this.geo.bigArrow); me.rotation.z = -Math.PI / 2; g.add(glowSprite(0xffffff, 3, .9)); }
      else if (kind === 'chain') { const me = new THREE.Mesh(this.geo.chain, mat(0xcbd5e1)); g.add(me); g.add(glowSprite(0x93c5fd, .8, .5)); g.userData.fixed = true; }
      else if (kind === 'snow') { g.add(new THREE.Mesh(this.geo.snow, mat(0xf8fafc))); g.add(glowSprite(0xbfdbfe, 1, .5)); g.userData.fixed = true; }
      else if (kind === 'tower') { m(this.geo.towerShot); g.add(glowSprite(0xffffff, 1.6, 1)); }
      else if (kind === 'orb') { m(this.geo.orb); g.add(glowSprite(0xffffff, 1.8, .9)); }
      else { m(this.geo.auto); g.add(glowSprite(0xffffff, .55, .9)); }
      return g;
    });
    if (!o.userData.fixed) for (const ch of o.children) ch.material.color.copy(c);
    let line = null;
    if (kind === 'chain') line = this.take('chainLine', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xcbd5e1 })); });
    o.rotation.set(0, 0, 0);
    const v = { o, line, trailT: 0 }; this.pviews.set(p.id, v); return v;
  }
  /* ---------- 예고 범위 ---------- */
  syncZones(G) {
    const seen = new Set();
    for (const z of G.zones) {
      seen.add(z.id); let v = this.zviews.get(z.id); const k = Math.min(1, z.t / z.delay);
      if (!v) {
        if (z.line) {
          const g = this.take('zline', () => { const g = new THREE.Group(); g.add(decal(PLANE_G, 0xffffff, .15, true), decal(PLANE_G, 0xffffff, .35, true)); g.children[1].position.y = .01; return g; });
          const L = Math.hypot(z.x2 - z.x, z.y2 - z.y) * K; g.children.forEach(m => { m.material.color.set(z.color); m.scale.set(L, 1, z.w * K); }); g.rotation.y = -Math.atan2(z.y2 - z.y, z.x2 - z.x); v = { g, b: g.children[1], line: true, w: z.w * K, L };
        } else {
          const g = this.take('zcirc', () => { const g = new THREE.Group(); g.add(decal(DISC_G, 0xffffff, .14, true), decal(RING_G, 0xffffff, .8, true), decal(DISC_G, 0xffffff, .3, true)); g.children[2].position.y = .01; return g; });
          g.children.forEach(m => m.material.color.set(z.color)); g.children[0].scale.setScalar(z.r * K); g.children[1].scale.setScalar(z.r * K); v = { g, b: g.children[2], R: z.r * K };
        }
        v.g.position.set(z.x * K, .05, z.y * K); this.zviews.set(z.id, v);
      }
      if (v.line) v.b.scale.set(v.L, 1, Math.max(.001, v.w * k)); else v.b.scale.setScalar(Math.max(.01, v.R * k));
    }
    for (const [id, v] of this.zviews) if (!seen.has(id)) { this.give(v.g); this.zviews.delete(id); }
  }
  /* ---------- 이펙트 ---------- */
  fxMesh(key, make, color) { const m = this.take(key, make); m.traverse(o => { if (o.material && o.material.color && !o.userData.keepColor) o.material.color.set(color); }); return m; }
  spawnFx(f, G) {
    const x = f.x * K, z = f.y * K, P = this.parts, c = f.c || '#ffffff', A = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const ring = (r, dur, op = .9) => { const m = this.fxMesh('ring', () => decal(RING_G, 0xffffff, 1, true), c); m.position.set(x, .06, z); this.fxl.push({ m, t: 0, dur, r0: r * .3, r1: r, op, kind: 'ring' }); };
    switch (f.type) {
      case 'ring': ring(f.r * K, f.dur || .45); if (f.fill) P.burst(x, .3, z, 12, { c, speed: f.r * K * 3, up: 1.5, size: .4, life: .5, g: 3 }); break;
      case 'burst': ring(f.r * K, .5); P.burst(x, .2, z, 22, { c, speed: f.r * K * 3, up: 4, size: .5, life: .7, g: 6 }); P.emit(x, .5, z, { c, size: f.r * K * 3, life: .3, a: .8 }); break;
      case 'vines': ring(f.r * K, .6); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, rr = f.r * K * (.3 + Math.random() * .6); const m = this.take('spike', () => { const me = new THREE.Mesh(this.geo.spike, mat(0x4ade80)); return me; }); m.position.set(x + Math.cos(a) * rr, -.5, z + Math.sin(a) * rr); m.rotation.set((Math.random() - .5) * .5, 0, (Math.random() - .5) * .5); this.fxl.push({ m, t: 0, dur: 1.3, kind: 'spike' }); } P.burst(x, .2, z, 14, { c, speed: 2, up: 3, size: .3, life: .6, g: 4 }); break;
      case 'beam': { const L = Math.hypot(f.x2 - f.x, f.y2 - f.y) * K; const g = this.take('beam', () => { const g = new THREE.Group(); const core = new THREE.Mesh(this.geo.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff, ...A })); core.userData.keepColor = true; const outer = new THREE.Mesh(this.geo.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: .6, ...A })); g.add(core, outer); return g; }); g.traverse(o => { if (o.material && !o.userData.keepColor) o.material.color.set(c); }); g.children[0].scale.set(L, .25, f.w * K * .5); g.children[0].position.x = L / 2; g.children[1].scale.set(L, .6, f.w * K * 1.2); g.children[1].position.x = L / 2; g.position.set(x, .8, z); g.rotation.y = -Math.atan2(f.y2 - f.y, f.x2 - f.x); g.scale.set(1, 1, 1); this.fxl.push({ m: g, t: 0, dur: f.dur || .6, kind: 'beam' }); this.shake = Math.max(this.shake, .25); break; }
      case 'blink': P.burst(x, .7, z, 16, { c, speed: 3, up: 1, size: .35, life: .45 }); break;
      case 'hit': P.burst(x, .8, z, f.big ? 12 : 5, { c, speed: f.big ? 4 : 2.5, up: 1.5, size: f.big ? .4 : .25, life: .25 }); break;
      case 'slash': { const m = this.fxMesh('slash', () => new THREE.Mesh(this.geo.slash, new THREE.MeshBasicMaterial({ color: 0xffffff, ...A })), c); m.position.set(x, .85, z); m.rotation.set(Math.PI / 2 + (Math.random() - .5), 0, -(f.a || 0) - 1.2); this.fxl.push({ m, t: 0, dur: .2, kind: 'fade' }); break; }
      case 'quake': ring(f.r * K, .5); for (let i = 0; i < 12; i++) P.emit(x + (Math.random() - .5) * f.r * K * 1.6, .1, z + (Math.random() - .5) * f.r * K * 1.6, { c: '#94a3b8', vy: 3 + Math.random() * 3, g: 12, size: .35, life: .6, a: .8 }); this.shake = Math.max(this.shake, .2); break;
      case 'nova': { const m = this.fxMesh('nova', () => new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: .35, ...A })), c); m.position.set(x, .2, z); this.fxl.push({ m, t: 0, dur: .6, kind: 'nova', R: f.r * K }); ring(f.r * K, .6); this.shake = Math.max(this.shake, .3); break; }
      case 'bolt': { const l = this.fxMesh('bolt', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true })); }, c); const a = l.geometry.attributes.position; for (let i = 0; i <= 8; i++) { const k = i / 8, j = i && i < 8; a.setXYZ(i, lerp(f.x2, f.x, k) * K + (j ? (Math.random() - .5) * .4 : 0), lerp(3, .8, k), lerp(f.y2, f.y, k) * K + (j ? (Math.random() - .5) * .4 : 0)); } a.needsUpdate = true; l.geometry.computeBoundingSphere(); this.fxl.push({ m: l, t: 0, dur: .3, kind: 'fade' }); P.burst(x, .8, z, 6, { c, speed: 2, size: .3, life: .3 }); break; }
      case 'heal': for (let i = 0; i < 14; i++) P.emit(x + (Math.random() - .5) * .8, .2 + Math.random() * .5, z + (Math.random() - .5) * .8, { c, vy: 1.5 + Math.random() * 1.5, size: .25, life: .8, drag: .97 }); ring(.7, .5); break;
      case 'aura': this.fxl.push({ t: 0, dur: f.dur || 2, kind: 'aura', follow: f.follow, c, acc: 0 }); break;
      case 'levelup': { const m = this.fxMesh('column', () => new THREE.Mesh(this.geo.column, new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: .4, side: THREE.DoubleSide, ...A })), '#fde68a'); m.position.set(x, 1.5, z); this.fxl.push({ m, t: 0, dur: .9, kind: 'column', follow: f.follow }); break; }
      case 'death': P.burst(x, .6, z, f.small ? 8 : 26, { c, speed: f.small ? 2 : 4, up: 3, size: f.small ? .3 : .5, life: .7, g: 5 }); break;
      case 'collapse': P.burst(x, 1.5, z, f.big ? 100 : 50, { c, speed: f.big ? 8 : 5, up: 6, size: .6, life: 1.4, g: 6 }); for (let i = 0; i < 18; i++) P.emit(x + (Math.random() - .5) * 2, 2 + Math.random() * 2, z + (Math.random() - .5) * 2, { c: '#94a3b8', vx: (Math.random() - .5) * 4, vz: (Math.random() - .5) * 4, vy: 2 + Math.random() * 3, g: 10, size: .5, life: 1.2, a: .9 }); this.shake = Math.max(this.shake, f.big ? 1.2 : .6); break;
      case 'sword': { const g = this.take('sword', () => { const g = new THREE.Group(); const b = new THREE.Mesh(this.geo.swordBlade, new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true })); b.position.y = 1.6; g.add(b); g.add(glowSprite(0xfde047, 3, .8)); return g; }); g.position.set(x, 6, z); this.fxl.push({ m: g, t: 0, dur: .5, kind: 'drop' }); this.shake = Math.max(this.shake, .35); break; }
      case 'blades': for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; P.emit(x, .7, z, { c, vx: Math.cos(a) * 5, vz: Math.sin(a) * 5, size: .35, life: .35, drag: .9 }); } ring(f.r * K, .35); break;
    }
  }
  updateFx(G, dt) {
    let n = 0; while (G.fxq.length) { const f = G.fxq.shift(); if (++n < 60) this.spawnFx(f, G); }
    for (let i = this.fxl.length - 1; i >= 0; i--) {
      const f = this.fxl[i]; f.t += dt; const k = f.t / f.dur;
      if (k >= 1) { if (f.m) this.give(f.m); this.fxl.splice(i, 1); continue; }
      if (f.kind === 'ring') { const r = lerp(f.r0, f.r1, 1 - Math.pow(1 - k, 3)); f.m.scale.setScalar(Math.max(.01, r)); f.m.material.opacity = f.op * (1 - k); }
      else if (f.kind === 'spike') { f.m.position.y = k < .25 ? lerp(-.5, .3, k / .25) : k > .75 ? lerp(.3, -.6, (k - .75) / .25) : .3; }
      else if (f.kind === 'beam') { const s = 1 - k; f.m.scale.set(1, s, s); f.m.children[0].material.opacity = s; f.m.children[1].material.opacity = .6 * s; }
      else if (f.kind === 'fade') f.m.material.opacity = 1 - k;
      else if (f.kind === 'nova') { f.m.scale.setScalar(Math.max(.01, f.R * (1 - Math.pow(1 - k, 2)))); f.m.material.opacity = .35 * (1 - k); }
      else if (f.kind === 'column') { const u = G.units.find(q => q.id === f.follow); if (u) f.m.position.set(u.x * K, 1.5, u.y * K); f.m.scale.set(1 - k * .5, 1 + k, 1 - k * .5); f.m.material.opacity = .4 * (1 - k); }
      else if (f.kind === 'drop') { f.m.position.y = Math.max(0, 6 * (1 - k * 3)); f.m.children[0].material.opacity = k > .6 ? (1 - k) / .4 : 1; }
      else if (f.kind === 'aura') { const u = G.units.find(q => q.id === f.follow); if (!u || u.dead) { f.t = f.dur; continue; } f.acc += dt; while (f.acc > .06) { f.acc -= .06; const a = Math.random() * 6.28; this.parts.emit(u.x * K + Math.cos(a) * .45, .2, u.y * K + Math.sin(a) * .45, { c: f.c, vy: 1.6, size: .22, life: .5 }); } }
    }
    this.parts.update(dt);
  }
  // 게임 시작 때 모든 투사체/이펙트를 한 번씩 그려 셰이더를 미리 준비 (첫 사용 때 멈칫 방지)
  warmup() {
    const fake = { fxq: [], units: [] }, far = 99999;
    for (const kind of ['arrow', 'big', 'chain', 'snow', 'tower', 'orb', 'auto']) { const v = this.makeProj({ id: -1, kind, color: '#ffffff', r: 20 }); v.o.position.set(30, -50, 7); this.give(v.o); if (v.line) this.give(v.line); this.pviews.delete(-1); }
    for (const type of ['ring', 'vines', 'beam', 'slash', 'nova', 'bolt', 'levelup', 'sword']) this.spawnFx({ type, x: far, y: far, x2: far + 10, y2: far, r: 100, w: 100, c: '#ffffff' }, fake);
    this.syncZones({ zones: [{ id: -2, x: far, y: far, r: 100, t: 0, delay: 1, color: '#ffffff' }, { id: -3, line: true, x: far, y: far, x2: far + 10, y2: far, w: 50, t: 0, delay: 1, color: '#ffffff' }] });
    this.r.compile(this.scene, this.cam);
    this.syncZones({ zones: [] });
    for (const f of this.fxl) if (f.m) this.give(f.m); this.fxl = [];
  }
  /* ---------- 조준 표시 ---------- */
  updateAim(G, p, aiming, mouse, ab) {
    const A = this.aim; A.g.visible = aiming >= 0 && p && !p.dead; if (!A.g.visible) return;
    const a = ab.ai, px = p.x * K, pz = p.y * K; A.g.position.set(px, 0, pz);
    [A.range, A.line, A.circ, A.circR, A.cone, A.tgt].forEach(m => m.visible = false);
    const ang = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    if (a.t === 'shot' || a.t === 'line' || a.t === 'global') {
      const L = (a.t === 'global' ? 2400 : a.range) * K;
      if (a.cone) { A.cone.visible = true; A.cone.scale.setScalar(L); A.cone.rotation.y = -ang; }
      else { A.line.visible = true; A.line.scale.set(L, 1, a.w * K); A.line.rotation.y = -ang; }
    } else if (a.t === 'aoe') { A.range.visible = true; A.range.scale.setScalar(a.range * K); const [x, y] = clampPt(p, mouse.x, mouse.y, a.range); A.circ.visible = A.circR.visible = true; A.circ.position.set((x - p.x) * K, .04, (y - p.y) * K); A.circR.position.copy(A.circ.position); A.circ.scale.setScalar(a.r * K); A.circR.scale.setScalar(a.r * K); }
    else if (a.t === 'dash') { A.range.visible = true; A.range.scale.setScalar(a.range * K); const [x, y] = clampPt(p, mouse.x, mouse.y, a.range); A.circR.visible = true; A.circR.position.set((x - p.x) * K, .04, (y - p.y) * K); A.circR.scale.setScalar(.45); }
    else if (a.t === 'target' || a.t === 'exec') { A.range.visible = true; A.range.scale.setScalar((a.range + p.r) * K); const t = pickTarget(p, mouse.x, mouse.y, a.range, a.t === 'exec'); if (t) { A.tgt.visible = true; A.tgt.position.set((t.x - p.x) * K, .05, (t.y - p.y) * K); A.tgt.scale.setScalar(.65); } }
  }
  reset() {
    for (const v of this.views.values()) this.scene.remove(v.root); this.views.clear();
    for (const v of this.pviews.values()) { this.give(v.o); if (v.line) this.give(v.line); } this.pviews.clear();
    for (const v of this.zviews.values()) this.give(v.g); this.zviews.clear();
    for (const f of this.fxl) if (f.m) this.give(f.m); this.fxl = [];
    this.warmup();
  }
  clickMarker(x, y, color) { this.clickRing.position.set(x * K, .05, y * K); this.clickRing.material.color.set(color); this.clickT = 0; }

  /* ---------- 프레임 ---------- */
  render(G, dt, opts) {
    const p = G.player;
    this.syncUnits(G, dt); this.syncProjs(G, dt); this.syncZones(G); this.updateFx(G, dt);
    // 회복 구슬
    while (this.relicMeshes.length < G.relics.length) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshBasicMaterial({ color: 0x4ade80 })); g.add(m); g.add(glowSprite(0x4ade80, 1.1, .5)); this.scene.add(g); this.relicMeshes.push(g); }
    G.relics.forEach((r, i) => { const g = this.relicMeshes[i]; g.visible = r.on; g.position.set(r.x * K, .7 + Math.sin(G.t * 3 + i) * .12, r.y * K); g.children[0].rotation.y += dt * 2; });
    // 포탑 사거리
    let tw = null; if (p && !p.dead) for (const u of G.units) if (u.kind === 'tower' && !u.dead && u.team !== p.team && Math.hypot(u.x - p.x, u.y - p.y) < u.range + 450) tw = u;
    this.towerRange.material.opacity = tw ? (tw.target === p ? .8 : .35) : 0; if (tw) { this.towerRange.position.set(tw.x * K, .05, tw.y * K); this.towerRange.scale.setScalar(tw.range * K); }
    this.clickT += dt; this.clickRing.material.opacity = Math.max(0, .9 - this.clickT * 2.5); this.clickRing.scale.setScalar(Math.max(.05, .35 - this.clickT * .6));
    this.updateAim(G, p, opts.aiming, opts.mouse, opts.aiming >= 0 ? p.hd.ab[opts.aiming] : null);
    // 카메라
    const fx = (p ? p.x + (opts.camOff || 0) : MAP_W / 2) * K;
    const desired = new THREE.Vector3(Math.max(4, Math.min(MAP_W * K - 4, fx)), 0, MID_Y * K + ((p ? p.y : MID_Y) - MID_Y) * K * .35);
    this.camT.lerp(desired, Math.min(1, dt * 8));
    this.shake = Math.max(0, this.shake - dt * 1.5); const sh = this.shake * this.shake;
    this.cam.position.set(this.camT.x + (Math.random() - .5) * sh, this.camT.y + 12.5 + (Math.random() - .5) * sh, this.camT.z + 8.2);
    this.cam.lookAt(this.camT.x, 0, this.camT.z + .6);
    this.world.update(G.t, dt);
    // 눈, 안개
    this.r.render(this.scene, this.cam);
    this.drawCalls = this.r.info.render.calls;
  }
}
function lerp(a, b, k) { return a + (b - a) * k; }
function clampN(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerpAng(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); }
