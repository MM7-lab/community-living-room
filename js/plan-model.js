// 平面圖同設施資料嘅計算（唔涉及畫面，瀏覽器同 node 都用得）。
// 座標同「新辦公室平面圖」工具一樣：單位 cm，x 向右，y 向下。

export const WALL_H = 270;   // 牆高（同辦公室工具一樣）
export const LOW_H = 110;    // 「矮牆」模式，方便由上面望入去
export const WALK_R = 22;    // 漫遊時人嘅半徑（cm）
export const EYE_H = 155;    // 漫遊時眼睛高度（cm）
export const FLOOR_H = 350;  // 層與層之間（大約：20 級 × 17.5 cm；天花 270，其餘係樓板同天花內）
// 直樓梯預設值（樓梯本地座標：闊沿 x，長沿 y；+y 係樓梯底，-y 係樓梯頂）
export const STAIR = { w: 120, run: 480, risers: 20, well: 400 };
const HEADROOM = 230; // 樓梯底下淨高少過呢個數就當行唔到（cm）

// 傢俬類型：同辦公室工具嘅清單一致（w 闊、d 深、ht 高，單位 cm）。
export const CATALOG = {
  desk: { w: 140, d: 70, ht: 75, sym: 'desk' },
  hpart_h: { w: 148, d: 5, ht: 108, sym: 'panel' },
  hpart_v: { w: 145, d: 5, ht: 108, sym: 'panel' },
  boss: { w: 290, d: 145, ht: 110, sym: 'ushape' },
  rack57: { w: 57, d: 45, ht: 185, sym: 'shelf' },
  rack60a: { w: 60, d: 45, ht: 222, sym: 'shelf' },
  rack60b: { w: 60, d: 35, ht: 183, sym: 'shelf' },
  rack75: { w: 75, d: 45, ht: 185, sym: 'shelf' },
  printer: { w: 86, d: 69, ht: 116, sym: 'printer' },
  tv: { w: 123, d: 10, ht: 71, sym: 'tv' },
  microwave: { w: 49, d: 34, ht: 27, sym: 'appliance' },
  oven: { w: 53, d: 45, ht: 37, sym: 'appliance' },
  supplybox: { w: 59, d: 45, ht: 40, sym: 'box' },
  signin: { w: 100, d: 46, ht: 85, sym: 'cabinet' },
  pantry: { w: 120, d: 41, ht: 216, sym: 'cabinet' },
  incentive: { w: 33, d: 46, ht: 89, sym: 'drawers' },
  window1: { w: 42, d: 40, ht: 105, sym: 'cabinet' },
  window2: { w: 42, d: 29, ht: 59, sym: 'cabinet' },
  cube3: { w: 33, d: 30, ht: 90, sym: 'cabinet' },
  sqcab: { w: 40, d: 30, ht: 40, sym: 'cabinet' },
  rectcab: { w: 36, d: 31, ht: 80, sym: 'cabinet' },
  bigrect: { w: 121, d: 35, ht: 78, sym: 'cabinet' },
  roomdrawer: { w: 48, d: 60, ht: 132, sym: 'drawers' },
  roomsupply: { w: 100, d: 40, ht: 200, sym: 'cabinet' },
  chair: { w: 50, d: 50, ht: 90, sym: 'chair', name: '椅' },
  meeting: { w: 240, d: 110, ht: 75, sym: 'meeting' },
  door: { w: 90, d: 90, ht: 210, sym: 'door' },
  door2: { w: 140, d: 70, ht: 210, sym: 'door2' },
  column: { w: 40, d: 40, ht: 0, sym: 'column' },
  plant: { w: 50, d: 50, ht: 0, sym: 'plant' },
  window: { w: 120, d: 10, ht: 0, sym: 'window' },
  // 社區客廳設施傢俬（寫喺 center.json 各設施嘅 furniture；尺寸係常見款式嘅大約數，可以逐件改 w／d／ht）
  coffee_bar: { w: 160, d: 60, ht: 95, sym: 'coffeebar', name: '咖啡吧枱（連咖啡機）' },
  bar_stool: { w: 40, d: 40, ht: 75, sym: 'stool', name: '高腳凳' },
  kitchen_counter: { w: 150, d: 60, ht: 90, sym: 'kitchen', name: '廚房工作枱（連盆同電磁爐）' },
  fridge: { w: 60, d: 65, ht: 175, sym: 'fridge', name: '雪櫃' },
  sofa: { w: 200, d: 85, ht: 85, sym: 'sofa', name: '梳化' },
  coffee_table: { w: 100, d: 50, ht: 42, sym: 'table', name: '茶几' },
  tv_cabinet: { w: 160, d: 40, ht: 50, sym: 'cabinet', name: '電視櫃' },
  massage_chair: { w: 80, d: 130, ht: 115, sym: 'massage', name: '按摩椅' },
  treadmill: { w: 80, d: 180, ht: 140, sym: 'treadmill', name: '跑步機' },
  exercise_bike: { w: 55, d: 100, ht: 120, sym: 'bike', name: '健身單車' },
  gym_mat: { w: 180, d: 60, ht: 2, sym: 'mat', name: '運動墊' },
  bookshelf: { w: 90, d: 35, ht: 180, sym: 'bookshelf', name: '書櫃' },
  reading_table: { w: 90, d: 90, ht: 75, sym: 'roundtable', name: '圓形閱讀枱' },
  play_mat: { w: 220, d: 170, ht: 3, sym: 'playmat', name: '兒童遊戲地墊（連玩具）' },
  toy_shelf: { w: 120, d: 35, ht: 75, sym: 'toyshelf', name: '玩具櫃' },
  kids_table: { w: 80, d: 60, ht: 50, sym: 'table', name: '兒童枱' },
  kids_stool: { w: 30, d: 30, ht: 30, sym: 'stool', name: '兒童凳' },
  laundry_tower: { w: 60, d: 65, ht: 172, sym: 'laundry', name: '洗衣機＋乾衣機（上下疊）' },
  folding_table: { w: 120, d: 60, ht: 80, sym: 'table', name: '摺衫枱' },
  armchair: { w: 75, d: 75, ht: 80, sym: 'armchair', name: '單人梳化' },
  rug: { w: 290, d: 200, ht: 1, sym: 'rug', name: '地氈' },
  play_tunnel: { w: 60, d: 185, ht: 60, sym: 'tunnel', name: '遊戲隧道' },
  health_kiosk: { w: 100, d: 60, ht: 130, sym: 'kiosk', name: '健康站（量度機）' },
  dining_table: { w: 165, d: 85, ht: 75, sym: 'table', name: '餐枱' },
  arch_partition: { w: 200, d: 12, ht: 255, sym: 'arch', name: '拱門屏風' },
  // 裝飾（deco）：唔擋路、唔檢查撞位
  upper_cabinet: { w: 100, d: 35, ht: 100, sym: 'upper', name: '吊櫃', deco: true },
  ring_light: { w: 120, d: 120, ht: 4, sym: 'ring', name: '圓形吊燈', deco: true },
  acoustic_green: { w: 90, d: 3, ht: 90, sym: 'acoustic', name: '吸音板', deco: true },
  acoustic_blue: { w: 90, d: 3, ht: 90, sym: 'acoustic', name: '吸音板', deco: true },
  kiosk_wall: { w: 70, d: 10, ht: 240, sym: 'kioskwall', name: '自助服務機（牆身）', deco: true },
  baffle_ceiling: { w: 300, d: 300, ht: 1, sym: 'baffle', name: '黑色格柵天花', deco: true },
  handrail: { w: 110, d: 6, ht: 95, sym: 'rail', name: '扶手' },
  platform: { w: 120, d: 150, ht: 29, sym: 'platform', name: '兩級台階' },
  stairs: { w: 120, d: 480, ht: 350, sym: 'stairs', name: '樓梯', internal: true }, // 由設施 "stairs" 自動產生
};
export const FURNITURE_TYPES = Object.keys(CATALOG).filter(k => CATALOG[k].name && !CATALOG[k].internal);
const OPENING_TYPES = new Set(['door', 'door2', 'window']);

export class DataError extends Error {
  constructor(message, details = []) { super(message); this.details = details; }
}

export const rad = d => d * Math.PI / 180;
const isNum = v => typeof v === 'number' ? Number.isFinite(v) : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v));

/* ---------- 幾何 ---------- */
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}
export function centroid(pts) {
  const A = polyArea(pts);
  if (Math.abs(A) < 1) { const n = pts.length || 1; return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }; }
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], f = p.x * q.y - q.x * p.y; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}
export function inside(pt, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
// 傢俬本地座標 → 平面圖座標（傢俬正面向 +y）。
export function toWorldFrom(it, lx, ly) {
  const a = rad(it.r || 0);
  return { x: it.x + lx * Math.cos(a) - ly * Math.sin(a), y: it.y + lx * Math.sin(a) + ly * Math.cos(a) };
}
export function corners(it) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toWorldFrom(it, sx * it.w / 2, sy * it.h / 2));
}
export function bounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  plan.rooms.forEach(r => r.pts.forEach(add));
  plan.walls.forEach(w => { add(w.a); add(w.b); });
  if (!Number.isFinite(x0)) plan.items.forEach(it => corners(it).forEach(add));
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1000, h: 800 };
  return { x: x0, y: y0, w: Math.max(x1 - x0, 50), h: Math.max(y1 - y0, 50) };
}
export function insideBuilding(plan, p) { return plan.rooms.some(r => inside(p, r.pts)); }

/* ---------- 平面圖 ---------- */
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DataError('平面圖檔案（plan.json）唔係正確嘅格式。');
  const L = raw.layout || {};
  const pt = p => p && isNum(p.x) && isNum(p.y) ? { x: +p.x, y: +p.y } : null;
  const rooms = (Array.isArray(L.rooms) ? L.rooms : []).map((r, i) => ({ id: String(r?.id ?? 'r' + i), pts: (r?.pts || []).map(pt).filter(Boolean) })).filter(r => r.pts.length >= 3);
  const walls = (Array.isArray(L.walls) ? L.walls : []).map((w, i) => ({ id: String(w?.id ?? 'w' + i), a: pt(w?.a), b: pt(w?.b), glass: !!w?.glass })).filter(w => w.a && w.b);
  const list = Array.isArray(raw.items) ? raw.items : Object.values(raw.items || {});
  const items = [];
  list.forEach((it, i) => {
    const c = CATALOG[it?.type];
    if (!c || !isNum(it.x) || !isNum(it.y)) return;
    const o = {
      id: String(it.id ?? 'i' + i), type: it.type, x: +it.x, y: +it.y,
      w: isNum(it.w) && +it.w > 0 ? +it.w : c.w, h: isNum(it.h) && +it.h > 0 ? +it.h : c.d,
      ht: isNum(it.ht) ? Math.max(0, +it.ht) : c.ht, r: isNum(it.r) ? +it.r : 0,
    };
    if ('on' in it) o.on = it.on == null ? null : String(it.on);
    if (it.lay === 1 || it.lay === 2) o.lay = it.lay;
    items.push(o);
  });
  if (!rooms.length) throw new DataError('平面圖（plan.json）入面搵唔到房間外框（layout.rooms）。');
  const plan = { rooms, walls, items, byId: Object.fromEntries(items.map(i => [i.id, i])) };
  plan.bounds = bounds(plan);
  plan.center = centroid(rooms[0].pts);
  return plan;
}

export const heightOf = it => it.ht ?? CATALOG[it.type]?.ht ?? 0;
// 「瞓低」咗嘅櫃：交換闊／深／高。
export function baseDims(it) {
  const L = it.lay || 0, ht = heightOf(it);
  return L === 1 ? { w: ht, d: it.h, ht: it.w } : L === 2 ? { w: it.w, d: ht, ht: it.h } : { w: it.w, d: it.h, ht };
}
const SUPPORT_SKIP = new Set(['microwave', 'oven', 'chair', 'door', 'door2', 'window']);
function pointInItem(p, o) {
  const a = rad(o.r || 0), dx = p.x - o.x, dy = p.y - o.y;
  const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2;
}
// 離地高度：疊喺其他傢俬上面（on）就加埋下面嗰件嘅高度。
export function elev(it, plan, depth = 0) {
  if (!it) return 0;
  if (!('on' in it)) {
    if (it.type !== 'microwave' && it.type !== 'oven') return 0;
    let top = 0;
    plan.items.forEach(o => { if (o !== it && !SUPPORT_SKIP.has(o.type) && pointInItem(it, o)) top = Math.max(top, heightOf(o)); });
    return top;
  }
  const sup = it.on ? plan.byId[it.on] : null;
  return sup && depth < 8 ? elev(sup, plan, depth + 1) + heightOf(sup) : 0;
}

/* ---------- 牆、門、窗 ---------- */
// 房間外框係外牆（15 cm），自己畫嘅牆係間隔（8 cm），玻璃牆 4 cm。
export function baseSegments(plan) {
  const segs = [];
  plan.rooms.forEach(r => r.pts.forEach((p, i) => segs.push({ a: p, b: r.pts[(i + 1) % r.pts.length], t: 15, glass: false })));
  plan.walls.forEach(w => segs.push({ a: w.a, b: w.b, t: w.glass ? 4 : 8, glass: w.glass }));
  return segs;
}
// 門嘅開口喺傢俬正面（本地 y = +h/2）；窗喺中線。
export function openingsOf(plan) {
  const out = [];
  plan.items.forEach(it => {
    if (it.type === 'window') out.push({ kind: 'window', id: it.id, e: [toWorldFrom(it, -it.w / 2, 0), toWorldFrom(it, it.w / 2, 0)] });
    if (it.type === 'door' || it.type === 'door2') out.push({ kind: 'door', id: it.id, e: [toWorldFrom(it, -it.w / 2, it.h / 2), toWorldFrom(it, it.w / 2, it.h / 2)] });
  });
  return out;
}
// 搵出喺呢幅牆上面嘅開口（兩端都要貼住牆，14 cm 以內）。回傳沿牆嘅距離 s0–s1。
export function holesOn(sg, opens) {
  const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, L = Math.hypot(dx, dy);
  if (L < 1) return [];
  const ux = dx / L, uy = dy / L, holes = [];
  opens.forEach(o => {
    const t = o.e.map(p => ({ s: (p.x - sg.a.x) * ux + (p.y - sg.a.y) * uy, d: Math.abs((p.x - sg.a.x) * uy - (p.y - sg.a.y) * ux) }));
    if (t.every(q => q.d < 14 && q.s > -10 && q.s < L + 10)) {
      holes.push({ s0: Math.max(0, Math.min(t[0].s, t[1].s)), s1: Math.min(L, Math.max(t[0].s, t[1].s)), kind: o.kind, id: o.id });
    }
  });
  return holes.sort((a, b) => a.s0 - b.s0);
}
// 將一幅牆按開口切開：回傳實心嘅段落（沿牆距離）。
export function solidSpans(L, holes) {
  const out = [];
  let cur = 0;
  holes.forEach(h => { if (h.s0 - cur > 1) out.push([cur, h.s0]); cur = Math.max(cur, h.s1); });
  if (L - cur > 1) out.push([cur, L]);
  return out;
}

/* ---------- 漫遊碰撞 ---------- */
export function collisionData(plan) {
  const doors = openingsOf(plan).filter(o => o.kind === 'door');
  const segs = [];
  baseSegments(plan).forEach(sg => {
    const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, L = Math.hypot(dx, dy);
    if (L < 1) return;
    const ux = dx / L, uy = dy / L;
    solidSpans(L, holesOn(sg, doors)).forEach(([s0, s1]) => segs.push({
      ax: sg.a.x + ux * s0, ay: sg.a.y + uy * s0, bx: sg.a.x + ux * s1, by: sg.a.y + uy * s1, r: sg.t / 2, glass: sg.glass,
    }));
  });
  // 柱一定擋路；其他傢俬高過 30 cm 先擋（地氈之類唔擋）。
  const rects = plan.items
    .filter(it => !OPENING_TYPES.has(it.type) && !CATALOG[it.type]?.deco && (it.type === 'column' || elev(it, plan) + heightOf(it) >= 30))
    .map(it => ({ x: it.x, y: it.y, w: it.w, h: it.h, r: it.r || 0 }));
  return { segs, rects };
}
// 將人推出牆同傢俬之外。
export function resolveWalk(p, col, R = WALK_R) {
  for (let n = 0; n < 4; n++) {
    let moved = false;
    for (const s of col.segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / L2));
      const cx = s.ax + t * dx, cy = s.ay + t * dy, vx = p.x - cx, vy = p.y - cy, d = Math.hypot(vx, vy), min = R + s.r;
      if (d < min) {
        if (d > 1e-6) { p.x = cx + vx / d * min; p.y = cy + vy / d * min; }
        else { const nl = Math.sqrt(L2); p.x += -dy / nl * min; p.y += dx / nl * min; }
        moved = true;
      }
    }
    for (const r of col.rects) {
      const a = rad(r.r), ca = Math.cos(a), sa = Math.sin(a), dx = p.x - r.x, dy = p.y - r.y;
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca, hw = r.w / 2, hh = r.h / 2;
      const cx = Math.max(-hw, Math.min(hw, lx)), cy = Math.max(-hh, Math.min(hh, ly)), vx = lx - cx, vy = ly - cy, d = Math.hypot(vx, vy);
      if (d < R) {
        let nx, ny;
        if (d > 1e-6) { nx = cx + vx / d * R; ny = cy + vy / d * R; }
        else if (hw - Math.abs(lx) < hh - Math.abs(ly)) { nx = (lx < 0 ? -1 : 1) * (hw + R); ny = ly; }
        else { nx = lx; ny = (ly < 0 ? -1 : 1) * (hh + R); }
        p.x = r.x + nx * ca - ny * sa; p.y = r.y + nx * sa + ny * ca; moved = true;
      }
    }
    if (!moved) break;
  }
  return p;
}
// 由 from 行去 to：分細步行，每步都做碰撞，避免一步跨過牆。
export function stepWalk(from, to, col, R = WALK_R) {
  const dx = to.x - from.x, dy = to.y - from.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
  const p = { x: from.x, y: from.y };
  for (let i = 0; i < n; i++) { p.x += dx / n; p.y += dy / n; resolveWalk(p, col, R); }
  return p;
}
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
// 兩點之間有冇實心牆擋住（玻璃牆唔計）。用嚟隱藏牆後面嘅設施標記。
export function lineBlocked(p, q, col) {
  return col.segs.some(s => !s.glass && segCross(p.x, p.y, q.x, q.y, s.ax, s.ay, s.bx, s.by));
}

/* ---------- 中心同設施資料 ---------- */
const PALETTE = ['#E07A3F', '#D9A23A', '#6FA36F', '#4F94B8', '#B7739B', '#C8694F', '#8C7BC0', '#3E9C8F', '#A0784F', '#5C86C9', '#D46A8C', '#7A9A3A', '#C0883A', '#4C7F99', '#9B5FB5', '#2F9E73', '#CC5A3A', '#6B7FD1'];
const str = (v, max = 400) => typeof v === 'string' ? v.trim().slice(0, max) : (v == null ? '' : String(v).trim().slice(0, max));
function xy(v) {
  if (Array.isArray(v) && v.length >= 2 && isNum(v[0]) && isNum(v[1])) return { x: +v[0], y: +v[1] };
  if (v && typeof v === 'object' && isNum(v.x) && isNum(v.y)) return { x: +v.x, y: +v.y };
  return null;
}
export function safeUrl(u) {
  const s = str(u, 500);
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https:\/\//i.test(s)) return '';
  if (s.startsWith('//') || s.includes('\\')) return '';
  return s;
}

// 樓層：center.json 嘅 floors；冇寫就當只有一層。
export function normalizeFloors(raw) {
  const errors = [];
  const list = Array.isArray(raw?.floors) && raw.floors.length ? raw.floors : [{ id: 'G', name: '地下', plan: 'data/plan.json' }];
  const seen = new Set();
  const floors = list.map((fl, i) => {
    const id = str(fl?.id, 10) || `F${i}`;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) errors.push(`第 ${i + 1} 層嘅 id「${id}」只可以用英文字母、數字、- 同 _。`);
    if (seen.has(id) || id === 'all') errors.push(`樓層 id「${id}」重複咗或者唔可以用。`);
    seen.add(id);
    const plan = str(fl?.plan, 120) || 'data/plan.json';
    if (!/^[A-Za-z0-9_./-]+\.json$/.test(plan) || plan.includes('..') || plan.startsWith('/')) errors.push(`樓層「${id}」嘅平面圖路徑（plan）要係 data/xxx.json。`);
    return { id, name: str(fl?.name, 20) || id, plan, index: i, base: i * FLOOR_H };
  });
  return { floors, errors };
}

export function normalizeCenter(raw, plans) {
  const errors = [], warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DataError('設施資料（center.json）唔係正確嘅格式。');
  const fl = normalizeFloors(raw);
  const floors = fl.floors;
  errors.push(...fl.errors);
  const floorIds = new Set(floors.map(x => x.id));
  // plans：每層一張平面圖 {G: plan, 1F: plan}；舊寫法淨係一張圖都得
  const planOf = id => (plans && plans.rooms ? plans : plans?.[id]) || null;
  const c = raw.center || {};
  const center = {
    name: str(c.name, 60) || '社區客廳', subtitle: str(c.subtitle, 120), address: str(c.address, 200),
    phone: str(c.phone, 40), note: str(c.note, 600), planNote: str(c.planNote, 300),
  };
  if (!str(c.name)) warnings.push('未填中心名稱（center.name），暫時顯示「社區客廳」。');
  const list = Array.isArray(raw.facilities) ? raw.facilities : [];
  if (!list.length) errors.push('設施清單（facilities）係空嘅，最少要有一個設施。');
  const seen = new Set();
  const facilities = [];
  list.forEach((f, i) => {
    const label = `第 ${i + 1} 個設施${f?.name ? `「${str(f.name, 40)}」` : ''}`;
    if (!f || typeof f !== 'object') { errors.push(`${label}唔係正確嘅格式。`); return; }
    const id = str(f.id, 40) || `f${i + 1}`;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) errors.push(`${label}嘅 id「${id}」只可以用英文字母、數字、- 同 _。`);
    if (seen.has(id)) errors.push(`${label}嘅 id「${id}」重複咗。`);
    seen.add(id);
    const name = str(f.name, 40);
    if (!name) errors.push(`${label}未有名稱（name）。`);
    let floor = str(f.floor, 10) || floors[0].id;
    if (floor !== 'all' && !floorIds.has(floor)) { errors.push(`${label}嘅樓層（floor）「${floor}」唔存在，可以用：${[...floorIds].join('、')}。`); floor = floors[0].id; }
    const plan = planOf(floor === 'all' ? floors[0].id : floor);
    const at = xy(f.at);
    if (!at) errors.push(`${label}嘅位置（at）要寫做 [x, y]，單位 cm，例如 [450, 900]。`);
    else if (plan && !insideBuilding(plan, at)) warnings.push(`${label}嘅位置 [${at.x}, ${at.y}] 喺平面圖外框以外，請檢查。`);
    let stairs = null;
    if (f.stairs != null) {
      if (floors.length < 2) errors.push(`${label}係樓梯，但係 floors 得一層。`);
      else {
        const st = f.stairs, num = (v, d) => (isNum(v) && +v > 0 ? +v : d), ex = v => (['ahead', 'left', 'right'].includes(v) ? v : 'ahead');
        stairs = { r: isNum(st.r) ? +st.r : 0, w: num(st.w, STAIR.w), run: num(st.run, STAIR.run), risers: Math.round(num(st.risers, STAIR.risers)), lower: floors[0].id, upper: floors[1].id, topExit: ex(st.topExit), bottomExit: ex(st.bottomExit) };
        stairs.well = Math.min(stairs.run, num(st.well, stairs.run));
      }
    }
    let area = null;
    if (f.area != null) {
      const pts = Array.isArray(f.area) ? f.area.map(xy) : [];
      if (pts.length >= 3 && pts.every(Boolean)) area = pts;
      else errors.push(`${label}嘅範圍（area）要係最少 3 個 [x, y] 點。`);
    }
    const v = f.view || {};
    const view = { from: xy(v.from), height: isNum(v.height) ? +v.height : null, dist: isNum(v.dist) ? +v.dist : null };
    const color = /^#[0-9a-f]{6}$/i.test(str(f.color)) ? str(f.color) : PALETTE[facilities.length % PALETTE.length];
    facilities.push({
      id, no: facilities.length + 1, name: name || '（未命名）', icon: str(f.icon, 8) || '📍',
      summary: str(f.summary, 400), hours: str(f.hours, 200), booking: str(f.booking, 200),
      photo: safeUrl(f.photo), photoAlt: str(f.photoAlt, 120),
      tour: str(f.tour, 400), seconds: isNum(f.seconds) ? Math.min(60, Math.max(3, +f.seconds)) : null,
      staffOnly: f.staffOnly === true, tentative: f.tentative === true, at: at || { x: 0, y: 0 }, area, radius: isNum(f.radius) ? +f.radius : 150, view, color,
      floor, stairs,
    });
    if (f.photo && !safeUrl(f.photo)) errors.push(`${label}嘅相片路徑（photo）唔安全或者唔正確，請用 photos/xxx.jpg。`);
    // 設施傢俬：dx／dy 係相對設施位置（at）嘅距離（cm），設施搬位傢俬會跟住搬。
    const fac = facilities[facilities.length - 1];
    fac.furniture = [];
    if (f.furniture != null && !Array.isArray(f.furniture)) errors.push(`${label}嘅傢俬（furniture）要係一個清單 [ ... ]。`);
    (Array.isArray(f.furniture) ? f.furniture : []).forEach((it, j) => {
      const c = CATALOG[it?.type];
      if (!c || OPENING_TYPES.has(it.type) || c.internal) { errors.push(`${label}第 ${j + 1} 件傢俬類型「${str(it?.type, 30)}」唔認識。可以用：${FURNITURE_TYPES.join('、')}。`); return; }
      if (!isNum(it.dx) || !isNum(it.dy)) { errors.push(`${label}第 ${j + 1} 件傢俬（${it.type}）要有 dx 同 dy（相對設施位置，cm）。`); return; }
      fac.furniture.push({
        id: `${id}~${j + 1}`, type: it.type, fid: id, x: fac.at.x + +it.dx, y: fac.at.y + +it.dy, r: isNum(it.r) ? +it.r : 0,
        w: isNum(it.w) && +it.w > 0 ? +it.w : c.w, h: isNum(it.d) && +it.d > 0 ? +it.d : c.d, ht: isNum(it.ht) ? Math.max(0, +it.ht) : c.ht,
      });
    });
  });
  const s = raw.start || {};
  const start = { at: xy(s.at), lookAt: xy(s.lookAt) };
  if (s.at != null && !start.at) errors.push('漫遊起點（start.at）要寫做 [x, y]。');
  const pending = facilities.filter(f => !f.summary || !(f.hours || f.booking)).length;
  const tentative = facilities.filter(f => f.tentative).length;
  const pendingOf = f => !f.stairs && (!f.summary || !(f.hours || f.booking));
  return { center, floors, facilities, start, updated: str(raw.updated, 20), draft: raw.draft === true || facilities.some(pendingOf) || tentative > 0, pending: facilities.filter(pendingOf).length, tentative, errors, warnings };
}

// 某層有邊啲設施（floor 寫 "all" 嘅例如樓梯，每層都有）
export const facilitiesOn = (facilities, floorId) => facilities.filter(f => f.floor === floorId || f.floor === 'all');

/* ---------- 樓梯 ---------- */
// 直樓梯：由下層嘅樓梯底（本地 +y）一直上到上層樓梯頂（本地 -y）。
// center.json："stairs": {"w": 闊, "run": 長, "risers": 級數, "r": 方向, "well": 上層樓梯井長度, "topExit"/"bottomExit": "ahead"|"left"|"right"}
export function stairsGeometry(f) {
  const s = f.stairs; if (!s) return null;
  const c = { x: f.at.x, y: f.at.y, r: s.r }, hw = s.w / 2, hd = s.run / 2;
  const rect = (x0, y0, x1, y1) => { const m = toWorldFrom(c, (x0 + x1) / 2, (y0 + y1) / 2); return { x: m.x, y: m.y, w: x1 - x0, h: y1 - y0, r: c.r }; };
  const poly = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => toWorldFrom(c, x, y));
  const toLocal = p => { const a = rad(c.r), dx = p.x - c.x, dy = p.y - c.y; return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a) }; };
  const DIR = { ahead: null, left: [-1, 0], right: [1, 0] };
  const pose = (lx, ly, ahead, exit) => {
    const d = DIR[exit] || ahead, p = toWorldFrom(c, lx, ly), q = toWorldFrom(c, lx + d[0] * 100, ly + d[1] * 100);
    return { x: p.x, y: p.y, yaw: Math.atan2(-(q.x - p.x), -(q.y - p.y)) };
  };
  // 下層：樓梯底下淨高唔夠嘅位置擋路，樓梯口（最底兩級）留空俾人行入去
  const lowFrom = Math.max(-hd, hd - s.run * (HEADROOM / FLOOR_H));
  return {
    c, hw, hd, run: s.run, risers: s.risers, well: s.well,
    footprint: poly(-hw, -hd, hw, hd),
    lower: { floor: s.lower, to: s.upper, colliders: [{ ...rect(-hw, lowFrom, hw, hd - 60), localFrom: lowFrom }], trigger: { x0: -hw + 6, x1: hw - 6, y0: hd - 58, y1: hd - 6 }, arrive: pose(0, -hd - 50, [0, -1], s.topExit) },
    // 上層：樓梯井擋路，淨係樓梯頂可以落
    upper: { floor: s.upper, to: s.lower, colliders: [rect(-hw, -hd + 50, hw, -hd + s.well)], trigger: { x0: -hw + 6, x1: hw - 6, y0: -hd + 6, y1: -hd + 48 }, arrive: pose(0, hd + 50, [0, 1], s.bottomExit) },
    hole: poly(-hw, -hd, hw, -hd + s.well),
    inTrigger(p, which) { const q = toLocal(p), t = this[which].trigger; return q.x >= t.x0 && q.x <= t.x1 && q.y >= t.y0 && q.y <= t.y1; },
  };
}

// 將設施傢俬加入平面圖：之後 3D、2D、小地圖同碰撞都會用到。
export function withFurniture(plan, facilities, floorId) {
  const extra = facilities.filter(f => floorId == null || f.floor === floorId).flatMap(f => f.furniture || []);
  if (!extra.length) return plan;
  const items = plan.items.concat(extra);
  return { ...plan, items, byId: Object.fromEntries(items.map(i => [i.id, i])) };
}

// 檢查設施傢俬：出咗平面圖、撞牆、撞到其他傢俬或者擋住門。回傳中文提示。
export function furnitureProblems(plan, facilities, obstacles = []) {
  const out = [], segs = baseSegments(plan);
  const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  const axes = it => { const a = rad(it.r || 0); return [[Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)]]; };
  const hit = (A, B) => { const ca = corners(A), cb = corners(B); for (const ax of [...axes(A), ...axes(B)]) { const pa = ca.map(c => c.x * ax[0] + c.y * ax[1]), pb = cb.map(c => c.x * ax[0] + c.y * ax[1]); if (Math.max(...pa) + 1 <= Math.min(...pb) || Math.max(...pb) + 1 <= Math.min(...pa)) return false; } return true; };
  const flat = it => heightOf(it) < 10;
  const mine = facilities.flatMap(f => (f.furniture || []).filter(it => !CATALOG[it.type]?.deco).map(it => ({ it, f })));
  mine.forEach(({ it, f }, k) => {
    const label = `「${f.name}」嘅 ${CATALOG[it.type].name || it.type}`; // 地墊、地氈上面擺嘢唔當疊埋
    let wall = false, outside = false;
    for (let i = 0; i <= 6 && !wall && !outside; i++) for (let j = 0; j <= 6; j++) {
      const p = toWorldFrom(it, -it.w / 2 + it.w * i / 6, -it.h / 2 + it.h * j / 6);
      if (!insideBuilding(plan, p)) { outside = true; break; }
      if (segs.some(s => distSeg(p, s.a, s.b) < s.t / 2 + 1)) { wall = true; break; }
    }
    if (outside) out.push(`${label}出咗平面圖外框。`);
    else if (wall) out.push(`${label}撞到牆。`);
    plan.items.forEach(o => {
      if (o.type === 'window' || o.type === 'tv' || CATALOG[o.type]?.deco) return;
      const isDoor = o.type === 'door' || o.type === 'door2';
      if ((isDoor || o.type === 'column' || (!flat(it) && !flat(o))) && hit(it, o)) out.push(`${label}${isDoor ? '擋住咗門口' : '撞到原有傢俬'}。`);
    });
    obstacles.forEach(o => { if (hit(it, o)) out.push(`${label}擋住咗${o.label || '樓梯'}。`); });
    mine.slice(k + 1).forEach(({ it: o, f: g }) => { if (!flat(it) && !flat(o) && hit(it, o)) out.push(`${label}同「${g.name}」嘅 ${CATALOG[o.type].name || o.type} 疊埋。`); });
  });
  return [...new Set(out)];
}

// 樓梯當一件傢俬咁檢查（撞牆、撞嘢、擋門）
export function stairsItem(f) {
  return { id: `${f.id}~stairs`, type: 'stairs', fid: f.id, x: f.at.x, y: f.at.y, w: f.stairs.w, h: f.stairs.run, ht: FLOOR_H, r: f.stairs.r };
}
// 逐層檢查設施傢俬同樓梯，回傳「地下：……」咁嘅提示
export function allFurnitureProblems(plans, data) {
  const out = [], multi = data.floors.length > 1;
  const sfs = data.facilities.filter(f => f.stairs);
  data.floors.forEach(fl => {
    const plan = plans[fl.id]; if (!plan) return;
    const pre = multi ? `${fl.name}：` : '';
    // 樓梯喺呢層佔嘅位置：下層係成條樓梯，上層係樓梯井（樓梯本身夾喺牆中間係正常，唔當撞牆）
    const obs = sfs.map(f => {
      const sg = stairsGeometry(f); if (!sg) return null;
      const lower = sg.lower.floor === fl.id, upper = sg.upper.floor === fl.id;
      if (!lower && !upper) return null;
      const y0 = lower ? sg.lower.colliders[0].localFrom : -sg.hd, y1 = lower ? sg.hd : -sg.hd + sg.well, m = toWorldFrom(sg.c, 0, (y0 + y1) / 2);
      return { label: f.name, x: m.x, y: m.y, w: sg.hw * 2 - 6, h: y1 - y0 - 6, r: sg.c.r };
    }).filter(Boolean);
    furnitureProblems(plan, data.facilities.filter(f => f.floor === fl.id), obs).forEach(m => out.push(pre + m));
    obs.forEach(o => plan.items.forEach(it => {
      if (it.type === 'window' || it.type === 'tv') return;
      if (rectsOverlap(o, it)) out.push(`${pre}${o.label}同原有${it.type === 'door' || it.type === 'door2' ? '門' : '傢俬'}（${it.id}）重疊。`);
    }));
  });
  return out;
}
function rectsOverlap(A, B) {
  const axes = it => { const a = rad(it.r || 0); return [[Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)]]; };
  const ca = corners(A), cb = corners(B);
  for (const ax of [...axes(A), ...axes(B)]) {
    const pa = ca.map(c => c.x * ax[0] + c.y * ax[1]), pb = cb.map(c => c.x * ax[0] + c.y * ax[1]);
    if (Math.max(...pa) <= Math.min(...pb) + 1 || Math.max(...pb) <= Math.min(...pa) + 1) return false;
  }
  return true;
}

// 設施嘅導覽時間：按字數計，長者睇字慢啲，所以寬鬆啲。
export function dwellSeconds(f) {
  if (f.seconds) return f.seconds;
  const n = [...(f.tour || f.summary || '')].length;
  return Math.min(18, Math.max(7, 4 + n * 0.2));
}

// 喺平面圖上撳一點，搵返係邊個設施：先搵最近嘅點，再睇範圍。
export function facilityAt(facilities, p) {
  let best = null, bd = Infinity;
  facilities.forEach(f => { const d = Math.hypot(f.at.x - p.x, f.at.y - p.y); if (d <= f.radius && d < bd) { bd = d; best = f; } });
  if (best) return best;
  const hits = facilities.filter(f => f.area && inside(p, f.area));
  hits.sort((a, b) => Math.abs(polyArea(a.area)) - Math.abs(polyArea(b.area)));
  return hits[0] || null;
}
