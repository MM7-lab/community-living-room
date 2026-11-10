// 單元測試：用真實平面圖檢查門窗開窿、碰撞同設施資料。用法：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizePlan, normalizeCenter, openingsOf, baseSegments, holesOn, collisionData, resolveWalk, stepWalk,
  lineBlocked, facilityAt, insideBuilding, safeUrl, WALK_R,
} from '../js/plan-model.js';

const plan = normalizePlan(JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8')));
const center = JSON.parse(readFileSync(new URL('../data/center.json', import.meta.url), 'utf8'));
const col = collisionData(plan);

test('每道門同每個窗都準確對應一幅牆', () => {
  const segs = baseSegments(plan);
  for (const o of openingsOf(plan)) {
    const on = segs.filter(s => holesOn(s, [o]).length);
    assert.equal(on.length, 1, `${o.kind} ${o.id} 對應咗 ${on.length} 幅牆`);
  }
});

test('設施資料冇錯，入口係第一站，官方 8 項設施齊晒', () => {
  const d = normalizeCenter(center, plan);
  assert.deepEqual(d.errors, []);
  assert.equal(d.facilities[0].id, 'entrance');
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

test('撳平面圖揀設施：點優先，再睇範圍', () => {
  const d = normalizeCenter(center, plan);
  assert.equal(facilityAt(d.facilities, { x: 700, y: 130 })?.id, 'entrance');
  assert.equal(facilityAt(d.facilities, { x: 725, y: 1170 })?.id, 'massage', '按摩椅（點）喺大電視範圍入面，點要優先');
  assert.equal(facilityAt(d.facilities, { x: 850, y: 800 })?.id, 'tv');
  assert.equal(facilityAt(d.facilities, { x: 100, y: 1450 })?.id, 'kids');
  assert.equal(facilityAt(d.facilities, { x: 850, y: 1450 })?.id, 'laundry');
  assert.equal(facilityAt(d.facilities, { x: 300, y: 300 }), null);
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
