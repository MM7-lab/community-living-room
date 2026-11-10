// 社區客廳 3D 導覽地圖：載入資料、切換功能、資料卡。
import { normalizePlan, normalizeCenter, DataError } from './plan-model.js';
import { createPlan2D, esc } from './plan2d.js';
import { loadThree, hasWebGL, createView3D } from './view3d.js';

const $ = s => document.querySelector(s);
const TABS = ['3d', 'tour', 'walk', 'plan', 'list'];
const S = { plan: null, data: null, view: null, plan2d: null, tab: null, v3: 'loading', cardFid: null, lastFocus: null };
const debug = window.__clr = { S };

/* ---------- 讀資料 ---------- */
function jsonWhere(text, e) {
  const m = /position (\d+)/.exec(e.message || '');
  if (!m) return '格式有錯（通常係漏咗逗號、多咗逗號，或者引號唔齊）。';
  const before = text.slice(0, +m[1]), line = before.split('\n').length, colNo = +m[1] - before.lastIndexOf('\n');
  return `第 ${line} 行第 ${colNo} 個字附近有錯（通常係漏咗逗號、多咗逗號，或者引號唔齊）。`;
}
async function getJSON(url) {
  let r;
  try { r = await fetch(url, { cache: 'no-cache' }); }
  catch (e) { throw new DataError(`連唔到網絡，讀唔到 ${url}。請檢查網絡再重新整理。`); }
  if (!r.ok) throw new DataError(`讀唔到 ${url}（${r.status}）。`);
  const text = await r.text();
  try { return JSON.parse(text); }
  catch (e) { throw new DataError(`${url} 唔係正確嘅 JSON：${jsonWhere(text, e)}`); }
}
function showFatal(e) {
  console.error(e);
  const el = $('#fatal');
  const details = e instanceof DataError ? e.details : [];
  el.innerHTML = `<div class="msg-card"><h2>網頁暫時開唔到</h2><p>${esc(e instanceof DataError ? e.message : '載入資料嗰陣出咗問題，請遲啲再試。')}</p>
    ${details.length ? `<ul>${details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="btn primary" onclick="location.reload()">重新整理</button></div>`;
  el.hidden = false;
}

/* ---------- 頁面 ---------- */
function renderShell() {
  const { center, facilities, draft } = S.data;
  $('#title').textContent = center.name;
  $('#subtitle').textContent = center.subtitle || '3D 導覽地圖';
  document.title = `${center.name}｜${center.subtitle || '3D 導覽地圖'}`;
  const dr = $('#draft');
  dr.hidden = !draft;
  dr.textContent = S.data.tentative ? '試行版：設施位置同開放時間仲整緊，會陸續補上。' : '試行版：部分資料仲整緊，會陸續補上。';

  $('#flist').innerHTML = facilities.map(f => `<li><button type="button" class="frow" data-fid="${esc(f.id)}" style="--c:${f.color}">
      <span class="frow-n">${f.no}</span><span class="frow-i" aria-hidden="true">${esc(f.icon)}</span>
      <span class="frow-main"><span class="frow-name">${esc(f.name)}${f.staffOnly ? ' <span class="tag">職員專用</span>' : ''}${f.tentative ? ' <span class="tag soft">位置暫定</span>' : ''}</span>
      <span class="frow-sum">${esc(f.summary || '簡介稍後補上')}</span>
      <span class="frow-hours">🕒 ${esc(f.hours || f.booking || '開放時間稍後補上')}</span></span>
      <span class="frow-go" aria-hidden="true">›</span></button></li>`).join('');
  $('#flist').addEventListener('click', e => { const b = e.target.closest('[data-fid]'); if (b) openCard(b.dataset.fid); });

  S.plan2d = createPlan2D({ host: $('#view-plan'), plan: S.plan, facilities, onPick: openCard });
  debug.plan2d = S.plan2d;

  const rows = [
    center.address && ['📍 地址', esc(center.address)],
    center.phone && ['📞 查詢電話', `<a href="tel:${esc(center.phone.replace(/[^\d+]/g, ''))}">${esc(center.phone)}</a>`],
  ].filter(Boolean);
  $('#info-body').innerHTML = `<h2 id="info-title">${esc(center.name)}</h2>
    ${center.subtitle ? `<p class="info-sub">${esc(center.subtitle)}</p>` : ''}
    ${rows.length ? `<dl class="card-rows">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    ${center.note ? `<p>${esc(center.note)}</p>` : ''}
    <h3>點樣用</h3>
    <ul class="howto">
      <li><b>3D 地圖</b>：撳彩色圖示睇設施資料；一指拖動轉角度，兩指放大縮細。</li>
      <li><b>自動導覽</b>：由入口開始，逐個設施介紹，可以暫停同跳過。</li>
      <li><b>漫遊</b>：好似自己行入去咁。手機用畫面上嘅掣，電腦用 W A S D 鍵同方向鍵。</li>
      <li><b>平面圖</b>：由上面望落嚟嘅圖，數字同設施列表一樣。</li>
    </ul>
    ${center.planNote ? `<p class="muted">${esc(center.planNote)}</p>` : ''}
    ${S.data.updated ? `<p class="muted">資料更新：${esc(S.data.updated)}</p>` : ''}`;
}

/* ---------- 資料卡 ---------- */
function openCard(fid) {
  const f = S.data.facilities.find(x => x.id === fid);
  if (!f) return;
  if (S.view && S.view.mode === 'tour') S.view.tour.pause();
  S.cardFid = fid;
  const ph = $('#card-photo');
  ph.style.setProperty('--c', f.color);
  ph.innerHTML = f.photo
    ? `<img src="${esc(f.photo)}" alt="${esc(f.photoAlt || f.name + '嘅相片')}" loading="lazy">`
    : `<div class="ph-empty"><span aria-hidden="true">${esc(f.icon)}</span><small>相片稍後補上</small></div>`;
  const img = ph.querySelector('img');
  if (img) img.addEventListener('error', () => { ph.innerHTML = `<div class="ph-empty"><span aria-hidden="true">${esc(f.icon)}</span><small>相片暫時睇唔到</small></div>`; }, { once: true });
  $('#card-kicker').innerHTML = `<span class="num" style="--c:${f.color}">${f.no}</span>設施 ${f.no} / ${S.data.facilities.length}${f.staffOnly ? '<span class="tag">職員專用</span>' : ''}${f.tentative ? '<span class="tag soft">位置暫定</span>' : ''}`;
  $('#card-title').innerHTML = `<span aria-hidden="true">${esc(f.icon)}</span> ${esc(f.name)}`;
  $('#card-summary').textContent = f.summary || '簡介稍後補上。';
  $('#card-summary').classList.toggle('pending', !f.summary);
  const row = (k, v) => `<div><dt>${k}</dt><dd${v ? '' : ' class="pending"'}>${v ? esc(v) : '資料稍後補上'}</dd></div>`;
  $('#card-rows').innerHTML = row('🕒 開放時間', f.hours) + row('📝 預約方法', f.booking);
  openSheet('#card');
  S.view?.highlight(fid);
  S.plan2d?.highlight(fid);
}
function openSheet(sel) {
  const el = $(sel);
  if (el.hidden) S.lastFocus = document.activeElement;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  el.querySelector('.close-btn').focus({ preventScroll: true });
}
function closeSheet(el) {
  if (!el || el.hidden) return;
  el.classList.remove('open'); el.hidden = true;
  if (el.id === 'card') { S.cardFid = null; if (S.view && S.view.mode === 'overview') S.view.highlight(null); }
  S.lastFocus?.focus?.({ preventScroll: true });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) closeSheet(e.target.closest('.sheet'));
  const g = e.target.closest('[data-goto]'); if (g) setTab(g.dataset.goto);
  const a = e.target.closest('[data-act]');
  if (a && S.cardFid) {
    const fid = S.cardFid;
    closeSheet($('#card'));
    if (a.dataset.act === 'show3d') { setTab('3d'); S.view?.focus(fid); S.plan2d.highlight(fid); }
    if (a.dataset.act === 'showplan') {
      setTab('plan'); S.plan2d.highlight(fid);
      document.querySelector(`.ppin[data-fid="${CSS.escape(fid)}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.sheet')].find(s => !s.hidden);
  if (open) { e.preventDefault(); closeSheet(open); }
});
$('#info-btn').addEventListener('click', () => openSheet('#info'));

/* ---------- 功能切換 ---------- */
function setTab(tab, { push = true } = {}) {
  if (!TABS.includes(tab)) tab = '3d';
  const restartTour = tab === 'tour' && S.tab === 'tour';
  S.tab = tab;
  document.querySelectorAll('.tabs [data-tab]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
  });
  const in3d = tab === '3d' || tab === 'tour' || tab === 'walk';
  $('#view-3d').hidden = !in3d; $('#view-plan').hidden = tab !== 'plan'; $('#view-list').hidden = tab !== 'list';
  if (push) history.replaceState(null, '', '#' + tab);
  if (tab === 'plan') S.plan2d?.layout();
  applyMode(restartTour);
}
function applyMode(restartTour) {
  const tab = S.tab, ready = S.v3 === 'ready', v = S.view;
  const in3d = tab === '3d' || tab === 'tour' || tab === 'walk';
  $('#tourbar').hidden = !(ready && tab === 'tour');
  $('#walkui').hidden = !(ready && tab === 'walk');
  $('#v3-tools').hidden = !(ready && tab === '3d');
  if (!ready) return;
  v.setActive(in3d);
  if (!in3d) { if (v.mode === 'tour') v.tour.pause(); return; }
  if (tab === '3d') { v.setMode('overview'); showHint(); }
  if (tab === 'walk') {
    v.setMode('walk');
    const h = $('#walk-hint'); h.classList.remove('fade');
    clearTimeout(walkHintTimer); walkHintTimer = setTimeout(() => h.classList.add('fade'), 8000);
  }
  if (tab === 'tour' && (restartTour || v.mode !== 'tour' || !v.tour.state().active)) v.tour.start();
  else if (tab === 'tour' && v.tour.state().paused && S.cardFid == null) v.tour.resume();
  updateInset();
}
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = TABS.indexOf(S.tab), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  setTab(n); document.querySelector(`.tabs [data-tab="${n}"]`).focus();
});
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== S.tab) setTab(t, { push: false }); });

let hintTimer = 0, hintShown = false, walkHintTimer = 0;
function showHint() {
  if (hintShown) return;
  hintShown = true;
  const h = $('#hint'); h.hidden = false;
  const hide = () => { h.classList.add('fade'); setTimeout(() => { h.hidden = true; }, 400); };
  hintTimer = setTimeout(hide, 7000);
  $('#v3-canvas').addEventListener('pointerdown', () => { clearTimeout(hintTimer); hide(); }, { once: true });
}

/* ---------- 3D ---------- */
function set3D(status, text) {
  S.v3 = status;
  $('#v3-msg').hidden = status === 'ready';
  $('#v3-msg-text').textContent = text || '';
  $('#v3-msg-actions').hidden = status === 'loading';
  $('#v3-retry').hidden = status !== 'neterr';
  applyMode();
}
async function init3D() {
  if (!hasWebGL()) { set3D('nogl', '你部機暫時顯示唔到 3D 模型。可以改睇平面圖或者設施列表，資料係一樣嘅。'); return; }
  set3D('loading', '載入緊 3D 模型…');
  try { await loadThree(); }
  catch (e) { console.error(e); set3D('neterr', '3D 模型載入唔到，可能係網絡唔穩定。'); return; }
  try {
    S.view = createView3D({
      canvasHost: $('#v3-canvas'), pinHost: $('#v3-pins'), minimap: $('#minimap'),
      plan: S.plan, facilities: S.data.facilities, start: S.data.start,
      obstacles: [...document.querySelectorAll('.v3-tools button, .walkui button, .dpad, .turnpad, .minimap')],
      onPick: fid => { if (fid) openCard(fid); },
      onTour: renderTour,
      onWalk: p => S.plan2d.setMe(p.x, p.y, p.yaw),
      onExitWalk: () => setTab('3d'),
      onMode: m => { document.body.dataset.mode = m; },
    });
    debug.view = S.view;
  } catch (e) {
    console.error(e);
    set3D('nogl', '你部機暫時顯示唔到 3D 模型。可以改睇平面圖或者設施列表，資料係一樣嘅。');
    return;
  }
  set3D('ready');
}
$('#v3-retry').addEventListener('click', init3D);
$('#btn-walls').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on);
  e.currentTarget.textContent = on ? '改返矮牆' : '顯示完整牆身';
  S.view?.setFullWalls(on);
});
$('#btn-reset').addEventListener('click', () => S.view?.resetView());

/* ---------- 自動導覽 ---------- */
let tourKey = '';
function renderTour(st) {
  $('#tour-bar').style.width = (st.progress * 100).toFixed(1) + '%';
  const key = `${st.idx}|${st.phase === 'done'}|${st.paused}`;
  if (key === tourKey) return;
  tourKey = key;
  const done = st.phase === 'done', f = S.data.facilities[st.idx];
  $('#tour-ctrl').hidden = done; $('#tour-done').hidden = !done;
  $('#tour-more').hidden = done;
  $('#tour-step').textContent = done ? '導覽完結' : `第 ${st.idx + 1} 站，共 ${st.total} 站`;
  $('#tour-title').innerHTML = done ? '多謝收睇 🎉' : `<span aria-hidden="true">${esc(f.icon)}</span> ${esc(f.name)}${f.staffOnly ? ' <span class="tag">職員專用</span>' : ''}`;
  $('#tour-text').textContent = done ? '可以撳「再睇一次」，或者返去 3D 地圖自己周圍睇。' : (f.tour || f.summary || '簡介稍後補上。');
  const play = $('#tour-play');
  play.innerHTML = st.paused ? '▶<span>繼續</span>' : '⏸<span>暫停</span>';
  play.setAttribute('aria-label', st.paused ? '繼續導覽' : '暫停導覽');
  $('#tour-prev').disabled = st.idx === 0 && !done;
  S.plan2d.highlight(f?.id);
  updateInset();
}
$('#tour-play').addEventListener('click', () => { const st = S.view.tour.state(); st.paused ? S.view.tour.resume() : S.view.tour.pause(); });
$('#tour-next').addEventListener('click', () => S.view.tour.next());
$('#tour-prev').addEventListener('click', () => S.view.tour.prev());
$('#tour-stop').addEventListener('click', () => setTab('3d'));
$('#tour-exit').addEventListener('click', () => setTab('3d'));
$('#tour-again').addEventListener('click', () => S.view.tour.start());
$('#tour-more').addEventListener('click', () => { const st = S.view.tour.state(); if (st.fid) openCard(st.fid); });
// 導覽字卡遮住畫面下半部，所以將設施擺高少少。
function updateInset() {
  if (!S.view) return;
  const bar = $('#tourbar');
  S.view.setInset?.(S.tab === 'tour' && !bar.hidden ? bar.offsetHeight + 16 : 0);
}
new ResizeObserver(updateInset).observe($('#tourbar'));

/* ---------- 漫遊掣 ---------- */
document.querySelectorAll('[data-wk]').forEach(btn => {
  const k = btn.dataset.wk;
  const down = e => { e.preventDefault(); btn.classList.add('down'); try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 冇所謂 */ } S.view?.walkPad(k, true); };
  const up = () => { btn.classList.remove('down'); S.view?.walkPad(k, false); };
  btn.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => btn.addEventListener(t, up));
  btn.addEventListener('contextmenu', e => e.preventDefault());
});
$('#walk-home').addEventListener('click', () => S.view?.walkHome());
const coarse = window.matchMedia('(pointer: coarse)').matches;
$('#walk-hint').textContent = coarse
  ? '撳住掣行路・拖動畫面望四周・撳小地圖可以去嗰度'
  : 'W A S D 行路・方向鍵轉身・拖動畫面望四周・Shift 行快啲・Esc 返回';

/* ---------- 開始 ---------- */
async function boot() {
  try {
    const [p, c] = await Promise.all([getJSON('data/plan.json'), getJSON('data/center.json')]);
    S.plan = normalizePlan(p);
    S.data = normalizeCenter(c, S.plan);
    if (S.data.errors.length) throw new DataError('設施資料檔（data/center.json）有以下問題：', S.data.errors);
    S.data.warnings.forEach(w => console.warn(w));
  } catch (e) { showFatal(e); return; }
  debug.data = S.data; debug.plan = S.plan;
  renderShell();
  const t = location.hash.slice(1);
  setTab(TABS.includes(t) ? t : '3d', { push: false });
  await init3D();
  debug.ready = true;
}
boot();
