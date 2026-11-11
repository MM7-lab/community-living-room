// 單元測試：用真實平面圖檢查門窗開窿、碰撞同設施資料。用法：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizePlan, normalizeCenter, openingsOf, baseSegments, holesOn, collisionData, resolveWalk, stepWalk,
  lineBlocked, facilityAt, insideBuilding, safeUrl, WALK_R, withFurniture, furnitureProblems,
  facilitiesOn, stairsGeometry, allFurnitureProblems,
} from '../js/plan-model.js';

const load = rel => JSON.parse(readFileSync(new URL('../' + rel, import.meta.url), 'utf8'));
const plan = normalizePlan(load('data/plan.json'));          // 地下
const plan1 = normalizePlan(load('data/plan-1f.json'));      // 一樓
const plans = { G: plan, '1F': plan1 };
const center = load('data/center.json');
const col = collisionData(plan);

test('每道門同每個窗都準確對應一幅牆', () => {
  const segs = baseSegments(plan);
  for (const o of openingsOf(plan)) {
    const on = segs.filter(s => holesOn(s, [o]).length);
    assert.equal(on.length, 1, `${o.kind} ${o.id} 對應咗 ${on.length} 幅牆`);
  }
});

test('設施資料冇錯，入口係第一站，官方 8 項設施齊晒，分兩層', () => {
  const d = normalizeCenter(center, plans);
  assert.deepEqual(d.errors, []);
  assert.deepEqual(d.floors.map(f => f.name), ['地下', '一樓']);
  assert.equal(d.facilities[0].id, 'entrance');
  assert.ok(d.facilities.some(f => f.stairs && f.floor === 'all'), '冇樓梯');
  assert.ok(facilitiesOn(d.facilities, 'G').length > 1 && facilitiesOn(d.facilities, '1F').length > 1);
  const names = d.facilities.map(f => f.name);
  ['社區廚房', '洗衣及乾衣機', '按摩椅', '健身設備', '大電視', '圖書閣', '兒童遊樂室', '咖啡沖調設備區'].forEach(n => assert.ok(names.includes(n), `缺少 ${n}`));
  assert.equal(new Set(d.facilities.map(f => f.color)).size, d.facilities.length, '設施顏色重複');
  d.facilities.forEach(f => assert.ok(insideBuilding(plan, f.at), `${f.name} 喺平面圖外面`));
});

test('平面圖冇同事名或者任何標籤', () => {
  const raw = readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8');
  assert.equal(/"label"/.test(raw), false, 'plan.json 唔可以有標籤（可能有同事名）');
});

test('漫遊：直行撞牆會停喺牆前面', () => {
  // 向下行去儲物室間隔牆（y = 1292，8 cm 厚），唔可以穿過去。
  const p = stepWalk({ x: 300, y: 1150 }, { x: 300, y: 1500 }, col);
  assert.ok(p.y <= 1292 - 4 - WALK_R + 0.5, `y = ${p.y}`);
  // 向左行去外牆（x = 0，15 cm 厚）。
  const q = stepWalk({ x: 150, y: 900 }, { x: -300, y: 900 }, col);
  assert.ok(q.x >= 7.5 + WALK_R - 0.5, `x = ${q.x}`);
});

test('漫遊：一大步都唔會跳過牆', () => {
  const p = stepWalk({ x: 300, y: 1250 }, { x: 300, y: 1340 }, col);
  assert.ok(p.y < 1292, `一步跨咗過牆：y = ${p.y}`);
});

test('漫遊：門口行得過（玻璃房門、儲物室門、正門）', () => {
  const room = stepWalk({ x: 688, y: 690 }, { x: 688, y: 820 }, col);
  assert.ok(room.y > 760, `入唔到玻璃房：y = ${room.y}`);
  const store = stepWalk({ x: 495, y: 1250 }, { x: 495, y: 1360 }, col);
  assert.ok(store.y > 1300, `入唔到儲物室：y = ${store.y}`);
  // 正門：由走廊向外行出去
  const out = stepWalk({ x: 647, y: 175 }, { x: 760, y: 65 }, col);
  assert.ok(!insideBuilding(plan, out), '行唔出正門');
});

test('漫遊：柱擋路', () => {
  const p = resolveWalk({ x: 112, y: 1519 }, col);
  assert.ok(Math.abs(p.x - 112) > 100 || Math.abs(p.y - 1519) > 30, '企咗喺柱入面');
});

test('實心牆會遮住設施標記，玻璃牆唔會', () => {
  assert.equal(lineBlocked({ x: 300, y: 1100 }, { x: 300, y: 1450 }, col), true);
  assert.equal(lineBlocked({ x: 500, y: 1000 }, { x: 765, y: 1011 }, col), false);
});

test('撳平面圖揀設施：點優先，再睇範圍，淨係揀同一層', () => {
  const d = normalizeCenter(center, plans), G = facilitiesOn(d.facilities, 'G'), F1 = facilitiesOn(d.facilities, '1F');
  assert.equal(facilityAt(G, { x: 700, y: 130 })?.id, 'entrance');
  assert.equal(facilityAt(G, { x: 725, y: 1170 })?.id, 'massage', '按摩椅（點）喺大電視範圍入面，點要優先');
  assert.equal(facilityAt(G, { x: 850, y: 800 })?.id, 'tv');
  assert.equal(facilityAt(G, { x: 850, y: 1450 })?.id, 'laundry');
  assert.equal(facilityAt(G, { x: 100, y: 1450 }), null, '地下冇兒童遊樂室');
  assert.equal(facilityAt(F1, { x: 100, y: 1450 })?.id, 'kids');
  assert.equal(facilityAt(G, { x: 330, y: 1060 })?.id, 'stairs');
  assert.equal(facilityAt(F1, { x: 330, y: 1060 })?.id, 'stairs', '樓梯兩層都有');
});

test('相片路徑：只接受相對路徑或者 https', () => {
  assert.equal(safeUrl('photos/a.jpg'), 'photos/a.jpg');
  assert.equal(safeUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('//evil.com/a.jpg'), '');
});

test('資料檢查：常見錯誤有清楚中文提示', () => {
  const bad = normalizeCenter({ facilities: [{ id: 'a', name: '', at: [1, 2] }, { id: 'a', name: 'B', at: 'x' }] }, plan);
  assert.ok(bad.errors.some(e => e.includes('未有名稱')));
  assert.ok(bad.errors.some(e => e.includes('重複')));
  assert.ok(bad.errors.some(e => e.includes('位置（at）')));
});

test('設施傢俬：每層都冇撞牆、冇撞嘢、冇擋門、冇擋樓梯', () => {
  const d = normalizeCenter(center, plans);
  d.facilities.filter(f => f.id !== 'entrance' && !f.stairs).forEach(f => assert.ok(f.furniture.length > 0, `${f.name} 冇傢俬`));
  assert.deepEqual(allFurnitureProblems(plans, d), []);
});

test('設施傢俬：放錯位會俾檢查捉到（撞牆、擋門、擋樓梯）', () => {
  const bad = JSON.parse(JSON.stringify(center));
  const laundry = bad.facilities.find(f => f.id === 'laundry');
  laundry.furniture[0].dy += 60;                       // 推出外牆
  laundry.furniture.push({ type: 'sofa', dx: -150, dy: -90 }); // 擋住儲物室門
  bad.facilities.find(f => f.id === 'gym').furniture.push({ type: 'sofa', dx: -410, dy: 60 }); // 一樓：擋住樓梯
  const probs = allFurnitureProblems(plans, normalizeCenter(bad, plans));
  assert.ok(probs.some(p => p.startsWith('地下') && (p.includes('牆') || p.includes('外框'))), probs.join('\n'));
  assert.ok(probs.some(p => p.includes('門口')), probs.join('\n'));
  assert.ok(probs.some(p => p.startsWith('一樓') && p.includes('樓梯')), probs.join('\n'));
  const wrong = normalizeCenter({ facilities: [{ id: 'a', name: 'A', at: [500, 900], furniture: [{ type: 'rocket', dx: 0, dy: 0 }] }] }, plan);
  assert.ok(wrong.errors.some(e => e.includes('唔認識')));
  const badFloor = normalizeCenter({ ...center, facilities: [{ id: 'a', name: 'A', at: [500, 900], floor: '3F' }] }, plans);
  assert.ok(badFloor.errors.some(e => e.includes('樓層')));
});

test('設施傢俬：跟住設施位置搬', () => {
  const moved = JSON.parse(JSON.stringify(center));
  moved.facilities.find(f => f.id === 'gym').at[1] += 30;
  const a = normalizeCenter(center, plans).facilities.find(f => f.id === 'gym').furniture[0];
  const b = normalizeCenter(moved, plans).facilities.find(f => f.id === 'gym').furniture[0];
  assert.equal(b.y - a.y, 30);
  assert.equal(b.x, a.x);
});

test('漫遊：傢俬會擋路（梳化）', () => {
  const d = normalizeCenter(center, plans);
  const col2 = collisionData(withFurniture(plan, d.facilities, 'G'));
  const sofa = d.facilities.find(f => f.id === 'tv').furniture.find(it => it.type === 'sofa');
  // 由梳化右邊向左行：要停喺梳化前面
  const p = stepWalk({ x: 800, y: sofa.y }, { x: 600, y: sofa.y }, col2);
  assert.ok(p.x >= sofa.x + sofa.h / 2 + WALK_R - 1, `穿過咗梳化：x = ${p.x}`);
});

// 每層嘅碰撞（連樓梯）同可以行到嘅範圍
const d0 = normalizeCenter(center, plans);
const SG = stairsGeometry(d0.facilities.find(f => f.stairs));
function floorCol(id) {
  const c = collisionData(withFurniture(plans[id], d0.facilities, id));
  c.rects.push(...(id === SG.lower.floor ? SG.lower.colliders : SG.upper.colliders));
  return c;
}
function reachable(id, from) {
  const pl = plans[id], c = floorCol(id), G = 10, b = pl.bounds, W = Math.ceil(b.w / G) + 1, H = Math.ceil(b.h / G) + 1;
  const free = new Uint8Array(W * H), seen = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = b.x + i * G, y = b.y + j * G, q = resolveWalk({ x, y }, c);
    free[j * W + i] = Math.hypot(q.x - x, q.y - y) < 0.5 && insideBuilding(pl, { x, y }) ? 1 : 0;
  }
  const si = Math.round((from.x - b.x) / G), sj = Math.round((from.y - b.y) / G), stack = [[si, sj]];
  seen[sj * W + si] = 1;
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [a, cc] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      const k = cc * W + a;
      if (a >= 0 && cc >= 0 && a < W && cc < H && !seen[k] && free[k]) { seen[k] = 1; stack.push([a, cc]); }
    }
  }
  return (p, r) => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (seen[j * W + i] && Math.hypot(b.x + i * G - p.x, b.y + j * G - p.y) <= r) return true; return false; };
}

test('地下：由入口行得到每個設施、每道門同樓梯口', () => {
  const near = reachable('G', d0.start.at);
  for (const f of facilitiesOn(d0.facilities, 'G')) assert.ok(near(f.at, f.stairs ? 200 : 150), `行唔到「${f.name}」附近`);
  for (const [name, p] of [['玻璃房', { x: 688, y: 820 }], ['儲物室', { x: 495, y: 1345 }], ['洗衣房', { x: 581, y: 1345 }]]) assert.ok(near(p, 40), `入唔到${name}`);
  // 樓梯口（上樓觸發區）行得到
  const t = SG.lower.trigger, mid = { x: SG.c.x + 0, y: 0 };
  let ok = false;
  for (let lx = t.x0; lx <= t.x1 && !ok; lx += 10) for (let ly = t.y0; ly <= t.y1 && !ok; ly += 10) {
    const a = (SG.c.r * Math.PI) / 180, p = { x: SG.c.x + lx * Math.cos(a) - ly * Math.sin(a), y: SG.c.y + lx * Math.sin(a) + ly * Math.cos(a) };
    if (near(p, 5)) ok = true;
  }
  assert.ok(ok, '地下行唔到樓梯口');
});

test('一樓：由樓梯頂行得到每個設施，亦行得返落樓梯', () => {
  const near = reachable('1F', SG.upper.arrive);
  for (const f of facilitiesOn(d0.facilities, '1F')) assert.ok(near(f.at, f.stairs ? 200 : 150), `一樓行唔到「${f.name}」附近`);
  const t = SG.upper.trigger;
  let ok = false;
  for (let lx = t.x0; lx <= t.x1 && !ok; lx += 10) for (let ly = t.y0; ly <= t.y1 && !ok; ly += 10) {
    const a = (SG.c.r * Math.PI) / 180, p = { x: SG.c.x + lx * Math.cos(a) - ly * Math.sin(a), y: SG.c.y + lx * Math.sin(a) + ly * Math.cos(a) };
    if (near(p, 5)) ok = true;
  }
  assert.ok(ok, '一樓行唔到樓梯頂');
});

test('樓梯：落腳點企得穩，唔會即刻觸發返轉頭；樓梯側邊行唔入去', () => {
  for (const [which, id] of [['lower', 'G'], ['upper', '1F']]) {
    const a = (which === 'lower' ? SG.upper : SG.lower).arrive; // 由另一層嚟到呢層嘅落腳點
    const c = floorCol(which === 'lower' ? '1F' : 'G');
    const q = resolveWalk({ x: a.x, y: a.y }, c);
    assert.ok(Math.hypot(q.x - a.x, q.y - a.y) < 0.5, `${which} 落腳點撞嘢`);
    assert.equal(SG.inTrigger(a, which === 'lower' ? 'upper' : 'lower'), false, '一到埗就會再轉層');
  }
  // 由樓梯側面（西邊）直行入去：要俾擋住，唔可以行到樓梯口觸發區
  const c = floorCol('G');
  const p = stepWalk({ x: 150, y: 1060 }, { x: 330, y: 1060 }, c);
  assert.ok(p.x <= 225 - WALK_R + 1, `由側面行咗入樓梯：x = ${p.x}`);
});
