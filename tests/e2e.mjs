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
  if (!opts.keepHome) {   // 預設測試：閂首頁「我想……」，標記轉做「全部」
    if (await page.locator('#wants').isVisible()) await page.click('#wants-close');
    await page.evaluate(() => { while (window.__clr.S.pinMode !== 'all') document.querySelector('#btn-labels').click(); });
  }
  return { ctx, page, errors };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 㩒住手機掣（或者鍵盤鍵）直到條件成立：測試機用軟件模擬 3D，好慢，所以唔用固定時間。
async function holdUntil(page, how, cond, timeout = 20000) {
  if (how.key) await page.keyboard.down(how.key);
  else { const b = await page.locator(how.button).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); }
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < timeout) { if (await page.evaluate(cond)) { ok = true; break; } await sleep(150); }
  if (how.key) await page.keyboard.up(how.key); else await page.mouse.up();
  return ok;
}

/* ---------- 手機（直向） ---------- */
const phone = devices['iPhone 13'];
const { ctx, page, errors } = await openPage(phone);
const facilities = await page.evaluate(() => window.__clr.data.facilities.map(f => ({ id: f.id, name: f.name, at: f.at, floor: f.floor })));

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
    // 用左上角轉層掣去返設施所在嗰層
    const fl = f.floor === 'all' ? 'G' : f.floor;
    if (await page.evaluate(() => window.__clr.S.view.floor) !== fl) { await page.click(`#floor-seg [data-floor="${fl}"]`); await sleep(1500); }
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
      if (f.id === 'stairs') assert.ok(rows.includes('連接') && rows.includes('一樓'), '樓梯資料卡冇講連接邊幾層');
      else assert.ok(rows.includes('開放時間') && rows.includes('預約方法'), '冇時間或者預約方法');
      assert.equal(await page.locator('#card-photo img, #card-photo .ph-empty').count(), 1, '冇相片位');
      if (f.id === facilities[4].id) { await sleep(400); await page.screenshot({ path: join(OUT, '02-card.png') }); }
    } finally {
      if (await page.locator('#card').isVisible()) await page.click('#card .close-btn');
    }
  }
  await page.click('#floor-seg [data-floor="G"]'); await sleep(1500);
  await page.screenshot({ path: join(OUT, '01b-pins.png') });
});

await check('2b. 撳 3D 模型本身（唔係標記）都揀到設施', async () => {
  await page.click('[data-tab="3d"]');
  await sleep(500);
  // 撳社區廚房（Pantry）入面嘅地板，唔係標記本身：離大電視嘅點遠啲，而且冇標記遮住。
  const pt = await page.evaluate(() => {
    const v = window.__clr.S.view, r = document.querySelector('#v3-canvas canvas').getBoundingClientRect();
    for (let y = 340; y <= 480; y += 20) for (let x = -320; x <= -40; x += 20) {
      const p = v.screenOf(x, y), sx = r.left + p.x, sy = r.top + p.y;
      if (document.elementFromPoint(sx, sy)?.tagName === 'CANVAS') return { x: sx, y: sy };
    }
    return null;
  });
  assert.ok(pt, '社區廚房全部俾標記遮住，搵唔到位置試撳');
  await page.mouse.click(pt.x, pt.y);
  await page.waitForSelector('#card:not([hidden])', { timeout: 3000 });
  assert.ok((await page.textContent('#card-title')).includes('社區廚房'));
  await page.click('#card .close-btn');
});

await check('3. 自動導覽由入口開始，順序行晒，可以暫停同跳過', async () => {
  await page.click('[data-tab="tour"]');
  await page.waitForFunction(() => window.__clr.S.view.tour.state().active);
  let st = await page.evaluate(() => window.__clr.S.view.tour.state());
  assert.equal(st.fid, 'side-entrance', `第一站係 ${st.fid}`);
  await page.waitForFunction(() => window.__clr.S.view.tour.state().phase === 'dwell', null, { timeout: 30000 });
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
    // 導覽會自動轉去設施所在嗰層，字卡亦講明係邊層
    if (facilities[i].floor !== 'all') {
      assert.equal(await page.evaluate(() => window.__clr.S.view.floor), facilities[i].floor, `「${facilities[i].name}」冇轉去啱嘅樓層`);
      assert.ok((await page.textContent('#tour-step')).includes(facilities[i].floor === 'G' ? '地下' : '一樓'));
    }
    if (facilities[i].id === 'library') { await page.waitForFunction(() => window.__clr.S.view.tour.state().phase === 'dwell', null, { timeout: 30000 }); await page.screenshot({ path: join(OUT, '04b-tour-1f.png') }); }
  }
  assert.deepEqual(seen, facilities.map(f => f.id));
  await page.waitForFunction(() => window.__clr.S.view.tour.state().phase === 'dwell', null, { timeout: 30000 });
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
  await page.evaluate(() => { window.__clr.s0 = window.__clr.S.view.walkState(); });
  const moved = await holdUntil(page, { button: '[data-wk="f"]' }, () => { const a = window.__clr.s0, b = window.__clr.S.view.walkState(); return Math.hypot(b.x - a.x, b.y - a.y) > 50; });
  assert.ok(moved, '撳住向前掣行唔郁');
  await page.screenshot({ path: join(OUT, '05-walk-phone.png') });
  // 對住前面外牆（y = 1575，有窗）一直行：唔可以穿過去。yaw = π 即係向 +y（前面）行。
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(-350, 1420); v.setYaw(Math.PI); });
  // 一直向牆行，直到停低（連續幾次位置唔變）或者穿咗牆
  await holdUntil(page, { button: '[data-wk="f"]' }, () => { const c = window.__clr, y = c.S.view.walkState().y; const same = c.lastY != null && Math.abs(y - c.lastY) < 0.5; c.lastY = y; c.same = same ? (c.same || 0) + 1 : 0; return y > 1575 || c.same >= 4; }, 25000);
  const s2 = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.ok(s2.y < 1575 - 22, `穿咗牆：y = ${s2.y.toFixed(1)}（牆喺 y = 1575）`);
});
await check('4b. 漫遊：入門口行得過（門唔會擋死）', async () => {
  // 由大門口（Foyer）向北行，經 DR-05 入地下：門喺 y = 1455，x 348–445。yaw = 0 即係向北。
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(395, 1525); v.setYaw(0); });
  await holdUntil(page, { button: '[data-wk="f"]' }, () => window.__clr.S.view.walkState().y < 1420);
  const s2 = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.ok(s2.y < 1420, `行唔入地下：y = ${s2.y.toFixed(1)}`);
  await page.screenshot({ path: join(OUT, '06-walk-door.png') });
});

await check('4d. 漫遊：行入樓梯口上一樓，再行返落地下', async () => {
  // 樓梯喺大門口正前面：由大門口向北（yaw = 0）行上樓梯
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkHome(); v.walkTo(537, 1505); v.setYaw(0); });
  await holdUntil(page, { button: '[data-wk="f"]' }, () => window.__clr.S.view.walkState().floor === '1F');
  let st = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.equal(st.floor, '1F', `行入樓梯口冇上到一樓（而家 ${st.floor}，位置 ${st.x.toFixed(0)},${st.y.toFixed(0)}）`);
  assert.ok((await page.textContent('#walk-floor')).includes('一樓'), '冇顯示「你喺：一樓」');
  await sleep(1200);
  await page.screenshot({ path: join(OUT, '06b-walk-1f.png') });
  // 一樓：轉身行返落樓梯
  // 企返一樓樓梯平台（上嚟之後㩒住掣可能已經行咗出走廊），轉身向南行落樓梯
  await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(537, 915); v.setYaw(Math.PI); });
  await holdUntil(page, { button: '[data-wk="f"]' }, () => window.__clr.S.view.walkState().floor === 'G');
  st = await page.evaluate(() => window.__clr.S.view.walkState());
  assert.equal(st.floor, 'G', `一樓行返落樓梯失敗（而家 ${st.floor}）`);
  await page.click('[data-tab="3d"]');
});

await check('4e. 3D 轉層掣：揀一樓淨係見一樓設施', async () => {
  await page.click('[data-tab="3d"]'); await sleep(500);
  await page.click('#floor-seg [data-floor="1F"]');
  const want = facilities.filter(f => f.floor === '1F' || f.floor === 'all').map(f => f.id).sort();
  // 等鏡頭飛完（測試機慢），標記穩定先比較
  const ok = await page.waitForFunction(w => JSON.stringify([...document.querySelectorAll('.pin')].filter(p => !p.hidden).map(p => p.dataset.fid).sort()) === JSON.stringify(w), want, { timeout: 20000 }).then(() => true, () => false);
  const vis = await page.evaluate(() => [...document.querySelectorAll('.pin')].filter(p => !p.hidden).map(p => p.dataset.fid).sort());
  assert.ok(ok, `一樓見到嘅標記：${vis.join('、')}；應該係：${want.join('、')}`);
  await page.screenshot({ path: join(OUT, '01c-1f.png') });
  await page.click('#floor-seg [data-floor="G"]'); await sleep(1200);
});

await check('5. 2D 平面圖同 3D 位置一致', async () => {
  await page.click('[data-tab="plan"]');
  await page.waitForSelector('.plan-floor:not([hidden]) .ppin');
  const same = await page.evaluate(() => {
    const { data, plans, S } = window.__clr;
    return data.facilities.every(f => {
      const b = plans[f.floor === 'all' ? S.plan2d.floor : f.floor].bounds, pad = 60, vw = b.w + pad * 2, vh = b.h + pad * 2;
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

await check('冇顯示地區名同標誌', async () => {
  const r = await page.evaluate(() => ({ txt: /\u89c0\u5858|kwun\s*tong/i.test(document.body.innerText + document.title), logo: document.querySelectorAll('.logo, header img, header svg:not(.top-btn svg)').length }));
  assert.equal(r.txt, false, '網頁有地區名');
  assert.equal(r.logo, 0, '標題有標誌');
});

await check('私隱：平面圖冇任何標籤（標籤可能有同事名）', async () => {
  const txt = await page.evaluate(async () => (await fetch('data/plan.json')).text());
  assert.equal(/"label"/.test(txt), false);
});

await check('首頁「我想……」帶去設施，資料卡有三步卡；地圖預設只顯示常用設施', async () => {
  const h = await openPage(phone, { keepHome: true });
  try {
    assert.equal(await h.page.locator('#wants').isVisible(), true, '首頁冇彈出「我想……」');
    await h.page.screenshot({ path: join(OUT, '00-wants.png') });
    await h.page.click('#wants-grid [data-to="laundry"]');
    await h.page.waitForSelector('#card:not([hidden])');
    assert.ok((await h.page.textContent('#card-title')).includes('洗衣'));
    assert.equal(await h.page.locator('#card-steps .steps li').count(), 3, '洗衣冇三步卡');
    assert.equal(await h.page.locator('#info-btn, #info').count(), 0, '「資料」版應該已經刪走');
    await sleep(1200); await h.page.screenshot({ path: join(OUT, '00b-steps.png') });
    await h.page.click('#card .close-btn'); await h.page.click('#btn-reset'); await sleep(2500);
    const st = await h.page.evaluate(() => window.__clr.S.view.pinState());
    assert.equal(st.find(p => p.id === 'stairs').hidden, true, '預設唔應該顯示樓梯標記');
    assert.equal(st.find(p => p.id === 'kitchen').hidden, false, '預設應該顯示廚房標記');
  } finally { await h.ctx.close(); }
});

await check('冇 JavaScript 錯誤（手機）', async () => { assert.deepEqual(errors, []); });
await ctx.close();

/* ---------- 電腦：WASD ---------- */
{
  const { ctx, page, errors } = await openPage({ viewport: { width: 1280, height: 800 } }, { hash: '#walk' });
  await check('4c. 漫遊：電腦用 WASD 行得，唔會穿牆', async () => {
    await page.waitForSelector('#walkui:not([hidden])');
    // 測試機用軟件模擬 3D（大約每秒十幾格），所以㩒耐啲。
    await page.evaluate(() => { window.__clr.s0 = window.__clr.S.view.walkState(); });
    assert.ok(await holdUntil(page, { key: 'w' }, () => { const a = window.__clr.s0, b = window.__clr.S.view.walkState(); return Math.hypot(b.x - a.x, b.y - a.y) > 50; }), 'W 行唔郁');
    const s1 = await page.evaluate(() => window.__clr.S.view.walkState());
    await page.evaluate(() => { window.__clr.y0 = window.__clr.S.view.walkState().yaw; });
    assert.ok(await holdUntil(page, { key: 'ArrowLeft' }, () => Math.abs(window.__clr.S.view.walkState().yaw - window.__clr.y0) > 0.3), '方向鍵轉唔到身');
    // 向西行去左邊外牆（x = -437，前面有書架）
    await page.evaluate(() => { const v = window.__clr.S.view; v.walkTo(-200, 1050); v.setYaw(Math.PI / 2); window.__clr.lastX = null; });
    await holdUntil(page, { key: 'w' }, () => { const c = window.__clr, x = c.S.view.walkState().x; const same = c.lastX != null && Math.abs(x - c.lastX) < 0.5; c.lastX = x; c.sx = same ? (c.sx || 0) + 1 : 0; return x < -437 || c.sx >= 4; }, 25000);
    const s3 = await page.evaluate(() => window.__clr.S.view.walkState());
    assert.ok(s3.x > -437 + 7.5 + 20, `穿咗外牆：x = ${s3.x.toFixed(1)}`);
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

await browser.close();
server.close();
console.log(results.map(r => r.join(' ')).join('\n'));
if (results.some(r => r[0] === '❌')) process.exit(1);
