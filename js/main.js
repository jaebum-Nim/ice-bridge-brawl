// 메뉴, 입력, 게임 루프
import * as Sim from './sim.js';
import { Renderer } from './render3d.js';
import { Hud } from './hud.js';
const { HEROES, HMAP, ROLE, DIFF, ITEMS, TEAMC, TEAMN, SELF_T, itemStats, cmd, inBase, targetable } = Sim;

const glCv = document.getElementById('gl'), hudCv = document.getElementById('hud');
let R = null, hud = null, G = null;
const S = { aiming: -1, amove: false, tab: false, paused: false, shopOpen: false, camOff: 0, texts: [], feed: [], banner: null, mx: 0, my: 0, mouse: { x: 0, y: 0 }, rightDown: false, canHit: u => Sim.canHitStructure(u) };
const $ = id => document.getElementById(id);
let quality = 'high', castMode = 'normal'; // normal: 롤 기본(키→클릭), quick: 키 누르는 즉시, release: 떼는 순간
try { quality = localStorage.getItem('ibb-quality') || 'high'; castMode = localStorage.getItem('ibb-cast') || 'normal'; } catch (e) { }
const AIM_H = .75; // 스킬 조준은 몸통 높이 기준 (투사체가 날아가는 높이)

function initGfx() {
  if (R) return true;
  try { R = new Renderer(glCv); hud = new Hud(hudCv); R.setQuality(quality); }
  catch (e) { console.error(e); $('menuErr').textContent = '이 브라우저에서 3D(WebGL)를 시작하지 못했습니다. 최신 Chrome/Edge/Firefox에서 열어주세요.'; return false; }
  window.addEventListener('resize', () => { R.resize(); hud.resize(); });
  return true;
}

/* ---------------- 이벤트 → 화면 알림 ---------------- */
function banner(s, c, d) { S.banner = { s, c, t: d, max: d }; }
function hname(h) { return h.isPlayer ? h.name + '(나)' : h.name; }
function addText(x, y, s, c, big) { S.texts.push({ x, y, s, c, t: .9, rise: 0, big }); if (S.texts.length > 40) S.texts.shift(); }
function handleEvents() {
  const p = G.player;
  for (const e of G.events) {
    if (e.t === 'banner') { if (!e.to || e.to === p.id) banner(e.s, e.c, e.d); }
    else if (e.t === 'text') {
      if (e.k === 'dodge') { if (e.to === p.id || e.from === p.id) addText(e.x, e.y, e.s, '#99f6e4'); }
      else if (e.to === p.id) { if (e.k === 'heal') addText(e.x, e.y, e.s, '#5ef08a'); else if (G.heroes.some(h => h.id === e.from)) addText(e.x, e.y, e.s, '#ff6b6b'); }
      else if (e.from === p.id) addText(e.x + (Math.random() - .5) * 40, e.y, e.k === 'c' ? e.s + '!' : e.s, e.k === 'm' ? '#c4b5fd' : e.k === 't' ? '#ffffff' : e.k === 'c' ? '#fde047' : '#fdba74', e.k === 'c' || e.s >= 200);
      else if (e.k === 'heal' && e.team === p.team) addText(e.x, e.y, e.s, '#5ef08a');
    }
    else if (e.t === 'gold') { if (e.to === p.id) addText(e.x, e.y, e.s, '#facc15'); }
    else if (e.t === 'lvl') { if (e.id === p.id) { addText(p.x, p.y, '레벨 업! ' + e.lv, '#fde68a', true); if (e.lv === 6) banner('궁극기(R)를 사용할 수 있습니다!', '#fde68a', 2.5); } }
    else if (e.t === 'kill') {
      const k = G.heroes.find(h => h.id === e.killer), v = G.heroes.find(h => h.id === e.victim);
      S.feed.unshift({ k: k ? hname(k) : '포탑/미니언', kc: TEAMC[v ? 1 - v.team : 0], v: v ? hname(v) : '?', vc: TEAMC[v ? v.team : 1], t: 7 }); if (S.feed.length > 6) S.feed.pop();
      const MK = ['', '', '더블 킬!', '트리플 킬!', '쿼드라 킬!', '펜타 킬!'];
      if (e.first) banner(k === p ? '선취점! 첫 처치를 올렸습니다' : '선취점!', '#fca5a5', 2.2);
      else if (k && e.mk >= 2) banner(hname(k) + ' ' + MK[Math.min(5, e.mk)], TEAMC[k.team], 2.2);
      else if (k === p) banner('적을 처치했습니다!', '#93c5fd', 1.8);
      else if (v === p) banner('처치당했습니다', '#fca5a5', 1.8);
    }
    else if (e.t === 'end') endGame(e.winner);
  }
  G.events.length = 0;
}

/* ---------------- 루프 ---------------- */
// 고정 간격(1/60초) 시뮬레이션. 화면이 0.1초 넘게 멈추면 그 시간은 버려서
// 내가 화면을 못 보는 동안 게임이 혼자 진행되지 않게 함
const STEP = 1 / 60;
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
function frame(now) {
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(raw, .1);
  fpsT += raw; fpsN++; if (fpsT >= .5) { S.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  if (G) {
    if (!S.paused && !G.over) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { Sim.update(STEP); acc -= STEP; n++; } if (n >= 6) acc = 0; }
    handleEvents();
    for (const t of S.texts) { t.t -= dt; t.rise += dt * .9; } S.texts = S.texts.filter(t => t.t > 0);
    for (const m of S.feed) m.t -= dt; S.feed = S.feed.filter(m => m.t > 0);
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    S.mouse = R.pick(S.mx, S.my); S.aimPt = R.pickAt(S.mx, S.my, AIM_H); S.dt = dt;
    R.render(G, S.paused ? 0 : dt, { aiming: S.aiming, mouse: S.aimPt, camOff: S.camOff });
    hud.draw(G, R, S);
    hoverCursor();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- 입력 ---------------- */
function playing() { return G && !G.over && !S.paused; }
// 화면에서 유닛 모델(발부터 머리까지)과 마우스 사이 거리로 판정. 영웅을 미니언보다 우선
function unitUnderMouse(filter) {
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (u.dead || !filter(u)) continue;
    const top = u.kind === 'hero' ? 1.9 : u.kind === 'minion' ? .9 : u.kind === 'tower' ? 3.8 : 2.8;
    const a = R.project(u.x, u.y, 0), b = R.project(u.x, u.y, top), e = R.project(u.x + u.hr, u.y, 0);
    const rad = Math.max(16, Math.hypot(e.x - a.x, e.y - a.y) * 1.05);
    const d = segD(S.mx, S.my, a.x, a.y, b.x, b.y) - (u.kind === 'hero' ? 12 : 0);
    if (d < rad && d < bd) { bd = d; best = u; }
  }
  return best;
}
function segD(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - t * dx, py - y1 - t * dy); }
function castNow(i) {
  const p = G.player; const tt = p.hd.ab[i].ai.t;
  const tgt = (tt === 'target' || tt === 'exec') ? unitUnderMouse(u => targetable(p, u) && u.mobile && (tt !== 'exec' || u.kind === 'hero')) : null;
  const pt = R.pickAt(S.mx, S.my, AIM_H);
  cmd(p, { c: 'cast', i, x: tgt ? tgt.x : pt.x, y: tgt ? tgt.y : pt.y, tid: tgt ? tgt.id : 0 });
}
function hoverCursor() { if (!playing()) return; const e = unitUnderMouse(u => targetable(G.player, u)); hudCv.style.cursor = e ? 'pointer' : 'crosshair'; }
function rightClick(drag) {
  const p = G.player; if (p.dead) return; S.aiming = -1; S.amove = false;
  const e = unitUnderMouse(u => targetable(p, u));
  if (e) { cmd(p, { c: 'atk', id: e.id }); if (!drag) R.clickMarker(e.x, e.y, '#f87171'); }
  else { cmd(p, { c: 'move', x: S.mouse.x, y: S.mouse.y }); if (!drag) R.clickMarker(S.mouse.x, S.mouse.y, '#4ade80'); }
}
hudCv.addEventListener('contextmenu', e => e.preventDefault());
hudCv.addEventListener('mousemove', e => { S.mx = e.clientX; S.my = e.clientY; if (S.rightDown && playing()) { S.mouse = R.pick(S.mx, S.my); rightClick(true); } });
hudCv.addEventListener('mousedown', e => {
  S.mx = e.clientX; S.my = e.clientY; if (!playing()) return; S.mouse = R.pick(S.mx, S.my); const p = G.player;
  if (e.button === 2) { S.rightDown = true; rightClick(false); }
  else if (e.button === 0) {
    if (S.aiming >= 0) { castNow(S.aiming); S.aiming = -1; }
    else if (S.amove && !p.dead) { cmd(p, { c: 'amove', x: S.mouse.x, y: S.mouse.y }); S.amove = false; R.clickMarker(S.mouse.x, S.mouse.y, '#f87171'); }
  }
});
window.addEventListener('mouseup', e => { if (e.button === 2) S.rightDown = false; });
window.addEventListener('blur', () => { S.rightDown = false; S.tab = false; });
const KIDX = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
window.addEventListener('keydown', e => {
  if (!G) return; const c = e.code;
  if (c === 'Tab') { e.preventDefault(); S.tab = true; return; }
  if (c === 'Escape') { if (S.shopOpen) closeShop(); else if (S.aiming >= 0) S.aiming = -1; else if (!G.over) S.paused = !S.paused; return; }
  if (c === 'KeyP' || c === 'KeyB') { if (S.shopOpen) closeShop(); else if (playing()) openShop(); return; }
  if (!playing()) return; const p = G.player;
  if (c in KIDX) { e.preventDefault(); if (e.repeat || p.dead) return; const i = KIDX[c]; if (SELF_T.includes(p.hd.ab[i].ai.t) || castMode === 'quick') { castNow(i); S.aiming = -1; } else S.aiming = i; return; }
  if (c === 'KeyD') cmd(p, { c: 'spell', k: 'D', x: S.mouse.x, y: S.mouse.y });
  else if (c === 'KeyF') { const pt = R.pickAt(S.mx, S.my, AIM_H); cmd(p, { c: 'spell', k: 'F', x: pt.x, y: pt.y }); }
  else if (c === 'KeyS') cmd(p, { c: 'stop' });
  else if (c === 'KeyA') S.amove = true;
  else if (c === 'Space') { e.preventDefault(); S.camOff = 0; }
  else if (c === 'ArrowLeft') S.camOff -= 400; else if (c === 'ArrowRight') S.camOff += 400;
});
window.addEventListener('keyup', e => {
  if (!G) return; const c = e.code; if (c === 'Tab') { S.tab = false; return; }
  if (castMode === 'release' && c in KIDX && S.aiming === KIDX[c]) { if (playing()) castNow(S.aiming); S.aiming = -1; }
});

/* ---------------- 상점 ---------------- */
function openShop() { const p = G.player; if (!(p.dead || inBase(p))) { banner('기지에 있거나 사망했을 때만 구매할 수 있습니다', '#fca5a5', 1.8); return; } S.shopOpen = true; S.paused = true; renderShop(); $('shop').classList.remove('hidden'); }
function closeShop() { S.shopOpen = false; S.paused = false; $('shop').classList.add('hidden'); }
function renderShop() {
  const p = G.player, el = $('shopIn');
  let h = `<h2>상점 <span style="color:#facc15;font-size:18px;margin-left:8px">💰 ${Math.floor(p.gold)}</span></h2><p class="sub" style="margin:0">아이템을 눌러 구매하세요. 보유 아이템을 누르면 70% 가격에 판매합니다. (상점이 열려 있는 동안 게임이 멈춥니다)</p><div class="inv">`;
  for (let i = 0; i < 6; i++) { const id = p.items[i]; h += id ? `<div class="slot f" data-sell="${i}"><b>${ITEMS[id].n}</b><br>판매 +${Math.floor(ITEMS[id].c * .7)}</div>` : `<div class="slot">빈 칸</div>`; }
  h += `</div><div class="items">`;
  for (const [id, it] of Object.entries(ITEMS)) { const own = p.items.includes(id), no = !own && (p.gold < it.c || p.items.length >= 6); h += `<div class="it ${own ? 'own' : no ? 'no' : ''}" data-buy="${id}"><b>${it.n}</b><span class="c">${it.c}G</span>${own ? ' · 보유 중' : ''}<div class="s">${itemStats(it)}</div></div>`; }
  h += `</div><div class="row"><button class="btn" id="shopClose">닫기 (P / Esc)</button></div>`; el.innerHTML = h;
  el.querySelectorAll('[data-buy]').forEach(d => d.onclick = () => { cmd(p, { c: 'buy', id: d.dataset.buy }); renderShop(); });
  el.querySelectorAll('[data-sell]').forEach(d => d.onclick = () => { cmd(p, { c: 'sell', i: +d.dataset.sell }); renderShop(); });
  $('shopClose').onclick = closeShop;
}

/* ---------------- 메뉴 ---------------- */
const M = { mode: '1v1', hero: 'graff', enemy: 'random', diff: 1 };
function heroCards(sel, attr) {
  let h = '';
  for (const d of HEROES) h += `<div class="card ${sel === d.id ? 'sel' : ''}" data-${attr}="${d.id}"><div class="top"><div class="av" style="background:${d.color}">${d.name[0]}</div><div><b>${d.name}</b><div class="role">${ROLE[d.role]}</div></div></div><div class="d">${d.desc}</div>${d.passive ? `<div class="d" style="color:#a5b4fc">${d.passive}</div>` : ''}<ul>${d.ab.map((a, i) => `<li><span>${'QWER'[i]}</span>${a.n}</li>`).join('')}</ul></div>`;
  h += `<div class="card ${sel === 'random' ? 'sel' : ''}" data-${attr}="random"><div class="top"><div class="av" style="background:#e6eefc">?</div><div><b>무작위</b><div class="role">랜덤</div></div></div><div class="d">어떤 영웅이 걸릴지 모릅니다.</div></div>`;
  return h;
}
function buildMenu() {
  const m = $('menu');
  m.innerHTML = `<div class="panel"><h1>얼음 다리 난투 <small>3D</small></h1><p class="sub">얼어붙은 협곡 위 단 하나의 다리. 상대 넥서스를 먼저 부수면 승리합니다.</p>
  <div class="tabs">
    <button data-mode="1v1" class="${M.mode === '1v1' ? 'on' : ''}">⚔ AI와 1대1</button>
    <button data-mode="5v5" class="${M.mode === '5v5' ? 'on' : ''}">👥 5대5 AI 대전</button>
    <button disabled title="다음 업데이트에서 추가됩니다">🌐 온라인 1대1 <em>준비 중</em></button>
  </div>
  <h3>내 영웅</h3><div class="grid">${heroCards(M.hero, 'h')}</div>
  ${M.mode === '1v1' ? `<h3>상대 영웅</h3><div class="grid small">${heroCards(M.enemy, 'e')}</div>` : ''}
  <div class="row"><span class="lbl">AI 난이도</span><div class="seg">${DIFF.map((d, i) => `<button data-d="${i}" class="${M.diff === i ? 'on' : ''}">${d.name}</button>`).join('')}</div>
  <span class="lbl">그래픽</span><div class="seg">${[['high', '높음'], ['mid', '중간'], ['low', '낮음']].map(([k, n]) => `<button data-q="${k}" class="${quality === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  </div><div class="row" style="margin-top:12px"><span class="lbl">스킬 시전</span><div class="seg">${[['normal', '일반 (키 → 클릭)'], ['quick', '빠른 시전 (키 즉시)'], ['release', '키 떼면 시전']].map(([k, n]) => `<button data-c="${k}" class="${castMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  <div style="flex:1"></div><button class="btn" id="go">게임 시작</button></div>
  <div id="menuErr" class="err"></div>
  <div class="help"><b>조작법</b><br><kbd>우클릭</kbd> 이동·공격 (누른 채 끌면 계속 이동) &nbsp; <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd> 스킬 (시전 방식은 위에서 선택, 조준 중 <kbd>우클릭</kbd>/<kbd>Esc</kbd> 취소) &nbsp; <kbd>D</kbd> 점멸 &nbsp; <kbd>F</kbd> 눈덩이 (맞춘 뒤 다시 <kbd>F</kbd>로 돌진)<br><kbd>A</kbd>+좌클릭 공격 이동 &nbsp; <kbd>S</kbd> 정지 &nbsp; <kbd>P</kbd> 상점 (기지 또는 사망 시) &nbsp; <kbd>Tab</kbd> 점수판 &nbsp; <kbd>←</kbd><kbd>→</kbd> 카메라, <kbd>Space</kbd> 복귀 &nbsp; <kbd>Esc</kbd> 일시정지<br>전투에서 벗어나면 체력이 천천히 차고, 다리 위 초록 구슬을 먹으면 즉시 회복됩니다. 적 분수대에 들어가면 순식간에 녹습니다. 화면이 버벅이면 그래픽을 '낮음'으로 바꿔보세요.</div></div>`;
  m.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { M.mode = b.dataset.mode; buildMenu(); });
  m.querySelectorAll('[data-h]').forEach(c => c.onclick = () => { M.hero = c.dataset.h; buildMenu(); });
  m.querySelectorAll('[data-e]').forEach(c => c.onclick = () => { M.enemy = c.dataset.e; buildMenu(); });
  m.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { M.diff = +b.dataset.d; buildMenu(); });
  m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { castMode = b.dataset.c; try { localStorage.setItem('ibb-cast', castMode); } catch (e) { } buildMenu(); });
  m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { quality = b.dataset.q; try { localStorage.setItem('ibb-quality', quality); } catch (e) { } if (R) R.setQuality(quality); buildMenu(); });
  $('go').onclick = startGame;
}
function startGame() {
  if (!initGfx()) return;
  $('menu').classList.add('hidden'); $('end').classList.add('hidden');
  Object.assign(S, { aiming: -1, amove: false, paused: false, shopOpen: false, camOff: 0, texts: [], feed: [], banner: null });
  R.reset();
  G = Sim.newGame({ mode: M.mode, pick: M.hero, enemy: M.enemy, diff: M.diff });
  window.G = G; window.Sim = Sim; window.R = R; // 디버그/테스트용
  openShop();
}
function endGame(winner) {
  S.aiming = -1; const win = winner === G.player.team; banner(win ? '승리!' : '패배', win ? '#93c5fd' : '#fca5a5', 5);
  setTimeout(() => {
    const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
    let h = `<h1 style="color:${win ? '#93c5fd' : '#fca5a5'}">${win ? '승리!' : '패배'}</h1><p class="sub">게임 시간 ${mm}분 ${ss}초 · ${TEAMN[0]} ${G.kills[0]} : ${G.kills[1]} ${TEAMN[1]} · 난이도 ${DIFF[G.diff].name}</p><table><tr><th>팀</th><th>영웅</th><th>레벨</th><th>K / D / A</th><th>아이템</th></tr>`;
    for (const hh of G.heroes) h += `<tr style="${hh.isPlayer ? 'color:#ffd166;font-weight:700' : ''}"><td style="color:${TEAMC[hh.team]}">${TEAMN[hh.team]}</td><td>${hname(hh)}</td><td>${hh.level}</td><td>${hh.k} / ${hh.d} / ${hh.a}</td><td style="font-size:12px;color:#9fb3d1">${hh.items.map(i => ITEMS[i].n).join(', ')}</td></tr>`;
    h += `</table><div class="row"><button class="btn" id="again">다시 하기</button><button class="btn sec" id="toMenu">메뉴로</button></div>`; $('endIn').innerHTML = h; $('end').classList.remove('hidden');
    $('again').onclick = startGame; $('toMenu').onclick = () => { $('end').classList.add('hidden'); $('menu').classList.remove('hidden'); buildMenu(); };
  }, 2600);
}
buildMenu();
