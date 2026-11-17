// 모바일 패드 조작 (와일드 리프트 방식)
// 왼쪽 가상 조이스틱으로 이동, 오른쪽 공격 버튼 + 스킬 버튼(누르면 바로 시전, 끌면 조준 후 떼서 시전)
// 화면 위쪽 '취소' 칸으로 끌어서 놓으면 시전 취소. 빈 화면을 톡 누르면 그 유닛 상태 보기
import * as Sim from './sim.js';
const { cmd, targetable, canLevel, cdOf, costOf, spellOf, SELF_T, canShop, smiteDmg } = Sim;

const KEYS = ['Q', 'W', 'E', 'R'];
const cap = (el, id) => { try { el.setPointerCapture(id); } catch (e) { } };
const Y_SQ = .84; // 화면 세로 → 땅 세로 (카메라가 비스듬히 내려다봐서 짧아 보이는 만큼 보정)

export function initTouch(ctx) {
  const { S, R, getG, openShop, toggleShop, onPause, aimH } = ctx;
  const root = document.createElement('div'); root.id = 'touch'; root.className = 'hidden';
  root.innerHTML = `
    <div id="tJoy"><div id="tKnob"></div></div>
    <div id="tCancel">✕ 여기로 끌어 놓으면 취소</div>
    <button id="tAtk" class="tb big">공격</button>
    <button id="tLast" class="tb sm" title="미니언·몬스터 막타">막타</button>
    ${KEYS.map((k, i) => `<button id="tS${i}" class="tb sk" data-i="${i}"><b></b><i class="cd"></i><span class="pip"></span><em>${k}</em></button><button id="tL${i}" class="tb lv" data-i="${i}">+</button>`).join('')}
    <button id="tD" class="tb sp" data-k="D"></button><button id="tF" class="tb sp" data-k="F"></button>
    <button id="tRecall" class="tb mini">귀환</button>
    <button id="tShop" class="tb mini">상점<br><span id="tGold"></span></button>
    <button id="tPause" class="tb tiny">Ⅱ</button>
    <button id="tTab" class="tb tiny">점수</button>
    <button id="tFull" class="tb tiny">⛶</button>`;
  document.body.appendChild(root);
  const $ = id => root.querySelector('#' + id);
  const joy = $('tJoy'), knob = $('tKnob'), cancel = $('tCancel');
  const st = { joy: null, atk: null, last: null, aim: null };
  const P = () => getG() && getG().player;
  const live = () => { const G = getG(); return G && !G.over && !S.paused && !P().dead; };

  /* ---------- 대상 고르기 ---------- */
  const near = (p, pred, r) => { let best = null, bs = 1e9; for (const u of getG().units) { if (!targetable(p, u) || !pred(u)) continue; const d = Math.hypot(u.x - p.x, u.y - p.y) - u.r; if (d > r) continue; const sc = u.kind === 'hero' ? d * .6 + u.hp / u.maxHp * 300 : d + u.hp * .3; if (sc < bs) { bs = sc; best = u; } } return best; };
  // 공격 버튼: 사거리 근처 적 영웅 우선 → 미니언·몬스터 → 구조물
  const atkTarget = p => near(p, u => u.kind === 'hero', p.range + 260) || near(p, u => u.kind === 'minion' || u.kind === 'monster', p.range + 220) || near(p, u => !u.mobile, p.range + 300);
  const lastTarget = p => { let best = null, bh = 1e9; for (const u of getG().units) { if (!targetable(p, u) || (u.kind !== 'minion' && u.kind !== 'monster')) continue; const d = Math.hypot(u.x - p.x, u.y - p.y) - u.r; if (d > p.range + 250) continue; if (u.hp < bh) { bh = u.hp; best = u; } } return best; };

  /* ---------- 조이스틱 ---------- */
  const joyR = () => joy.getBoundingClientRect();
  function joyMove(e) {
    const r = joyR(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > max) { dx *= max / l; dy *= max / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; st.joy.dx = dx / max; st.joy.dy = dy / max;
  }
  joy.addEventListener('pointerdown', e => { e.preventDefault(); cap(joy, e.pointerId); st.joy = { id: e.pointerId, dx: 0, dy: 0, t: 0 }; joyMove(e); });
  joy.addEventListener('pointermove', e => { if (st.joy && e.pointerId === st.joy.id) joyMove(e); });
  const joyEnd = e => { if (!st.joy || e.pointerId !== st.joy.id) return; st.joy = null; knob.style.transform = ''; if (live() && !st.atk) cmd(P(), { c: 'stop' }); };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  const joyDir = () => { if (!st.joy) return null; const x = st.joy.dx, y = st.joy.dy / Y_SQ, l = Math.hypot(x, y); return l < .2 ? null : [x / l, y / l, Math.min(1, Math.hypot(st.joy.dx, st.joy.dy))]; };

  /* ---------- 공격 / 막타 (누르고 있으면 계속) ---------- */
  const hold = (el, key) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); cap(el, e.pointerId); st[key] = { id: e.pointerId, t: 0 }; el.classList.add('on'); });
    const up = e => { if (st[key] && st[key].id === e.pointerId) { st[key] = null; el.classList.remove('on'); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  hold($('tAtk'), 'atk'); hold($('tLast'), 'last');

  /* ---------- 스킬 / 소환사 주문: 톡 = 자동 조준, 끌기 = 직접 조준 ---------- */
  const abRange = a => Math.min(2600, a.ai.range || a.ai.r || 600);
  function autoPoint(p, range, units) {
    const t = near(p, u => u.kind === 'hero' && u.mobile, range + 80) || (units ? near(p, u => u.mobile, range + 60) : null);
    if (t) return { x: t.x, y: t.y, t };
    const d = joyDir(); const a = d ? Math.atan2(d[1], d[0]) : p.face || 0; return { x: p.x + Math.cos(a) * range * .8, y: p.y + Math.sin(a) * range * .8 };
  }
  function aimPoint(p, range, a = st.aim) { const len = Math.hypot(a.dx, a.dy / Y_SQ), k = Math.min(1, len / 110); const ang = Math.atan2(a.dy / Y_SQ, a.dx); return { x: p.x + Math.cos(ang) * range * Math.max(.15, k), y: p.y + Math.sin(ang) * range * Math.max(.15, k) }; }
  function startAim(e, kind, i, el) {
    e.preventDefault(); if (!live()) return; cap(el, e.pointerId);
    st.aim = { id: e.pointerId, kind, i, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, el };
    if (kind === 'ab') { const p = P(), a = p.hd.ab[i]; if (!SELF_T.includes(a.ai.t)) { S.aiming = i; S.touchAim = autoPoint(p, abRange(a), a.ai.t === 'target'); } }
    el.classList.add('on');
  }
  function moveAim(e) {
    const a = st.aim; if (!a || e.pointerId !== a.id) return; a.dx = e.clientX - a.x0; a.dy = e.clientY - a.y0; if (Math.hypot(a.dx, a.dy) > 14) a.moved = true;
    const cr = cancel.getBoundingClientRect(); a.cancel = e.clientY < cr.bottom + 10 && e.clientX > cr.left - 30 && e.clientX < cr.right + 30; cancel.classList.toggle('hot', !!a.cancel);
    if (a.kind === 'ab' && a.moved && S.aiming >= 0) S.touchAim = aimPoint(P(), abRange(P().hd.ab[a.i]));
  }
  function endAim(e) {
    const a = st.aim; if (!a || e.pointerId !== a.id) return; st.aim = null; a.el.classList.remove('on'); cancel.classList.remove('hot');
    const aimed = S.touchAim; S.aiming = -1; S.touchAim = null; if (a.cancel || !live()) return;
    const p = P();
    if (a.kind === 'ab') {
      const ab = p.hd.ab[a.i];
      if (SELF_T.includes(ab.ai.t)) { cmd(p, { c: 'cast', i: a.i, x: p.x, y: p.y, tid: 0 }); return; }
      const range = abRange(ab); let pt = a.moved ? aimPoint(p, range, a) : (aimed || autoPoint(p, range, ab.ai.t === 'target'));
      if (ab.ai.t === 'target' || ab.ai.t === 'exec') { const t = pt.t || nearestTo(p, pt, 260, ab.ai.t === 'exec'); if (t) pt = { x: t.x, y: t.y, t }; }
      cmd(p, { c: 'cast', i: a.i, x: pt.x, y: pt.y, tid: pt.t ? pt.t.id : 0 });
    } else {
      const sp = p.spells[a.k];
      if (sp === 'flash') { const d = a.moved ? [Math.cos(Math.atan2(a.dy / Y_SQ, a.dx)), Math.sin(Math.atan2(a.dy / Y_SQ, a.dx))] : joyDir() || [Math.cos(p.face || 0), Math.sin(p.face || 0)]; cmd(p, { c: 'spell', k: a.k, x: p.x + d[0] * 425, y: p.y + d[1] * 425 }); }
      else if (sp === 'smite') { const t = near(p, u => u.kind === 'monster' || u.kind === 'minion', 560); const big = getG().units.find(u => u.kind === 'monster' && u.big && !u.dead && Math.hypot(u.x - p.x, u.y - p.y) < 560); const tg = big || t; if (tg) cmd(p, { c: 'spell', k: a.k, x: tg.x, y: tg.y }); else cmd(p, { c: 'spell', k: a.k, x: p.x, y: p.y }); }
      else if (sp === 'snow') { const pt = a.moved ? (() => { const ang = Math.atan2(a.dy / Y_SQ, a.dx); return { x: p.x + Math.cos(ang) * 1200, y: p.y + Math.sin(ang) * 1200 }; })() : autoPoint(p, 1400, false); cmd(p, { c: 'spell', k: a.k, x: pt.x, y: pt.y }); }
      else cmd(p, { c: 'spell', k: a.k, x: p.x, y: p.y });
    }
  }
  function nearestTo(p, pt, r, heroOnly) { let best = null, bd = r; for (const u of getG().units) { if (!targetable(p, u) || !u.mobile || (heroOnly && u.kind !== 'hero')) continue; const d = Math.hypot(u.x - pt.x, u.y - pt.y) - (u.kind === 'hero' ? 80 : 0); if (d < bd) { bd = d; best = u; } } return best; }
  for (let i = 0; i < 4; i++) { const el = $('tS' + i); el.addEventListener('pointerdown', e => startAim(e, 'ab', i, el)); el.addEventListener('pointermove', moveAim); el.addEventListener('pointerup', endAim); el.addEventListener('pointercancel', e => { if (st.aim) st.aim.cancel = true; endAim(e); }); }
  for (const k of ['D', 'F']) { const el = $('t' + k); el.addEventListener('pointerdown', e => { startAim(e, 'sp', 0, el); if (st.aim) st.aim.k = k; }); el.addEventListener('pointermove', moveAim); el.addEventListener('pointerup', endAim); el.addEventListener('pointercancel', e => { if (st.aim) st.aim.cancel = true; endAim(e); }); }
  for (let i = 0; i < 4; i++) $('tL' + i).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (getG()) cmd(P(), { c: 'lvl', i }); });
  $('tRecall').addEventListener('pointerdown', e => { e.preventDefault(); if (live()) cmd(P(), { c: 'recall' }); });
  $('tShop').addEventListener('pointerdown', e => { e.preventDefault(); toggleShop(); });
  $('tPause').addEventListener('pointerdown', e => { e.preventDefault(); onPause(); });
  $('tTab').addEventListener('pointerdown', e => { e.preventDefault(); S.tab = !S.tab; });
  $('tFull').addEventListener('pointerdown', e => { e.preventDefault(); goFull(); });

  /* ---------- 빈 화면 톡: 상태 보기 / 미니맵 누르고 있으면 그쪽 보기 ---------- */
  const hudCv = ctx.hudCv; let mmId = null;
  hudCv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || !getG()) return; S.mx = e.clientX; S.my = e.clientY;
    const hh = ctx.hud.hitTest(e.clientX, e.clientY);
    if (hh && hh.minimap) { mmId = e.pointerId; cap(hudCv, e.pointerId); S.camAt = hh.minimap; return; }
    S.sel = ctx.unitUnder(() => true);
  });
  hudCv.addEventListener('pointermove', e => { if (e.pointerId !== mmId) return; const hh = ctx.hud.hitTest(e.clientX, e.clientY); if (hh && hh.minimap) S.camAt = hh.minimap; });
  const mmEnd = e => { if (e.pointerId === mmId) { mmId = null; S.camAt = null; } };
  hudCv.addEventListener('pointerup', mmEnd); hudCv.addEventListener('pointercancel', mmEnd);

  function goFull() { const d = document.documentElement; const f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement) { Promise.resolve(f.call(d)).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } else if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen(); }

  /* ---------- 매 프레임: 이동·공격 명령, 버튼 표시 ---------- */
  function tick(dt) {
    const G = getG(); if (!G) return; const p = G.player;
    if (S.touchAim && S.aiming >= 0) S.aimPt = S.touchAim;
    if (live()) {
      const d = joyDir(), busy = (st.atk && p.target) || (st.last && p.target);
      if (st.joy) st.joy.t -= dt;
      if (d && !busy && st.joy.t <= 0) { st.joy.t = .08; cmd(p, { c: 'move', x: p.x + d[0] * 240, y: p.y + d[1] * 240 }); }
      for (const [key, pick] of [['atk', atkTarget], ['last', lastTarget]]) {
        const h = st[key]; if (!h) continue; h.t -= dt; if (h.t > 0) continue; h.t = .12;
        const t = pick(p); if (t) { if (p.target !== t) cmd(p, { c: 'atk', id: t.id }); } else if (key === 'atk' && !d) { const a = p.face || 0; cmd(p, { c: 'amove', x: p.x + Math.cos(a) * 300, y: p.y + Math.sin(a) * 300 }); }
      }
    }
    // 버튼 상태
    for (let i = 0; i < 4; i++) {
      const el = $('tS' + i), a = p.hd.ab[i], r = p.rank[i], cd = p.cds[i], max = cdOf(p, i);
      el.querySelector('b').textContent = a.n;
      el.querySelector('.cd').style.height = r > 0 && cd > 0 ? Math.min(100, cd / max * 100) + '%' : '0';
      el.querySelector('.cd').textContent = r > 0 && cd > 0 ? Math.ceil(cd) : '';
      el.classList.toggle('off', r <= 0 || (p.maxMana > 0 && costOf(p, i) > p.mana));
      el.querySelector('.pip').textContent = r > 0 ? '•'.repeat(r) : '';
      $('tL' + i).classList.toggle('show', canLevel(p, i));
    }
    for (const k of ['D', 'F']) { const el = $('t' + k), sp = spellOf(p, k), cd = p.spellCd[k]; el.textContent = cd > 0 ? Math.ceil(cd) : sp.n; el.classList.toggle('off', cd > 0); el.classList.toggle('ready', p.spells[k] === 'smite' && cd <= 0 && G.units.some(u => u.kind === 'monster' && u.big && !u.dead && u.hp <= smiteDmg(p) && Math.hypot(u.x - p.x, u.y - p.y) < 560)); }
    $('tGold').textContent = Math.floor(p.gold) + 'G'; $('tShop').classList.toggle('off', !canShop(p));
    $('tRecall').style.display = G.mode === 'rift' ? '' : 'none';
    root.classList.toggle('aiming', !!st.aim && st.aim.kind === 'ab' && S.aiming >= 0 || (!!st.aim && st.aim.moved));
  }
  return {
    tick, el: root,
    show(on) { root.classList.toggle('hidden', !on); document.body.classList.toggle('mobile', on); },
    reset() { st.joy = st.atk = st.last = st.aim = null; knob.style.transform = ''; S.touchAim = null; }
  };
}
