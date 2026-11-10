#!/usr/bin/env node
// 檢查 data/plan.json 同 data/center.json：改完資料檔先跑一次，GitHub 亦會自動跑。
// 用法：node tools/check-data.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalizePlan, normalizeCenter, DataError } from '../js/plan-model.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let failed = false;
const fail = msg => { failed = true; console.error('❌ ' + msg); };
const warn = msg => console.warn('⚠️  ' + msg);

function readJSON(rel) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  try { return JSON.parse(text); }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    if (m) { const before = text.slice(0, +m[1]); fail(`${rel} 第 ${before.split('\n').length} 行附近格式有錯（通常係漏咗或者多咗逗號、引號唔齊）。`); }
    else fail(`${rel} 唔係正確嘅 JSON：${e.message}`);
    return null;
  }
}

const rawPlan = readJSON('data/plan.json');
const rawCenter = readJSON('data/center.json');
let plan = null;
if (rawPlan) {
  try { plan = normalizePlan(rawPlan); }
  catch (e) { fail(e instanceof DataError ? e.message : String(e)); }
  // 網頁係公開嘅：平面圖唔可以有標籤（可能係同事名）。
  const items = Array.isArray(rawPlan.items) ? rawPlan.items : Object.values(rawPlan.items || {});
  const labelled = items.filter(it => typeof it?.label === 'string' && it.label.trim());
  if (labelled.length) fail(`data/plan.json 有 ${labelled.length} 件傢俬有標籤（例如「${labelled[0].label}」）。標籤可能有同事名，請用 tools/import-office-plan.mjs 重新匯入，或者刪除 label。`);
  if ((rawPlan.layout?.rooms || []).some(r => r.src || r.name)) warn('data/plan.json 嘅房間有名稱或者備註；網頁唔會顯示，但檔案係公開嘅，請確認冇私人資料。');
}
if (rawCenter && plan) {
  const d = normalizeCenter(rawCenter, plan);
  d.errors.forEach(fail);
  d.warnings.forEach(warn);
  d.facilities.forEach(f => {
    if (f.photo && !/^https:\/\//.test(f.photo) && !existsSync(join(ROOT, f.photo))) fail(`設施「${f.name}」嘅相片 ${f.photo} 搵唔到，請檢查檔名（大細楷都要一樣）。`);
  });
  if (!failed) {
    console.log(`✅ 資料檔冇問題：${plan.rooms.length} 個房間、${plan.walls.length} 幅牆、${plan.items.length} 件傢俬、${d.facilities.length} 個設施。`);
    if (d.pending) console.log(`ℹ️  仲有 ${d.pending} 個設施未填簡介或者開放時間／預約方法，網頁會顯示「試行版」橫額。`);
    if (d.tentative) console.log(`ℹ️  仲有 ${d.tentative} 個設施位置暫定（tentative），確認位置之後請刪除 "tentative": true。`);
  }
}
process.exit(failed ? 1 : 0);
