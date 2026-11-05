// 2D 오버레이: 체력바, 피해 숫자, 하단 패널, 미니맵, 알림
import { MAP_W, LANE_Y1, LANE_Y2, TEAMC, TEAMN, ITEMS, itemStats, need, effMs, inBase, clamp } from './sim.js';

const FONT = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
export class Hud {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.rects = []; this.resize(); }
  resize() { this.DPR = Math.min(2, window.devicePixelRatio || 1); this.W = window.innerWidth; this.H = window.innerHeight; this.cv.width = this.W * this.DPR; this.cv.height = this.H * this.DPR; }
  txt(s, x, y, size, col, align, weight, stroke) { const c = this.ctx; c.font = `${weight || 600} ${size}px ${FONT}`; c.textAlign = align || 'left'; if (stroke) { c.lineWidth = stroke; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(s, x, y); } c.fillStyle = col; c.fillText(s, x, y); }
  rr(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  bar(x, y, w, h, u, col, ticks) {
    const c = this.ctx, sh = u.shields ? u.shields.reduce((s, a) => s + a.a, 0) : 0, tot = Math.max(u.maxHp, u.hp + sh);
    c.fillStyle = 'rgba(5,8,14,.85)'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * u.hp / tot, h);
    if (sh > 0) { c.fillStyle = '#f1f5f9'; c.fillRect(x - w / 2 + w * u.hp / tot, y, w * sh / tot, h); }
    if (ticks) { c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.beginPath(); for (let v = 200; v < u.maxHp; v += 200) { const px = x - w / 2 + w * v / tot; c.moveTo(px, y); c.lineTo(px, y + h * (v % 1000 ? .5 : 1)); } c.stroke(); }
  }
  wrap(s, maxW) { const out = []; let cur = ''; for (const w of s.split(' ')) { const t = cur ? cur + ' ' + w : w; if (this.ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }

  draw(G, R, S) {
    const c = this.ctx, W = this.W, H = this.H, p = G.player;
    c.setTransform(this.DPR, 0, 0, this.DPR, 0, 0); c.clearRect(0, 0, W, H); this.rects = [];
    // 유닛 위 체력바
    for (const u of G.units) {
      if (u.dead) continue;
      const hgt = u.kind === 'hero' ? 2.15 : u.kind === 'minion' ? (u.mk === 's' ? 1.0 : .95) : u.kind === 'tower' ? 4.5 : 3.6;
      const s = R.project(u.x, u.y, hgt); if (!s.vis || s.x < -100 || s.x > W + 100 || s.y < -50 || s.y > H + 50) continue;
      const ally = u.team === p.team;
      if (u.kind === 'hero') {
        const col = u === p ? '#4ade80' : ally ? '#60a5fa' : '#f87171';
        this.bar(s.x + 12, s.y, 96, 11, u, col, true);
        c.fillStyle = '#0b1220'; c.fillRect(s.x - 58, s.y - 3, 22, 17); this.txt(u.level, s.x - 47, s.y + 10, 12, '#e6eefc', 'center', 800);
        this.txt(u.isPlayer ? u.name + '(나)' : u.name, s.x, s.y - 7, 13, u === p ? '#ffd166' : '#e6eefc', 'center', 800, 3);
        if (p.mark && p.mark.tgt === u) this.txt('❄ F', s.x + 70, s.y + 10, 12, '#e0f2fe', 'left', 800, 3);
      } else if (u.kind === 'minion') { if (u.hp < u.maxHp) this.bar(s.x, s.y, 40, 5, u, ally ? '#60a5fa' : '#f87171'); }
      else { this.bar(s.x, s.y, u.kind === 'nexus' ? 150 : 110, 10, u, TEAMC[u.team]); if (!S.canHit(u)) this.txt('무적', s.x, s.y - 6, 12, '#cbd5e1', 'center', 700, 3); }
    }
    // 떠오르는 숫자
    for (const t of S.texts) { const s = R.project(t.x, t.y, 2.3 + t.rise); if (!s.vis) continue; c.globalAlpha = Math.min(1, t.t * 2.5); this.txt(t.s, s.x, s.y, t.big ? 22 : 17, t.c, 'center', 900, 4); } c.globalAlpha = 1;
    if (p.dead) { c.fillStyle = 'rgba(20,24,34,.45)'; c.fillRect(0, 0, W, H); this.txt(`부활까지 ${Math.ceil(p.respawnT)}초`, W / 2, H * .38, 34, '#e6eefc', 'center', 800, 4); this.txt('P 키로 상점을 열 수 있습니다', W / 2, H * .38 + 32, 15, '#cbd5e1', 'center', 600, 3); }
    // 눈 (화면 공간)
    if (!this.snow) { this.snow = []; for (let i = 0; i < 140; i++) this.snow.push({ x: Math.random(), y: Math.random(), s: .6 + Math.random() * 2, v: .02 + Math.random() * .05 }); }
    c.fillStyle = 'rgba(235,243,255,.6)';
    for (const f of this.snow) { if (!S.paused) { f.y += f.v * S.dt; f.x += Math.sin(G.t * .7 + f.y * 9) * .0004; } if (f.y > 1) f.y = 0; c.beginPath(); c.arc((((f.x % 1) + 1) % 1) * W, f.y * H, f.s, 0, 7); c.fill(); }
    // 상단 점수
    const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
    this.rr(W / 2 - 120, 8, 240, 44, 12); c.fillStyle = 'rgba(8,14,28,.82)'; c.fill();
    this.txt(G.kills[0], W / 2 - 52, 40, 26, TEAMC[0], 'center', 900); this.txt(G.kills[1], W / 2 + 52, 40, 26, TEAMC[1], 'center', 900);
    this.txt(`${mm}:${String(ss).padStart(2, '0')}`, W / 2, 37, 15, '#c6d4ea', 'center', 600);
    // 미니맵
    const mw = Math.min(300, W * .3), mh = 54, mx = W - mw - 12, my = 10;
    this.rr(mx, my, mw, mh, 8); c.fillStyle = 'rgba(8,14,28,.85)'; c.fill();
    const wx = x => mx + 6 + (x / MAP_W) * (mw - 12), wy = y => my + 6 + ((y - LANE_Y1) / (LANE_Y2 - LANE_Y1)) * (mh - 12);
    c.fillStyle = '#34445e'; c.fillRect(mx + 6, my + 6, mw - 12, mh - 12);
    for (const u of G.units) { if (u.dead) continue; c.fillStyle = TEAMC[u.team]; if (u.kind === 'hero') { c.beginPath(); c.arc(wx(u.x), wy(u.y), u === p ? 5 : 4, 0, 7); c.fill(); if (u === p) { c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.stroke(); } } else if (u.kind === 'minion') c.fillRect(wx(u.x) - 1, wy(u.y) - 1, 2, 2); else c.fillRect(wx(u.x) - 4, wy(u.y) - 4, 8, 8); }
    const camL = R.pick(0, H / 2).x, camR = R.pick(W, H / 2).x; c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(wx(clamp(camL, 0, MAP_W)), my + 3, Math.max(4, wx(clamp(camR, 0, MAP_W)) - wx(clamp(camL, 0, MAP_W))), mh - 6);
    // 킬 피드
    let fy = my + mh + 22;
    for (const m of S.feed) { c.globalAlpha = Math.min(1, m.t); c.font = `700 13px ${FONT}`; const sep = '  ⚔  ', vw = c.measureText(m.v).width, sw = c.measureText(sep).width, kw = c.measureText(m.k).width; this.rr(W - 12 - vw - sw - kw - 16, fy - 15, vw + sw + kw + 16, 22, 6); c.fillStyle = 'rgba(8,14,28,.8)'; c.fill(); c.textAlign = 'right'; c.fillStyle = m.vc; c.fillText(m.v, W - 20, fy); c.fillStyle = '#c6d4ea'; c.fillText(sep, W - 20 - vw, fy); c.fillStyle = m.kc; c.fillText(m.k, W - 20 - vw - sw, fy); fy += 26; }
    c.globalAlpha = 1;
    if (S.banner) { const b = S.banner; c.globalAlpha = Math.min(1, b.t * 2, (b.max - b.t) * 4 + .2); c.font = `900 30px ${FONT}`; const bw = c.measureText(b.s).width + 50; this.rr(W / 2 - bw / 2, H * .16 - 36, bw, 52, 12); c.fillStyle = 'rgba(8,14,28,.8)'; c.fill(); this.txt(b.s, W / 2, H * .16, 30, b.c, 'center', 900); c.globalAlpha = 1; }
    if (S.fps) this.txt(`${S.fps} FPS`, 12, 22, 12, S.fps < 30 ? '#fca5a5' : 'rgba(200,214,234,.6)', 'left', 700);
    this.panel(G, S);
    if (S.tab) this.score(G);
    if (S.paused && !S.shopOpen) { c.fillStyle = 'rgba(4,8,16,.6)'; c.fillRect(0, 0, W, H); this.txt('일시정지', W / 2, H / 2 - 10, 40, '#e6eefc', 'center', 900); this.txt('Esc 키로 계속하기', W / 2, H / 2 + 24, 15, '#a9bbd6', 'center'); }
  }
  panel(G, S) {
    const c = this.ctx, W = this.W, H = this.H, p = G.player;
    const pw = Math.min(800, W - 16), ph = 118, px = (W - pw) / 2, py = H - ph - 6;
    this.rr(px, py, pw, ph, 14); c.fillStyle = 'rgba(8,14,28,.9)'; c.fill(); c.strokeStyle = '#24395c'; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.arc(px + 50, py + 48, 34, 0, 7); c.fillStyle = p.hd.color; c.fill(); c.lineWidth = 5; c.strokeStyle = TEAMC[p.team]; c.stroke();
    this.txt(p.name[0], px + 50, py + 61, 34, '#16161c', 'center', 900);
    c.beginPath(); c.arc(px + 76, py + 78, 14, 0, 7); c.fillStyle = '#0b1220'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.stroke(); this.txt(p.level, px + 76, py + 83, 13, '#ffd166', 'center', 800);
    c.fillStyle = '#1c2c48'; c.fillRect(px + 16, py + 100, 68, 5); c.fillStyle = '#a78bfa'; c.fillRect(px + 16, py + 100, 68 * (p.level >= 18 ? 1 : p.xp / need(p.level)), 5);
    this.txt(p.name, px + 50, py + 96, 12, '#c6d4ea', 'center', 700);
    const ax = px + 100; let bx = ax; const KEYS = ['Q', 'W', 'E', 'R'];
    for (let i = 0; i < 4; i++) {
      const ab = p.hd.ab[i], s = 56, y = py + 10; this.rr(bx, y, s, s, 8); c.fillStyle = '#16233d'; c.fill(); c.strokeStyle = S.aiming === i ? '#ffd166' : '#2c4670'; c.lineWidth = 2; c.stroke();
      const locked = i === 3 && p.level < 6;
      if (!(locked || p.cds[i] > 0)) this.txt(ab.n.slice(0, 2), bx + s / 2, y + s / 2 + 6, 15, p.hd.color, 'center', 800);
      if (locked || p.cds[i] > 0) { c.save(); this.rr(bx, y, s, s, 8); c.clip(); c.fillStyle = 'rgba(0,0,0,.65)'; const cdmax = ab.cd * 100 / (100 + p.ah); c.fillRect(bx, y, s, locked ? s : s * Math.min(1, p.cds[i] / cdmax)); c.restore(); this.txt(locked ? 'Lv6' : p.cds[i] < 1 ? p.cds[i].toFixed(1) : Math.ceil(p.cds[i]), bx + s / 2, y + s / 2 + 7, locked ? 14 : 20, '#ffffff', 'center', 800); }
      this.rr(bx + 2, y + 2, 17, 16, 4); c.fillStyle = '#0b1220'; c.fill(); this.txt(KEYS[i], bx + 10.5, y + 14.5, 11, '#ffd166', 'center', 800);
      this.rects.push({ x: bx, y, w: s, h: s, title: `[${KEYS[i]}] ${ab.n}`, sub: `재사용 대기시간 ${(ab.cd * 100 / (100 + p.ah)).toFixed(1)}초${i === 3 ? ' · 6레벨부터' : ''}`, body: ab.desc }); bx += s + 8;
    }
    bx += 6;
    for (const [k, nm, desc] of [['D', '점멸', '짧은 거리를 즉시 순간이동합니다.'], ['F', '눈덩이', '눈덩이를 던져 맞춘 적에게 표식을 남깁니다. 3초 안에 다시 F를 누르면 그 적에게 돌진합니다.']]) {
      const s = 44, y = py + 16; this.rr(bx, y, s, s, 8); c.fillStyle = '#16233d'; c.fill(); c.strokeStyle = k === 'F' && p.mark ? '#e0f2fe' : '#2c4670'; c.lineWidth = 2; c.stroke();
      const onCd = p.spellCd[k] > 0 && !(k === 'F' && p.mark); if (!onCd) this.txt(nm.slice(0, 2), bx + s / 2, y + s / 2 + 5, 13, '#e0f2fe', 'center', 800);
      if (onCd) { c.save(); this.rr(bx, y, s, s, 8); c.clip(); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(bx, y, s, s * Math.min(1, p.spellCd[k] / (k === 'D' ? 150 : 40))); c.restore(); this.txt(Math.ceil(p.spellCd[k]), bx + s / 2, y + s / 2 + 6, 16, '#ffffff', 'center', 800); }
      this.txt(k, bx + 6, y + 12, 10, '#ffd166', 'center', 800); this.rects.push({ x: bx, y, w: s, h: s, title: `[${k}] ${nm}`, sub: k === 'D' ? '재사용 대기시간 150초' : '재사용 대기시간 40초', body: desc }); bx += s + 6;
    }
    const hbW = bx - ax - 6, hbY = py + 76; c.fillStyle = '#0b1220'; c.fillRect(ax, hbY, hbW, 20);
    const sh = p.shields.reduce((s, a) => s + a.a, 0), tot = Math.max(p.maxHp, p.hp + sh);
    c.fillStyle = '#22c55e'; c.fillRect(ax, hbY, hbW * p.hp / tot, 20); if (sh) { c.fillStyle = '#e2e8f0'; c.fillRect(ax + hbW * p.hp / tot, hbY, hbW * sh / tot, 20); }
    this.txt(`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, ax + hbW / 2, hbY + 15, 12.5, '#ffffff', 'center', 800);
    this.txt(`처치 ${p.k} / 사망 ${p.d} / 도움 ${p.a}`, ax, py + 111, 11.5, '#9fb3d1', 'left', 600);
    const ix = ax + hbW + 16;
    for (let i = 0; i < 6; i++) { const s = 36, x = ix + (i % 3) * (s + 5), y = py + 12 + Math.floor(i / 3) * (s + 5); this.rr(x, y, s, s, 6); c.fillStyle = '#111d33'; c.fill(); c.strokeStyle = '#24395c'; c.lineWidth = 1.5; c.stroke(); const id = p.items[i]; if (id) { this.txt(ITEMS[id].n.slice(0, 2), x + s / 2, y + s / 2 + 5, 12, '#ffd166', 'center', 800); this.rects.push({ x, y, w: s, h: s, title: ITEMS[id].n, sub: '', body: itemStats(ITEMS[id]) }); } }
    this.txt(`💰 ${Math.floor(p.gold)}`, ix, py + 108, 14, '#facc15', 'left', 800);
    if (!p.dead && inBase(p)) this.txt('P: 상점', ix + 70, py + 108, 12, '#86efac', 'left', 700);
    const sx = ix + 130; if (sx + 80 < px + pw) { const st = [['공격력', Math.round(p.ad)], ['주문력', Math.round(p.ap)], ['방어력', Math.round(p.def)], ['공격 속도', p.as.toFixed(2)], ['이동 속도', Math.round(effMs(p))], ['스킬 가속', p.ah]]; st.forEach((s, i) => { this.txt(s[0], sx, py + 24 + i * 16, 11.5, '#9fb3d1', 'left', 600); this.txt(s[1], px + pw - 14, py + 24 + i * 16, 11.5, '#e6eefc', 'right', 800); }); }
    if (S.amove) this.txt('공격 이동: 좌클릭으로 지점 선택', W / 2, py - 12, 13, '#fca5a5', 'center', 700, 3);
    for (const r of this.rects) {
      if (S.mx >= r.x && S.mx <= r.x + r.w && S.my >= r.y && S.my <= r.y + r.h) {
        c.font = `500 13px ${FONT}`; const lines = this.wrap(r.body, 280); const th = 56 + lines.length * 18, tw = 310, tx = clamp(r.x - tw / 2 + r.w / 2, 8, W - tw - 8), ty = py - th - 10;
        this.rr(tx, ty, tw, th, 10); c.fillStyle = 'rgba(8,14,28,.96)'; c.fill(); c.strokeStyle = '#3b5b8c'; c.stroke();
        this.txt(r.title, tx + 14, ty + 24, 15, '#ffd166', 'left', 800); if (r.sub) this.txt(r.sub, tx + 14, ty + 42, 12, '#9fb3d1'); lines.forEach((l, i) => this.txt(l, tx + 14, ty + (r.sub ? 62 : 44) + i * 18, 13, '#e6eefc', 'left', 500)); break;
      }
    }
  }
  score(G) {
    const c = this.ctx, W = this.W, H = this.H, n = G.heroes.length / 2, w = Math.min(620, W - 30), h = 90 + n * 48, x = (W - w) / 2, y = (H - h) / 2 - 40;
    this.rr(x, y, w, h, 14); c.fillStyle = 'rgba(8,14,28,.95)'; c.fill(); c.strokeStyle = '#24395c'; c.stroke();
    for (const team of [0, 1]) {
      const hs = G.heroes.filter(h => h.team === team), oy = y + 32 + team * (30 + n * 24);
      this.txt(TEAMN[team] + `  ${G.kills[team]}킬`, x + 20, oy, 15, TEAMC[team], 'left', 800);
      hs.forEach((h, i) => { const yy = oy + 24 + i * 24; this.txt((h.isPlayer ? h.name + '(나)' : h.name) + (h.dead ? ' (사망)' : ''), x + 30, yy, 13, h.isPlayer ? '#ffd166' : '#e6eefc', 'left', 700); this.txt('Lv' + h.level, x + w * .38, yy, 13, '#c6d4ea'); this.txt(`${h.k} / ${h.d} / ${h.a}`, x + w * .5, yy, 13, '#e6eefc', 'left', 700); this.txt(h.items.map(i => ITEMS[i].n.slice(0, 2)).join(' '), x + w * .66, yy, 12, '#9fb3d1'); });
    }
  }
}
