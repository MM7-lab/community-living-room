// 2D 平面圖：同 3D 用同一份 plan.json 同設施座標，所以位置一定一致。
import { CATALOG, baseSegments, openingsOf, holesOn, solidSpans } from './plan-model.js';

const r2 = n => Math.round(n * 10) / 10;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 傢俬符號（同辦公室工具一樣：w 沿 x，h = 深度沿 y，正面向 +y）。
const BRIGHT = ['#D9573F', '#5B8FC9', '#79B86F', '#F2C14E', '#EE9FB0', '#9C83C9', '#E59A62', '#3E9C8F'];
function symbol(sym, w, h, type = '') {
  const X = -w / 2, Y = -h / 2;
  const rect = (x, y, ww, hh, cls = 'f-body', rx = 0) => `<rect class="${cls}" x="${r2(x)}" y="${r2(y)}" width="${r2(ww)}" height="${r2(hh)}"${rx ? ` rx="${r2(rx)}"` : ''}/>`;
  const line = (x1, y1, x2, y2, cls = 'f-line') => `<line class="${cls}" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"/>`;
  switch (sym) {
    case 'desk': return rect(X, Y, w, h, 'f-body', 3) + line(X + w * .28, Y + h * .14, X + w * .72, Y + h * .14);
    case 'chair': return rect(X + w * .08, Y, w * .84, h * .82, 'f-chair', Math.min(w, h) * .22) + rect(X, Y + h * .74, w, h * .26, 'f-chair', h * .1);
    case 'meeting': return rect(X, Y, w, h, 'f-body', Math.min(w, h) * .12) + rect(X + w * .08, Y + h * .18, w * .84, h * .64, 'f-line', Math.min(w, h) * .08);
    case 'panel': return rect(X, Y, w, Math.max(h, 4), 'f-panel', 2);
    case 'ushape': { const t = Math.min(6, w / 4, h / 4); return rect(X, Y, w, t, 'f-panel') + rect(X, Y, t, h, 'f-panel') + rect(X + w - t, Y, t, h, 'f-panel'); }
    case 'cabinet': return rect(X, Y, w, h, 'f-body', 2) + (w >= 60 ? line(0, Y, 0, Y + h) : '') + line(X + w * .1, Y + h * .8, X + w * .9, Y + h * .8);
    case 'drawers': return rect(X, Y, w, h, 'f-body', 2) + line(X + w * .12, Y + h * .8, X + w * .88, Y + h * .8);
    case 'shelf': return rect(X, Y, w, h, 'f-shelf', 2) + line(X, Y + h * .5, X + w, Y + h * .5);
    case 'printer': return rect(X, Y, w, h, 'f-dark', 4) + rect(X + w * .2, Y + h * .08, w * .6, h * .26, 'f-line');
    case 'tv': return rect(X, Y, w, Math.max(h, 6), 'f-dark', 2);
    case 'appliance': return rect(X, Y, w, h, 'f-body', 3) + rect(X + w * .08, Y + h * .18, w * .62, h * .64, 'f-line', 2);
    case 'box': return rect(X, Y, w, h, 'f-box', 2) + line(X, Y, X + w, Y + h) + line(X + w, Y, X, Y + h);
    case 'plant': return `<circle class="f-plant" cx="0" cy="0" r="${r2(w / 2)}"/>`;
    case 'door': return `<path class="f-swing" d="M ${r2(X)} ${r2(Y)} A ${r2(w)} ${r2(h)} 0 0 1 ${r2(X + w)} ${r2(Y + h)}"/>` + line(X, Y + h, X, Y, 'f-leaf');
    case 'door2': { const r = w / 2; return line(X, Y + h, X, Y + h - r, 'f-leaf') + line(X + w, Y + h, X + w, Y + h - r, 'f-leaf') + `<path class="f-swing" d="M ${r2(X)} ${r2(Y + h - r)} A ${r2(r)} ${r2(r)} 0 0 1 0 ${r2(Y + h)} M ${r2(X + w)} ${r2(Y + h - r)} A ${r2(r)} ${r2(r)} 0 0 0 0 ${r2(Y + h)}"/>`; }
    case 'column': return rect(X, Y, w, h, 'f-col');
    case 'window': return rect(X, -5, w, 10, 'f-win') + line(X, 0, X + w, 0, 'f-winline');
    // 設施傢俬
    case 'coffeebar': return rect(X, Y, w, h, 'f-wood', 3) + rect(X + 14, Y + 4, 48, 38, 'f-red', 4) + `<circle class="f-dark" cx="${r2(X + 86)}" cy="${r2(Y + 20)}" r="10"/>` + [0, 1, 2, 3].map(i => `<circle class="f-white" cx="${r2(X + w - 50 + i * 10)}" cy="${r2(Y + h - 14)}" r="3.5"/>`).join('');
    case 'stool': return `<circle class="${type === 'kids_stool' ? 'f-kid' : 'f-chair'}" cx="0" cy="0" r="${r2(w / 2)}"/>`;
    case 'kitchen': return rect(X, Y, w, h, 'f-white', 3) + rect(-w / 4 - 22, -17, 45, 35, 'f-line', 4) + `<circle class="f-line" cx="${r2(w / 4 - 12)}" cy="0" r="10"/><circle class="f-line" cx="${r2(w / 4 + 14)}" cy="0" r="10"/>`;
    case 'fridge': return rect(X, Y, w, h, 'f-white', 3) + line(X + 4, Y + h - 6, X + w - 4, Y + h - 6);
    case 'sofa': return rect(X, Y, w, h, 'f-sofa', 10) + rect(X + 12, Y + 18, w - 24, h - 22, 'f-cushion', 6);
    case 'table': return rect(X, Y, w, h, type === 'kids_table' ? 'f-kid' : type === 'folding_table' ? 'f-body' : 'f-wood', 4);
    case 'roundtable': return `<circle class="f-wood" cx="0" cy="0" r="${r2(w / 2)}"/>`;
    case 'massage': return rect(X + 4, Y, w - 8, h, 'f-leather', 18) + rect(X + 16, Y + 6, w - 32, 20, 'f-cushion', 8) + rect(X + 14, Y + 34, w - 28, h - 70, 'f-cushion', 8);
    case 'treadmill': return rect(X, Y, w, h, 'f-dark', 6) + rect(X + 8, Y + 30, w - 16, h - 40, 'f-belt', 3);
    case 'bike': return rect(-6, Y, 12, h, 'f-dark', 3) + `<circle class="f-white" cx="0" cy="${r2(Y + 28)}" r="16"/>` + rect(X, Y + 10, w, 6, 'f-dark', 3) + rect(-11, Y + h - 45, 22, 30, 'f-dark', 6);
    case 'mat': return rect(X, Y, w, h, 'f-mat', 6);
    case 'bookshelf': return rect(X, Y, w, h, 'f-wood', 2) + Array.from({ length: Math.floor((w - 8) / 7) }, (_, i) => `<rect x="${r2(X + 4 + i * 7)}" y="${r2(Y + h * 0.3)}" width="5.5" height="${r2(h * 0.6)}" style="fill:${BRIGHT[(i * 5 + 3) % BRIGHT.length]}"/>`).join('');
    case 'playmat': { const cols = ['#F2C14E', '#7FB8E0', '#F08A7E', '#8FCB8A', '#C9A3E0', '#F6B26B']; let s = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s += `<rect x="${r2(X + w / 4 * i)}" y="${r2(Y + h / 3 * j)}" width="${r2(w / 4)}" height="${r2(h / 3)}" style="fill:${cols[(i + j * 2) % cols.length]};fill-opacity:.75"/>`; return s + rect(X, Y, w, h, 'f-line', 6); }
    case 'toyshelf': return rect(X, Y, w, h, 'f-white', 2) + [0, 1, 2].map(i => `<rect x="${r2(X + w / 3 * i + 4)}" y="${r2(Y + h - 10)}" width="${r2(w / 3 - 8)}" height="8" style="fill:${BRIGHT[i * 2]}"/>`).join('');
    case 'laundry': return rect(X, Y, w, h, 'f-white', 4) + `<circle class="f-drum" cx="0" cy="${r2(h * 0.08)}" r="${r2(Math.min(w, h) * 0.3)}"/>`;
    default: return rect(X, Y, w, h);
  }
}

function planSvg(plan, facilities, vb) {
  let h = `<svg class="plan-svg" viewBox="${r2(vb.x)} ${r2(vb.y)} ${r2(vb.w)} ${r2(vb.h)}" role="img" aria-label="社區客廳平面圖">`;
  plan.rooms.forEach(r => { h += `<polygon class="p-room" points="${r.pts.map(p => r2(p.x) + ',' + r2(p.y)).join(' ')}"/>`; });
  facilities.forEach(f => {
    if (f.area) h += `<polygon class="p-area" data-area="${esc(f.id)}" style="--c:${f.color}" points="${f.area.map(p => r2(p.x) + ',' + r2(p.y)).join(' ')}"/>`;
  });
  // 先畫傢俬，再畫牆，最後畫門窗。
  const layer = it => (it.type === 'door' || it.type === 'door2' || it.type === 'window' || it.type === 'column') ? 2 : 1;
  const items = plan.items.slice().sort((a, b) => layer(a) - layer(b));
  const furn = it => `<g transform="translate(${r2(it.x)} ${r2(it.y)}) rotate(${it.r || 0})">${symbol(CATALOG[it.type].sym, it.w, it.h, it.type)}</g>`;
  items.filter(it => layer(it) === 1).forEach(it => { h += furn(it); });
  const opens = openingsOf(plan);
  baseSegments(plan).forEach(sg => {
    const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, L = Math.hypot(dx, dy);
    if (L < 1) return;
    const ux = dx / L, uy = dy / L;
    solidSpans(L, holesOn(sg, opens)).forEach(([s0, s1]) => {
      h += `<line class="p-wall${sg.glass ? ' glass' : ''}" stroke-width="${sg.glass ? 6 : sg.t}" x1="${r2(sg.a.x + ux * s0)}" y1="${r2(sg.a.y + uy * s0)}" x2="${r2(sg.a.x + ux * s1)}" y2="${r2(sg.a.y + uy * s1)}"/>`;
    });
  });
  items.filter(it => layer(it) === 2).forEach(it => { h += furn(it); });
  return h + '</svg>';
}

export function createPlan2D({ host, plan, facilities, onPick }) {
  const b = plan.bounds, pad = 60;
  const vb = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  const pct = p => ({ x: (p.x - vb.x) / vb.w * 100, y: (p.y - vb.y) / vb.h * 100 });
  host.innerHTML = `
    <div class="plan-bar" role="group" aria-label="平面圖縮放">
      <button type="button" class="chip-btn" data-zoom="-1" aria-label="縮細">－</button>
      <span class="plan-zoom" aria-live="polite">100%</span>
      <button type="button" class="chip-btn" data-zoom="1" aria-label="放大">＋</button>
      <span class="plan-hint">撳數字睇設施資料</span>
    </div>
    <div class="plan-scroll">
      <div class="plan-box">
        ${planSvg(plan, facilities, vb)}
        <svg class="plan-leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        ${facilities.map(f => `<button type="button" class="ppin" data-fid="${esc(f.id)}" style="--c:${f.color}" aria-label="${f.no}. ${esc(f.name)}"><span class="ppin-n">${f.no}</span><span class="ppin-i" aria-hidden="true">${esc(f.icon)}</span></button>`).join('')}
        <div class="pme" hidden aria-label="你喺度"><span class="pme-arrow"></span><span class="pme-text">你喺度</span></div>
      </div>
    </div>
    <ol class="legend">
      ${facilities.map(f => `<li><button type="button" data-fid="${esc(f.id)}" style="--c:${f.color}"><span class="lg-n">${f.no}</span><span class="lg-i" aria-hidden="true">${esc(f.icon)}</span><span class="lg-name">${esc(f.name)}</span>${f.staffOnly ? '<span class="tag">職員專用</span>' : ''}</button></li>`).join('')}
    </ol>`;
  const scroll = host.querySelector('.plan-scroll'), box = host.querySelector('.plan-box');
  const pins = [...host.querySelectorAll('.ppin')], leaders = host.querySelector('.plan-leaders');
  const me = host.querySelector('.pme');
  const ZOOMS = [1, 1.5, 2.2, 3];
  let zi = 0;

  host.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]');
    if (z) { zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + +z.dataset.zoom)); layout(true); return; }
    const p = e.target.closest('[data-fid]');
    if (p) onPick?.(p.dataset.fid);
  });

  // 設施標記太近會疊埋：喺螢幕上推開少少，再用細線連返真正位置。
  function spread(W, H) {
    const P = facilities.map(f => { const q = pct(f.at); return { x0: q.x / 100 * W, y0: q.y / 100 * H, x: q.x / 100 * W, y: q.y / 100 * H }; });
    const min = 52;
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], c = P[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
        if (d < min) {
          const ux = d > .01 ? dx / d : 1, uy = d > .01 ? dy / d : 0, push = (min - d) / 2;
          a.x -= ux * push; a.y -= uy * push; c.x += ux * push; c.y += uy * push; moved = true;
        }
      }
      if (!moved) break;
    }
    P.forEach(p => { p.x = Math.max(18, Math.min(W - 18, p.x)); p.y = Math.max(18, Math.min(H - 18, p.y)); });
    return P;
  }
  function layout(keepCenter) {
    const cw = scroll.clientWidth, maxH = Math.max(280, scroll.clientHeight || window.innerHeight * .62);
    if (!cw) return;
    const fitW = Math.min(cw, maxH * vb.w / vb.h);
    const cx = (scroll.scrollLeft + cw / 2) / (box.offsetWidth || 1), cy = (scroll.scrollTop + scroll.clientHeight / 2) / (box.offsetHeight || 1);
    const W = Math.round(fitW * ZOOMS[zi]), H = Math.round(W * vb.h / vb.w);
    box.style.width = W + 'px'; box.style.height = H + 'px';
    host.querySelector('.plan-zoom').textContent = Math.round(ZOOMS[zi] * 100) + '%';
    host.querySelector('[data-zoom="-1"]').disabled = zi === 0;
    host.querySelector('[data-zoom="1"]').disabled = zi === ZOOMS.length - 1;
    const P = spread(W, H);
    let lines = '';
    pins.forEach((el, i) => {
      const p = P[i];
      el.style.left = (p.x / W * 100) + '%'; el.style.top = (p.y / H * 100) + '%';
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) {
        lines += `<line x1="${r2(p.x0 / W * 100)}" y1="${r2(p.y0 / H * 100)}" x2="${r2(p.x / W * 100)}" y2="${r2(p.y / H * 100)}"/><line class="dot" x1="${r2(p.x0 / W * 100)}" y1="${r2(p.y0 / H * 100)}" x2="${r2(p.x0 / W * 100)}" y2="${r2(p.y0 / H * 100)}"/>`;
      }
    });
    leaders.innerHTML = lines;
    if (keepCenter) { scroll.scrollLeft = cx * W - cw / 2; scroll.scrollTop = cy * H - scroll.clientHeight / 2; }
  }
  new ResizeObserver(() => layout(false)).observe(scroll);

  return {
    layout: () => layout(false),
    highlight(fid) {
      pins.forEach(el => el.classList.toggle('is-on', el.dataset.fid === fid));
      host.querySelectorAll('.p-area').forEach(el => el.classList.toggle('is-on', el.dataset.area === fid));
    },
    // 漫遊時記低位置，喺平面圖顯示「你喺度」。yaw 同辦公室工具一樣（弧度）。
    setMe(x, y, yaw) {
      const q = pct({ x, y });
      me.hidden = false;
      me.style.left = q.x + '%'; me.style.top = q.y + '%';
      me.querySelector('.pme-arrow').style.transform = `rotate(${-yaw * 180 / Math.PI}deg)`;
    },
    // 測試用：設施喺平面圖上嘅真實位置（百分比）。
    pinPercent: fid => { const f = facilities.find(x => x.id === fid); return f ? pct(f.at) : null; },
  };
}
