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

test('每道門同每個窗都準確對應一幅牆（兩層）', () => {
  for (const pl of [plan, plan1]) {
    const segs = baseSegments(pl);
    for (const o of openingsOf(pl)) {
      const on = segs.filter(s => holesOn(s, [o]).length);
      assert.equal(on.length, 1, `${o.kind} ${o.id} 對應咗 ${on.length} 幅牆`);
    }
  }
});

test('設施資料冇錯：入口第一站、官方 8 項齊晒、分兩層', () => {
  const d = normalizeCenter(center, plans);
  assert.deepEqual(d.errors, []);
  assert.deepEqual(d.floors.map(f => f.name), ['地下', '一樓']);
  assert.equal(d.facilities[0].id, 'entrance');
  const names = d.facilities.map(f => f.name);
  ['社區廚房', '洗衣及乾衣機', '按摩椅', '健身設備', '大電視', '圖書閣', '兒童遊樂室', '咖啡沖調設備區'].forEach(n => assert.ok(names.includes(n), `缺少 ${n}`));
  assert.equal(new Set(d.facilities.map(f => f.color)).size, d.facilities.length, '設施顏色重複');
  assert.ok(d.facilities.some(f => f.stairs && f.floor === 'all'), '冇樓梯');
  d.facilities.forEach(f => {
    const pl = plans[f.floor === 'all' ? 'G' : f.floor];
    assert.ok(insideBuilding(pl, f.at), `${f.name} 喺嗰層平面圖外面`);
  });
  assert.equal(d.facilities.find(f => f.id === 'kids').floor, '1F', '兒童遊樂室應該喺一樓 Play Room');
});

test('平面圖冇同事名或者任何標籤', () => {
  for (const f of ['data/plan.json', 'data/plan-1f.json']) assert.equal(/"label"/.test(readFileSync(new URL('../' + f, import.meta.url), 'utf8')), false, `${f} 唔可以有標籤`);
});

test('漫遊：直行撞牆會停喺牆前面', () => {
  // 洗衣區向東行去外牆（x = 600，15 cm 厚）
  const p = stepWalk({ x: 450, y: 720 }, { x: 800, y: 720 }, col);
  assert.ok(p.x <= 600 - 7.5 - WALK_R + 0.5, `x = ${p.x}`);
  // Drop-in 區向北行：俾梳化同半玻璃間隔擋住，唔會入到廚房
  const q = stepWalk({ x: -220, y: 980 }, { x: -220, y: 600 }, col);
  assert.ok(q.y >= 795, `穿過咗間隔：y = ${q.y}`);
});

test('漫遊：一大步都唔會跳過牆', () => {
  const p = stepWalk({ x: 480, y: 300 }, { x: 480, y: 200 }, col);
  assert.ok(p.y > 250, `一步跨咗過牆：y = ${p.y}`);
});

test('漫遊：門口行得過（地下）', () => {
  assert.ok(stepWalk({ x: 412, y: 320 }, { x: 412, y: 150 }, col).y < 240, '入唔到洗手間 2');
  assert.ok(stepWalk({ x: 150, y: 476 }, { x: 300, y: 476 }, col).x > 215, '出唔到廚房門（DR-02）');
  assert.ok(stepWalk({ x: 395, y: 1520 }, { x: 395, y: 1380 }, col).y < 1440, '由大門口入唔到地下（DR-05，新設計喺北面）');
  assert.ok(stepWalk({ x: 420, y: 1505 }, { x: 200, y: 1505 }, col).x > 300, '大門口西面應該係實牆');
  assert.ok(!insideBuilding(plan, stepWalk({ x: 420, y: 1520 }, { x: 420, y: 1700 }, col)), '行唔出大門');
});

test('漫遊：門口行得過（一樓）', () => {
  const c1 = collisionData(plan1);
  assert.ok(stepWalk({ x: 420, y: 970 }, { x: 250, y: 970 }, c1).x < 345, '入唔到遊戲室');
  assert.ok(stepWalk({ x: 420, y: 980 }, { x: 420, y: 1150 }, c1).y > 1045, '入唔到多用途室');
  assert.ok(stepWalk({ x: 420, y: 760 }, { x: 420, y: 600 }, c1).y < 690, '入唔到辦公室');
});

test('漫遊：送餐升降機（柱）擋路', () => {
  const p = resolveWalk({ x: 275, y: 80 }, col);
  assert.ok(Math.abs(p.x - 275) > 60 || Math.abs(p.y - 80) > 70, '企咗喺升降機入面');
});

test('實心牆會遮住設施標記，玻璃牆唔會', () => {
  assert.equal(lineBlocked({ x: 520, y: 600 }, { x: 520, y: 100 }, col), true);
  assert.equal(lineBlocked({ x: -250, y: 900 }, { x: -250, y: 600 }, col), false, '半玻璃間隔應該睇得穿');
});

test('撳平面圖揀設施：點優先，再睇範圍，淨係揀同一層', () => {
  const d = normalizeCenter(center, plans), G = facilitiesOn(d.facilities, 'G'), F1 = facilitiesOn(d.facilities, '1F');
  assert.equal(facilityAt(G, { x: 420, y: 1515 })?.id, 'entrance');
  assert.equal(facilityAt(G, { x: 495, y: 872 })?.id, 'massage');
  assert.equal(facilityAt(G, { x: -300, y: 900 })?.id, 'play');
  assert.equal(facilityAt(G, { x: 300, y: 1040 })?.id, 'dining');
  assert.equal(facilityAt(G, { x: 30, y: 1360 })?.id, 'living');
  assert.equal(facilityAt(G, { x: 520, y: 750 })?.id, 'health', '健康站（點）喺洗衣區範圍入面，點要優先');
  assert.equal(facilityAt(G, { x: 150, y: 250 })?.id, 'tv', '大電視（點）喺廚房範圍入面，點要優先');
  assert.equal(facilityAt(G, { x: -300, y: 420 })?.id, 'kitchen');
  assert.equal(facilityAt(G, { x: 480, y: 650 })?.id, 'laundry');
  assert.equal(facilityAt(G, { x: 520, y: 120 })?.id, 'toilets');
  assert.equal(facilityAt(G, { x: 537, y: 1300 })?.id, 'stairs');
  assert.equal(facilityAt(F1, { x: 537, y: 1300 })?.id, 'stairs', '樓梯兩層都有');
  assert.equal(facilityAt(F1, { x: 100, y: 800 })?.id, 'kids');
  assert.equal(facilityAt(G, { x: 100, y: 800 }), null, '地下冇兒童遊樂室');
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

test('設施傢俬同樓梯：每層都冇撞牆、冇撞嘢、冇擋門', () => {
  const d = normalizeCenter(center, plans);
  ['coffee', 'kids', 'gym'].forEach(id => assert.ok(d.facilities.find(f => f.id === id).furniture.length > 0, `${id} 冇傢俬`));
  assert.deepEqual(allFurnitureProblems(plans, d), []);
});

test('平面圖原有傢俬：冇撞牆、冇擋門、冇疊埋', () => {
  for (const [name, pl] of [['地下', plan], ['一樓', plan1]]) {
    const fixed = ['door', 'door2', 'window', 'column', 'tv'];
    const items = pl.items.filter(i => !fixed.includes(i.type));
    const base = { ...pl, items: pl.items.filter(i => fixed.includes(i.type)) };
    assert.deepEqual(furnitureProblems(base, [{ name, furniture: items }]), [], name);
  }
});

test('設施傢俬：放錯位會俾檢查捉到（撞牆、擋門、擋樓梯）', () => {
  const bad = JSON.parse(JSON.stringify(center));
  const kids = bad.facilities.find(f => f.id === 'kids');
  kids.furniture[0].dx -= 260;                                  // 一樓：遊戲地墊推出外牆
  kids.furniture.push({ type: 'sofa', dx: 260, dy: 250 });      // 一樓：擋住多用途室門
  bad.facilities.find(f => f.id === 'coffee').furniture.push({ type: 'sofa', dx: 400, dy: -250, w: 100 }); // 地下：擋住樓梯
  const probs = allFurnitureProblems(plans, normalizeCenter(bad, plans));
  assert.ok(probs.some(p => p.startsWith('一樓') && (p.includes('牆') || p.includes('外框'))), probs.join('\n'));
  assert.ok(probs.some(p => p.startsWith('一樓') && p.includes('門口')), probs.join('\n'));
  assert.ok(probs.some(p => p.startsWith('地下') && p.includes('樓梯')), probs.join('\n'));
  const wrong = normalizeCenter({ facilities: [{ id: 'a', name: 'A', at: [100, 900], furniture: [{ type: 'rocket', dx: 0, dy: 0 }] }] }, plan);
  assert.ok(wrong.errors.some(e => e.includes('唔認識')));
  const badFloor = normalizeCenter({ ...center, facilities: [{ id: 'a', name: 'A', at: [100, 900], floor: '3F' }] }, plans);
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

test('漫遊：傢俬會擋路（用餐區長枱）', () => {
  const t = plan.items.find(i => i.type === 'meeting' && i.r === 90 && i.y > 900);   // 用餐區直放長枱
  const p = stepWalk({ x: t.x, y: 870 }, { x: t.x, y: 1150 }, col);
  assert.ok(p.y <= t.y - t.w / 2 - WALK_R + 1, `穿過咗長枱：y = ${p.y}`);
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
  const pl = plans[id], c = floorCol(id), G = 5, b = pl.bounds, W = Math.ceil(b.w / G) + 1, H = Math.ceil(b.h / G) + 1;
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
function triggerReachable(near, which) {
  const t = SG[which].trigger, a = (SG.c.r * Math.PI) / 180;
  for (let lx = t.x0; lx <= t.x1; lx += 5) for (let ly = t.y0; ly <= t.y1; ly += 5) {
    const p = { x: SG.c.x + lx * Math.cos(a) - ly * Math.sin(a), y: SG.c.y + lx * Math.sin(a) + ly * Math.cos(a) };
    if (near(p, 5)) return true;
  }
  return false;
}

test('地下：由大門口行得到每個設施、洗手間、廚房同樓梯口', () => {
  const near = reachable('G', d0.start.at);
  for (const f of facilitiesOn(d0.facilities, 'G')) assert.ok(near(f.at, f.stairs ? 250 : 150), `行唔到「${f.name}」附近`);
  for (const [name, p] of [['洗手間 1', { x: 275, y: 330 }], ['洗手間 2', { x: 420, y: 120 }], ['洗手間 3', { x: 568, y: 150 }], ['廚房', { x: -300, y: 420 }], ['洗衣區', { x: 450, y: 600 }]]) assert.ok(near(p, 40), `入唔到${name}`);
  assert.ok(triggerReachable(near, 'lower'), '地下行唔到樓梯口');
});

test('一樓：由樓梯頂行得到每個設施、洗手間同辦公室，亦行得返落樓梯', () => {
  const near = reachable('1F', SG.lower.arrive);
  for (const f of facilitiesOn(d0.facilities, '1F')) assert.ok(near(f.at, f.stairs ? 250 : 150), `一樓行唔到「${f.name}」附近`);
  for (const [name, p] of [['洗手間 4', { x: 550, y: 630 }], ['洗手間 5', { x: 550, y: 770 }], ['辦公室', { x: 100, y: 400 }]]) assert.ok(near(p, 40), `一樓入唔到${name}`);
  assert.ok(triggerReachable(near, 'upper'), '一樓行唔到樓梯頂');
});

test('樓梯：落腳點企得穩，唔會即刻觸發返轉頭；由側面行唔入樓梯', () => {
  const up = SG.lower.arrive, down = SG.upper.arrive;
  for (const [a, id, other] of [[up, '1F', 'upper'], [down, 'G', 'lower']]) {
    const q = resolveWalk({ x: a.x, y: a.y }, floorCol(id));
    assert.ok(Math.hypot(q.x - a.x, q.y - a.y) < 0.5, `${id} 落腳點撞嘢`);
    assert.equal(SG.inTrigger(a, other), false, '一到埗就會再轉層');
  }
  const p = stepWalk({ x: 400, y: 1300 }, { x: 560, y: 1300 }, floorCol('G'));
  assert.ok(p.x <= 475 - 4 - WALK_R + 1, `由側面行咗入樓梯：x = ${p.x}`);
});

test('側門（接待處旁 DR-04）：由街外行得入地下，亦行得出', () => {
  const d = normalizeCenter(center, plans), f = d.facilities.find(x => x.id === 'side-entrance');
  assert.ok(f && f.floor === 'G', '冇側門設施');
  const inside = stepWalk({ x: f.at.x, y: 1680 }, { x: f.at.x, y: 1380 }, col);
  assert.ok(insideBuilding(plan, inside) && inside.y < 1450, `由側門入唔到：y = ${inside.y}`);
  assert.ok(!insideBuilding(plan, stepWalk({ x: f.at.x, y: 1420 }, { x: f.at.x, y: 1700 }, col)), '由側門出唔到');
});
