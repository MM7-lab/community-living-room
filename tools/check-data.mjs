#!/usr/bin/env node
// 檢查 data/center.json 同各層平面圖：改完資料檔先跑一次，GitHub 亦會自動跑。
// 用法：node tools/check-data.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalizePlan, normalizeFloors, normalizeCenter, withFurniture, allFurnitureProblems, DataError } from '../js/plan-model.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let failed = false;
const fail = msg => { failed = true; console.error('❌ ' + msg); };
const warn = msg => console.warn('⚠️  ' + msg);

function readJSON(rel) {
  let text;
  try { text = readFileSync(join(ROOT, rel), 'utf8'); }
  catch { fail(`搵唔到 ${rel}。`); return null; }
  try { return JSON.parse(text); }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    if (m) { const before = text.slice(0, +m[1]); fail(`${rel} 第 ${before.split('\n').length} 行附近格式有錯（通常係漏咗或者多咗逗號、引號唔齊）。`); }
    else fail(`${rel} 唔係正確嘅 JSON：${e.message}`);
    return null;
  }
}

const rawCenter = readJSON('data/center.json');
if (rawCenter) {
  const { floors, errors } = normalizeFloors(rawCenter);
  errors.forEach(fail);
  const plans = {};
  for (const fl of floors) {
    const raw = readJSON(fl.plan);
    if (!raw) continue;
    try { plans[fl.id] = normalizePlan(raw); }
    catch (e) { fail(`${fl.plan}：${e instanceof DataError ? e.message : String(e)}`); continue; }
    // 網頁係公開嘅：平面圖唔可以有標籤（可能係同事名）。
    const items = Array.isArray(raw.items) ? raw.items : Object.values(raw.items || {});
    const labelled = items.filter(it => typeof it?.label === 'string' && it.label.trim());
    if (labelled.length) fail(`${fl.plan} 有 ${labelled.length} 件傢俬有標籤（例如「${labelled[0].label}」）。標籤可能有同事名，請用 tools/import-office-plan.mjs 重新匯入，或者刪除 label。`);
    if ((raw.layout?.rooms || []).some(r => r.src || r.name)) warn(`${fl.plan} 嘅房間有名稱或者備註；網頁唔會顯示，但檔案係公開嘅，請確認冇私人資料。`);
  }
  // 暫時唔顯示地區名：等同工確認可以公開先刪走呢條檢查
  for (const [file, txt] of [['data/center.json', JSON.stringify(rawCenter)], ...floors.map(fl => [fl.plan, JSON.stringify(readJSON(fl.plan) || {})])]) {
    if (/\u89c0\u5858|kwun\s*tong/i.test(txt)) fail(`${file} 有地區名字眼；暫時唔好喺網頁顯示。`);
  }
  if (!failed) {
    const d = normalizeCenter(rawCenter, plans);
    d.errors.forEach(fail);
    d.warnings.forEach(warn);
    allFurnitureProblems(plans, d).forEach(warn);
    d.facilities.forEach(f => {
      if (f.photo && !/^https:\/\//.test(f.photo) && !existsSync(join(ROOT, f.photo))) fail(`設施「${f.name}」嘅相片 ${f.photo} 搵唔到，請檢查檔名（大細楷都要一樣）。`);
    });
    if (!failed) {
      floors.forEach(fl => {
        const p = plans[fl.id], extra = withFurniture(p, d.facilities, fl.id).items.length - p.items.length;
        const n = d.facilities.filter(f => f.floor === fl.id).length;
        console.log(`✅ ${fl.name}（${fl.plan}）：${p.walls.length} 幅牆、${p.items.length} 件原有傢俬、${n} 個設施（連 ${extra} 件設施傢俬）。`);
      });
      const st = d.facilities.filter(f => f.stairs).length;
      if (st) console.log(`✅ 樓梯 ${st} 條。`);
      if (d.pending) console.log(`ℹ️  仲有 ${d.pending} 個設施未填簡介或者開放時間／預約方法，網頁會顯示「試行版」橫額。`);
      if (d.tentative) console.log(`ℹ️  仲有 ${d.tentative} 個設施位置暫定（tentative），確認位置之後請刪除 "tentative": true。`);
    }
  }
}
process.exit(failed ? 1 : 0);
