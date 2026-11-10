// 端對端測試：用手機尺寸開網頁，逐項檢查驗收標準。
// 用法：npm install && npm run e2e   （截圖會放喺 test-output/）
// 3D 程式庫正式係由 jsdelivr 載入；測試時改由 node_modules/three 提供，唔使上網。
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'test-output');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = path && path !== '.' ? path : 'index.html';
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
let current = null;
const check = async (name, fn) => {
  try { await fn(); results.push(['✅', name]); }
  catch (e) {
    results.push(['❌', name + '：' + e.message.split('\n')[0]]);
    // 失敗之後閂返資料卡，唔好連累下一項測試。
    await current?.evaluate(() => document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; s.classList.remove('open'); })).catch(() => {});
  }
};

async function openPage(device, opts = {}) {
  const ctx = await browser.newContext({ ...device, locale: 'zh-HK', ...opts });
  await ctx.route('https://cdn.jsdelivr.net/npm/three@0.128.0/**', async route => {
    const p = new URL(route.request().url()).pathname.replace('/npm/three@0.128.0/', '');
    route.fulfill({ status: 200, contentType: 'text/javascript', body: await readFile(join(ROOT, 'node_modules/three', p)) });
  });
  const page = await ctx.newPage();
  current = page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + (opts.hash || ''));
  await page.waitForFunction(() => window.__clr?.ready === true, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 手機（直向） ---------- */
const phone = devices['iPhone 13'];
const { ctx, page, errors } = await openPage(phone);
const facilities = await page.evaluate(() => window.__clr.data.facilities.map(f => ({ id: f.id, name: f.name, at: f.at })));

await check('1. 唔使登入就打開到 3D 地圖', async () => {
  assert.equal(await page.locator('#v3-msg').isHidden(), true, '3D 載入訊息仲未消失');
  const lit = await page.evaluate(async () => {
    const img = new Image(); img.src = window.__clr.S.view.renderNow(); await img.decode();
    const g = document.createElement('canvas'); g.width = 60; g.height = 60;
    g.getContext('2d').drawImage(img, 0, 0, 60, 60);
    const d = g.getContext('2d').getImageData(0, 0, 60, 60).data;
    const set = new Set(); for (let i = 0; i < d.length; i += 16) set.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4);
    return set.size;
  });
  assert.ok(lit > 8, `3D 畫面得 ${lit} 種顏色，似乎冇畫到嘢`);
  await page.screenshot({ path: join(OUT, '01-3d-overview.png') });
});

await check('2. 每個設施都撳得到，資料卡有名稱、簡介、時間／預約、相片位', async () => {
  await page.click('[data-tab="3d"]');
  await sleep(400);
  // 全景入面每個設施標記都要見到，而且撳中嘅位置唔會俾其他標記遮住。
  for (const f of facilities) {
    const pin = page.locator(`.pin[data-fid="${f.id}"]`);
    assert.equal(await pin.isVisible(), true, `「${f.name}」嘅 3D 標記見唔到`);
    const bb = await pin.boundingBox();
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pin')?.dataset.fid, [bb.x + bb.width / 2, bb.y + bb.height / 2]);
    assert.equal(top, f.id, `撳「${f.name}」標記會撳中「${top}」`);
    await pin.click();
    try {
      await page.waitForSelector('#card:not([hidden])');
      const t = await page.textContent('#card-title');
      assert.ok(t.includes(f.name), `資料卡標題「${t}」唔係「${f.name}」`);
      assert.ok((await page.textContent('#card-summary')).trim().length > 0, '冇簡介');
      const rows = await page.textContent('#card-rows');
      assert.ok(rows.includes('開放時間') && rows.includes('預約方法'), '冇時間或者預約方法');
      assert.equal(await page.locator('#card-photo img, #card-photo .ph-empty').count(), 1, '冇相片位');
      if (f.id === facilities[4].id) { await sleep(400); await page.screenshot({ path: join(OUT, '02-card.png') }); }
    } finally {
      if (await page.locator('#card').isVisible()) await page.click('#card .close-btn');
    }
  }
  await page.screenshot({ path: join(OUT, '01b-pins.png') });
});

await check('2b. 撳 3D 模型本身（唔係標記）都揀到設施', async () => {
  await page.click('[data-tab="3d"]');
  await sleep(500);
  // 撳休憩區（玻璃房）入面嘅地板，唔係標記本身。
  // 喺休憩區入面搵一點：離牆同按摩椅有啲距離，而且冇標記遮住。
  const pt = await page.evaluate(() => {
    const v = window.__clr.S.view, r = document.querySelector('#v3-canvas canvas').getBoundingClientRect();
    for (let y = 790; y <= 1230; y += 20) for (let x = 680; x <= 850; x += 20) {
      if (Math.hypot(x - 720, y - 1180) < 130) continue;
      const p = v.screenOf(x, y), sx = r.left + p.x, sy = r.top + p.y;
      if (document.elementFromPoint(sx, sy)?.tagName === 'CANVAS') return { x: sx, y: sy };
    }
    return null;
  });
  assert.ok(pt, '休憩區全部俾標記遮住，搵唔到位置試撳');
  await page.mouse.click(pt.x, pt.y);
  await page.waitForSelector('#card:not([hidden])', { timeout: 3000 });
  assert.ok((await page.textContent('#card-title')).includes('大電視'));
  await page.click('#card .close-btn');
});

await check('3. 自動導覽由入口開始，順序行晒，可以暫停同跳過', async () => {
  await page.click('[data-tab="tour"]');
  await page.waitForFunction(() => window.__clr.S.view.tour.state().active);
  let st = await page.evaluate(() => window.__clr.S.view.tour.state());
  assert.equal(st.fid, 'entrance', `第一站係 ${st.fid}`);
  await page.waitForFunction(() => window.__clr.S.view.tour.state().phase === 'dwell', null, { timeout: 8000 });
  await page.screenshot({ path: join(OUT, '03-tour-entrance.png') });
  // 暫停：時間唔再行
  await page.click('#tour-play');
  const p1 = await page.evaluate(() => window.__clr.S.view.tour.state().progress);
  await sleep(1200);
  st = await page.evaluate(() => window.__clr.S.view.tour.state());
  assert.ok(st.paused && Math.abs(st.progress - p1) < 1e-6, '暫停咗都仲行緊');
  assert.ok((await page.textContent('#tour-play')).includes('繼續'));
  await page.click('#tour-play');
  // 逐個跳過，順序要同設施清單一樣
  const seen = [st.fid];
  for (let i = 1; i < facilities.length; i++) {
    await page.click('#tour-next');
    st = await page.evaluate(() => window.__clr.S.view.tour.state());
    seen.push(st.fid);
    assert.ok((await page.textContent('#tour-title')).includes(facilities[i].name));
  }
  assert.deepEqual(seen, facilities.map(f => f.id));
  await page.waitForFunction(() => window.__clr.S.view.tour.state().phase === 'dwell', null, { timeout: 8000 });
  await page.screenshot({ path: join(OUT, '04-tour-last.png') });
  await page.click('#tour-next');
  assert.equal(await page.locator('#tour-done').isVisible(), true, '最後冇顯示完結');
  // 自動前進：重新開始之後，唔撳任何掣都會自己去第二站
  await page.evaluate(() => { window.__clr.data.facilities[0].seconds = 1; });
  await page.click('#tour-again');
  await page.waitForFunction(() => window.__clr.S.view.tour.state().idx === 1, null, { timeout: 12000 });
  await page.click('#tour-stop');
});

await check('4. 漫遊：手機掣行得，唔會穿牆', async () => {
  await page.click('[data-tab="walk"]');
  await page.waitForSelector('#walkui:not([hidden])');
  assert.equal(await page.locator('.dpad').isVisible(), true, '手機冇顯示行路掣');
  const s0 = await page.evaluate(() => window.__clr.S.view.walkState());
  const fwd = page.locator('[data-wk="f"]');
  const b = await fwd.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(1200); await page.mouse.up();
  const s1 = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.ok(Math.hypot(s1.x - s0.x, s1.y - s0.y) > 50, `撳住向前掣得行咗 ${Math.round(Math.hypot(s1.x - s0.x, s1.y - s0.y))} cm`);
  await page.screenshot({ path: join(OUT, '05-walk-phone.png') });
  // 對住儲物室間隔牆（y = 1292）一直行 5 秒：唔可以穿過去。yaw = π 即係向 +y 行。
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(300, 1150); v.setYaw(Math.PI); });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(5000); await page.mouse.up();
  const s2 = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.ok(s2.y < 1292 - 22, `穿咗牆：y = ${s2.y.toFixed(1)}（牆喺 y = 1292）`);
});
await check('4b. 漫遊：入門口行得過（門唔會擋死）', async () => {
  // 由主區行入玻璃房：門喺 x 650–725、y 730（房門），房喺 y > 730。
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(688, 690); v.setYaw(Math.PI); });
  const fwd = page.locator('[data-wk="f"]'), b = await fwd.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(1600); await page.mouse.up();
  const s2 = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.ok(s2.y > 760, `行唔入玻璃房：y = ${s2.y.toFixed(1)}`);
  await page.screenshot({ path: join(OUT, '06-walk-door.png') });
  await page.click('[data-tab="3d"]');
});

await check('5. 2D 平面圖同 3D 位置一致', async () => {
  await page.click('[data-tab="plan"]');
  await page.waitForSelector('.ppin');
  const same = await page.evaluate(() => {
    const { data, plan } = window.__clr;
    const b = plan.bounds, pad = 60, vw = b.w + pad * 2, vh = b.h + pad * 2;
    return data.facilities.every(f => {
      const p = window.__clr.plan2d.pinPercent(f.id);
      return Math.abs(p.x - (f.at.x - b.x + pad) / vw * 100) < 1e-9 && Math.abs(p.y - (f.at.y - b.y + pad) / vh * 100) < 1e-9;
    });
  });
  assert.ok(same, '平面圖座標同 3D 座標唔一致');
  // 3D 鏡頭由正上面望落去，標記嘅左右上下次序要同平面圖一樣
  await page.screenshot({ path: join(OUT, '07-plan.png'), fullPage: false });
});

await check('6. 全部繁體中文、字夠大（手機直向）', async () => {
  for (const tab of ['3d', 'plan', 'list']) {
    await page.click(`[data-tab="${tab}"]`);
    await sleep(300);
    const small = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('[hidden]') || !el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
        const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join('');
        if (!own) return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 14) bad.push(`${own.slice(0, 12)}（${fs}px）`);
      });
      return bad;
    });
    assert.deepEqual(small, [], `${tab}：字太細 ${small.join('、')}`);
  }
  const simp = await page.evaluate(() => /[这为们会说时间设预约门开电视楼饮务儿]/.test(document.body.innerText));
  assert.equal(simp, false, '發現簡體字');
  await page.click('[data-tab="list"]');
  await page.screenshot({ path: join(OUT, '08-list.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, '有橫向捲動');
});

await check('私隱：平面圖冇任何標籤（標籤可能有同事名）', async () => {
  const txt = await page.evaluate(async () => (await fetch('data/plan.json')).text());
  assert.equal(/"label"/.test(txt), false);
});

await check('冇 JavaScript 錯誤（手機）', async () => { assert.deepEqual(errors, []); });
await ctx.close();

/* ---------- 電腦：WASD ---------- */
{
  const { ctx, page, errors } = await openPage({ viewport: { width: 1280, height: 800 } }, { hash: '#walk' });
  await check('4c. 漫遊：電腦用 WASD 行得，唔會穿牆', async () => {
    await page.waitForSelector('#walkui:not([hidden])');
    // 測試機用軟件模擬 3D（大約每秒十幾格），所以㩒耐啲。
    const s0 = await page.evaluate(() => window.__clr.S.view.walkState());
    await page.keyboard.down('w'); await sleep(2000); await page.keyboard.up('w');
    const s1 = await page.evaluate(() => window.__clr.S.view.walkState());
    assert.ok(Math.hypot(s1.x - s0.x, s1.y - s0.y) > 50, 'W 行唔郁');
    await page.keyboard.down('ArrowLeft'); await sleep(500); await page.keyboard.up('ArrowLeft');
    const s2 = await page.evaluate(() => window.__clr.S.view.walkState());
    assert.ok(Math.abs(s2.yaw - s1.yaw) > 0.3, '方向鍵轉唔到身');
    // 撞左邊外牆（x = 0）
    await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(120, 900); v.setYaw(Math.PI / 2); });
    await page.keyboard.down('w'); await sleep(4000); await page.keyboard.up('w');
    const s3 = await page.evaluate(() => window.__clr.S.view.walkState());
    assert.ok(s3.x > 7.5 + 20, `穿咗外牆：x = ${s3.x.toFixed(1)}`);
    await page.screenshot({ path: join(OUT, '09-walk-desktop.png') });
  });
  await check('3D 全景（電腦）', async () => {
    await page.keyboard.press('Escape');
    await sleep(800);
    await page.screenshot({ path: join(OUT, '10-3d-desktop.png') });
  });
  await check('冇 JavaScript 錯誤（電腦）', async () => { assert.deepEqual(errors, []); });
  await ctx.close();
}

/* ---------- 資料檔打錯：要清楚講錯喺邊 ---------- */
{
  const ctx = await browser.newContext({ ...phone, locale: 'zh-HK' });
  current = null;
  await ctx.route('**/data/center.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{\n  "facilities": [\n    { "id": "a" "name": "漏咗逗號" }\n  ]\n}' }));
  const page = await ctx.newPage();
  await check('資料檔打錯時，顯示中文錯誤同行數', async () => {
    await page.goto(base);
    await page.waitForSelector('#fatal:not([hidden])', { timeout: 10000 });
    const t = await page.textContent('#fatal');
    assert.ok(/第 3 行/.test(t), `錯誤訊息冇講行數：${t}`);
    await page.screenshot({ path: join(OUT, '11-data-error.png') });
  });
  await ctx.close();
}

/* ---------- 資料（關於）頁 ---------- */
{
  const { ctx, page } = await openPage(phone);
  await check('「資料」頁有使用說明', async () => {
    await page.click('#info-btn');
    await page.waitForSelector('#info:not([hidden])');
    await sleep(600);
    const t = await page.textContent('#info');
    assert.ok(t.includes('點樣用') && t.includes('漫遊'));
    await page.screenshot({ path: join(OUT, '12-info.png') });
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(results.map(r => r.join(' ')).join('\n'));
if (results.some(r => r[0] === '❌')) process.exit(1);
