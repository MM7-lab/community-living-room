#!/usr/bin/env node
// 將「新辦公室平面圖」工具嘅備份檔（office-floor-plan JSON）轉做網頁用嘅 data/plan.json。
// 用法：node tools/import-office-plan.mjs <備份檔.json> [輸出路徑，預設 data/plan.json]
//
// 會做嘅嘢：
// 1. 只保留畫圖需要嘅欄位（房間外框、牆、傢俬位置同尺寸）。
// 2. 刪除所有標籤（label），因為標籤可能有同事名，而網頁係公開嘅。
// 3. 刪除組合（g）同房間備註，唔需要公開。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG } from '../js/plan-model.js';

const [, , input, output = 'data/plan.json'] = process.argv;
if (!input) {
  console.error('用法：node tools/import-office-plan.mjs <備份檔.json> [data/plan.json]');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(resolve(input), 'utf8'));
const num = v => Math.round(Number(v) * 10) / 10;
const pt = p => ({ x: num(p.x), y: num(p.y) });

const rooms = (raw.layout?.rooms || []).map(r => ({ id: String(r.id), pts: r.pts.map(pt) }));
const walls = (raw.layout?.walls || []).map(w => ({ id: String(w.id), a: pt(w.a), b: pt(w.b), ...(w.glass ? { glass: true } : {}) }));
const list = Array.isArray(raw.items) ? raw.items : Object.values(raw.items || {});
let dropped = 0, labels = 0;
const items = list.filter(it => {
  if (CATALOG[it?.type]) return true;
  dropped++;
  return false;
}).map(it => {
  if (it.label) labels++;
  const o = { id: String(it.id), type: it.type, x: num(it.x), y: num(it.y), w: num(it.w), h: num(it.h) };
  if (it.ht !== undefined && it.ht !== null) o.ht = num(it.ht);
  o.r = num(it.r || 0);
  if ('on' in it) o.on = it.on ?? null;
  if (it.lay === 1 || it.lay === 2) o.lay = it.lay;
  return o;
}).sort((a, b) => a.id.localeCompare(b.id));

const out = {
  format: 'office-floor-plan',
  version: 2,
  note: '由「新辦公室平面圖」工具匯出。單位：cm。已刪除所有標籤，避免公開同事名。',
  layout: { rooms, walls },
  items,
};
// 每個房間、每幅牆、每件傢俬一行，方便喺 GitHub 睇同比較。
const J = v => JSON.stringify(v);
const lines = [
  '{',
  `  "format": ${J(out.format)},`,
  `  "version": ${out.version},`,
  `  "note": ${J(out.note)},`,
  '  "layout": {',
  '    "rooms": [',
  rooms.map(r => '      ' + J(r)).join(',\n'),
  '    ],',
  '    "walls": [',
  walls.map(w => '      ' + J(w)).join(',\n'),
  '    ]',
  '  },',
  '  "items": [',
  items.map(i => '    ' + J(i)).join(',\n'),
  '  ]',
  '}',
];
writeFileSync(resolve(output), lines.join('\n') + '\n');
JSON.parse(lines.join('\n'));
console.log(`已寫入 ${output}：${rooms.length} 個房間、${walls.length} 幅牆、${items.length} 件傢俬（刪除咗 ${labels} 個標籤${dropped ? `，略過 ${dropped} 件未知類型` : ''}）。`);
