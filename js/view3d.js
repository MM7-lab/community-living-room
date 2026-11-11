// 3D 模型：做法同「新辦公室平面圖」工具一樣（three.js r128 + OrbitControls，由 jsdelivr 載入）。
import {
  WALL_H, LOW_H, EYE_H, FLOOR_H, STAIR, CATALOG, rad, baseSegments, openingsOf, holesOn, solidSpans, toWorldFrom,
  collisionData, resolveWalk, stepWalk, lineBlocked, elev, baseDims, corners, dwellSeconds, facilityAt, insideBuilding,
  facilitiesOn, stairsGeometry,
} from './plan-model.js';

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src; el.async = false;
    el.onload = res;
    el.onerror = () => { el.remove(); rej(new Error('未能載入 ' + src)); };
    document.head.appendChild(el);
  });
}
export function loadThree() {
  if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
  if (!loading) {
    loading = (window.THREE ? Promise.resolve() : loadScript(CDN + 'build/three.min.js'))
      .then(() => (window.THREE.OrbitControls ? null : loadScript(CDN + 'examples/js/controls/OrbitControls.js')))
      .catch(e => { loading = null; throw e; });
  }
  return loading;
}
export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

// 暖色調：米白牆、木地板色、橙色椅、鼠尾草綠屏風。
const MAT_SPEC = {
  floor: [0xEEDDC3], ceiling: [0xFFF8EE], wall: [0xFBF3E7], cap: [0xB98B62], glass: [0xA6D3E6, 0.32],
  wood: [0xD4A570], top: [0xEBD3AE], steel: [0xB8AC9F], dark: [0x5E514A], chair: [0xE48F5C], fabric: [0xBFD7C0],
  door: [0xC98B57], column: [0xF1E7D8], card: [0xC9995F], screen: [0x2D2826], plant: [0x6FAF73], pot: [0xB78C6C],
  machine: [0xF6F1EA], light: [0xF7F0E5], ground: [0xF2E6D3],
  // 設施傢俬用色
  chrome: [0xC9CED2], red: [0xD9573F], blue: [0x5B8FC9], green: [0x79B86F], yellow: [0xF2C14E], pink: [0xEE9FB0],
  white: [0xFBFAF7], sofa: [0xE59A62], cushion: [0xF4D3A8], leather: [0x7D5440], rubber: [0x6E9E96], black: [0x35302C], glassdark: [0x6F93AD],
  stair: [0xD8B48A], slab: [0xE9DCC8],
};
const WOOD = new Set(['window1', 'window2', 'cube3', 'sqcab', 'rectcab', 'bigrect', 'incentive', 'tv_cabinet']);
// 書本、地磚、玩具用嘅顏色（暖色為主）
const BRIGHT = ['#D9573F', '#5B8FC9', '#79B86F', '#F2C14E', '#EE9FB0', '#9C83C9', '#E59A62', '#3E9C8F', '#F6EEDF'];
const seeded = seed => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const PIN_Y = 150;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createView3D({ canvasHost, pinHost, minimap, plans, floors, facilities, start, obstacles = [], onPick, onTour, onWalk, onExitWalk, onMode, onFloor, onStairs }) {
  const T = window.THREE;
  // 樓層：每層一張平面圖（外框一樣），上層放喺 FLOOR_H 高
  const floorList = floors && floors.length ? floors : [{ id: Object.keys(plans)[0], name: '', index: 0, base: 0 }];
  const floorObj = id => floorList.find(f => f.id === id) || floorList[0];
  const baseOf = id => floorObj(id).base;
  const plan0 = plans[floorList[0].id];
  const b = plan0.bounds, cx = b.x + b.w / 2, cz = b.y + b.h / 2, size = Math.max(b.w, b.h);
  const fById = Object.fromEntries(facilities.map(f => [f.id, f]));
  const stairF = facilities.find(f => f.stairs && plans[f.stairs.lower] && plans[f.stairs.upper]);
  const SG = stairF ? stairsGeometry(stairF) : null;
  let floor = floorList[0].id;
  const fFloor = f => (f.floor === 'all' ? floor : f.floor);
  const onFloorF = f => f.floor === floor || f.floor === 'all';
  // 每層嘅碰撞（牆、傢俬、樓梯）
  const cols = {};
  const colOf = id => {
    if (!cols[id]) {
      const c = collisionData(plans[id]);
      if (SG && SG.lower.floor === id) c.rects.push(...SG.lower.colliders);
      if (SG && SG.upper.floor === id) c.rects.push(...SG.upper.colliders);
      cols[id] = c;
    }
    return cols[id];
  };

  /* ---------- renderer, scene, camera ---------- */
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '社區客廳 3D 模型');
  canvasHost.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0xFFF4E4);
  const camera = new T.PerspectiveCamera(45, 1, 10, 30000);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, maxPolarAngle: Math.PI / 2 - 0.06, minDistance: 150, maxDistance: size * 4, screenSpacePanning: true, rotateSpeed: 0.7 });

  const hemi = new T.HemisphereLight(0xFFF6EA, 0xC9B79C, 0.82);
  const amb = new T.AmbientLight(0xFFFFFF, 0.12);
  const sun = new T.DirectionalLight(0xFFF0D8, 0.62);
  sun.position.set(cx - 600, 1500, cz - 450); sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  const sm = window.matchMedia?.('(pointer: coarse)').matches ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -size * 0.8, right: size * 0.8, top: size * 0.8, bottom: -size * 0.8, near: 10, far: 6000 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, amb, sun, sun.target);

  const M = {};
  function mat(key) {
    if (M[key]) return M[key];
    if (key === 'edge') return (M.edge = new T.LineBasicMaterial({ color: 0x7A5C45, transparent: true, opacity: 0.22 }));
    if (key === 'ceiling') return (M.ceiling = new T.MeshStandardMaterial({ color: 0xFFF8EE, emissive: 0x6E6458, roughness: 1, side: T.DoubleSide }));
    const s = MAT_SPEC[key] || [0xcccccc];
    return (M[key] = new T.MeshStandardMaterial({
      color: s[0], roughness: key === 'chrome' ? 0.35 : 0.88, metalness: key === 'chrome' ? 0.55 : key === 'steel' ? 0.25 : 0,
      transparent: s[1] !== undefined, opacity: s[1] ?? 1,
      side: key === 'floor' || key === 'ceiling' || key === 'ground' ? T.DoubleSide : T.FrontSide,
    }));
  }
  function box3(parent, w, h, d, x, y, z, m, edges = true) {
    const g = new T.BoxGeometry(Math.max(w, 0.5), Math.max(h, 0.5), Math.max(d, 0.5)), mesh = new T.Mesh(g, mat(m));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = m !== 'glass'; mesh.receiveShadow = true;
    parent.add(mesh);
    if (edges) { const e = new T.LineSegments(new T.EdgesGeometry(g), mat('edge')); e.position.copy(mesh.position); e.userData.noPick = true; parent.add(e); }
    return mesh;
  }
  function cyl3(parent, rTop, rBot, h, x, y, z, m, seg = 20) {
    const mesh = new T.Mesh(new T.CylinderGeometry(rTop, rBot, h, seg), mat(m));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  // 好多細件（書、地磚、玩具）合併做一件，手機畫得快啲。
  function colorBlocks(parent, blocks) {
    if (!blocks.length) return null;
    const pos = [], nor = [], colr = [], c = new T.Color(), m4 = new T.Matrix4();
    blocks.forEach(bk => {
      const geo = new T.BoxGeometry(bk.w, bk.h, bk.d).toNonIndexed();
      geo.applyMatrix4(m4.makeTranslation(bk.x, bk.y + bk.h / 2, bk.z));
      const p = geo.attributes.position.array, n = geo.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      c.set(bk.color); for (let i = 0; i < geo.attributes.position.count; i++) colr.push(c.r, c.g, c.b);
      geo.dispose();
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colr, 3));
    const mesh = new T.Mesh(geo, M.vcol || (M.vcol = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
    mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  // 一層層書：由左至右排，高矮厚薄唔同。
  function books(rnd, w, d, levels, fill = 0.85) {
    const out = [];
    levels.forEach(lv => {
      let x = -w / 2 + 3;
      const end = -w / 2 + 3 + (w - 6) * fill;
      while (x < end) {
        const bw = 2.5 + rnd() * 3.5, bh = lv.h * (0.62 + rnd() * 0.3);
        if (x + bw > end) break;
        out.push({ w: bw - 0.4, h: bh, d: d * (0.7 + rnd() * 0.15), x: x + bw / 2, y: lv.y, z: d * 0.06, color: BRIGHT[Math.floor(rnd() * BRIGHT.length)] });
        x += bw;
        if (rnd() < 0.08) x += 4 + rnd() * 6; // 間中留個空位
      }
    });
    return out;
  }
  const itemMat = it => it.type.startsWith('rack') ? 'steel' : WOOD.has(it.type) ? 'wood' : it.type === 'supplybox' ? 'card'
    : it.type === 'printer' ? 'dark' : (it.type === 'microwave' || it.type === 'oven') ? 'machine' : 'light';

  function furniture3D(it, wallH, plan) {
    const c = CATALOG[it.type]; if (!c || it.type === 'window') return null;
    const b0 = baseDims(it), w = b0.w, d = b0.d, H = b0.ht || 80, g = new T.Group();
    const low = wallH < WALL_H;
    switch (c.sym) {
      case 'desk': case 'meeting':
        box3(g, w, 3, d, 0, H - 3, 0, 'top');
        box3(g, 3, H - 3, d - 8, -w / 2 + 3, 0, 0, 'steel', false); box3(g, 3, H - 3, d - 8, w / 2 - 3, 0, 0, 'steel', false);
        if (c.sym === 'desk') box3(g, w - 8, 35, 2, 0, H - 40, -d / 2 + 4, 'steel', false);
        break;
      case 'chair':
        box3(g, 8, 40, 8, 0, 0, 0, 'dark', false);
        box3(g, w * 0.84, 8, d * 0.7, 0, 40, -d * 0.05, 'chair');
        box3(g, w * 0.84, 42, 6, 0, 48, d / 2 - 6, 'chair');
        break;
      case 'panel': box3(g, w, H, Math.max(d, 4), 0, 0, 0, 'fabric'); break;
      case 'ushape': {
        const t = Math.min(5, w / 4, d / 4);
        box3(g, w, H, t, 0, 0, -d / 2 + t / 2, 'fabric'); box3(g, t, H, d, -w / 2 + t / 2, 0, 0, 'fabric'); box3(g, t, H, d, w / 2 - t / 2, 0, 0, 'fabric');
        break;
      }
      case 'shelf': {
        box3(g, 3, H, d, -w / 2 + 1.5, 0, 0, 'steel', false); box3(g, 3, H, d, w / 2 - 1.5, 0, 0, 'steel', false);
        const n = Math.max(3, Math.round(H / 40));
        for (let i = 0; i <= n; i++) box3(g, w, 2, d, 0, Math.min(H - 2, i * H / n), 0, 'steel', i === n);
        // 左牆層架當係圖書閣嘅書架：每層放書
        colorBlocks(g, books(seeded(it.id), w, d, Array.from({ length: n }, (_, i) => ({ y: i * H / n + 2, h: H / n - 6 })), 0.8));
        break;
      }
      case 'bookshelf': {
        box3(g, 3, H, d, -w / 2 + 1.5, 0, 0, 'wood'); box3(g, 3, H, d, w / 2 - 1.5, 0, 0, 'wood');
        box3(g, w, H, 2, 0, 0, -d / 2 + 1, 'wood', false);
        const n = 5;
        for (let i = 0; i <= n; i++) box3(g, w - 6, 2.5, d - 2, 0, Math.min(H - 2.5, i * H / n), 1, 'wood', false);
        colorBlocks(g, books(seeded(it.id), w, d, Array.from({ length: n }, (_, i) => ({ y: i * H / n + 2.5, h: H / n - 6 })), 0.9));
        break;
      }
      case 'coffeebar': {
        box3(g, w, H - 4, d - 6, 0, 0, -3, 'wood');
        box3(g, w + 4, 4, d + 4, 0, H - 4, 0, 'top');
        const mx = -w / 2 + 38;
        box3(g, 48, 40, 38, mx, H, -d / 2 + 22, 'red');                 // 咖啡機
        box3(g, 40, 4, 6, mx, H + 30, -d / 2 + 43, 'chrome', false);
        cyl3(g, 3.5, 3.5, 10, mx - 8, H + 14, -d / 2 + 44, 'chrome', 10); // 沖煮頭
        cyl3(g, 3.5, 3.5, 10, mx + 8, H + 14, -d / 2 + 44, 'chrome', 10);
        cyl3(g, 9, 11, 30, mx + 48, H, -d / 2 + 20, 'black');           // 磨豆機
        cyl3(g, 10, 5, 12, mx + 48, H + 30, -d / 2 + 20, 'glassdark');
        for (let i = 0; i < 4; i++) cyl3(g, 3.5, 3, 7, w / 2 - 50 + i * 10, H, d / 2 - 14, 'white', 12); // 咖啡杯
        break;
      }
      case 'stool': {
        const kid = it.type === 'kids_stool';
        if (kid) cyl3(g, w / 2, w / 2 * 0.85, H, 0, 0, 0, ['yellow', 'blue', 'green', 'pink', 'red'][Math.floor(seeded(it.id)() * 5)]);
        else {
          cyl3(g, w / 2 * 0.75, w / 2 * 0.8, 3, 0, 0, 0, 'chrome');
          cyl3(g, 2.5, 2.5, H - 6, 0, 3, 0, 'chrome', 10);
          cyl3(g, w / 2 * 0.6, w / 2 * 0.6, 2, 0, H * 0.35, 0, 'chrome');  // 腳踏
          cyl3(g, w / 2, w / 2, 6, 0, H - 6, 0, 'chair');
        }
        break;
      }
      case 'kitchen': {
        box3(g, w, H - 4, d - 4, 0, 0, -2, 'white');
        box3(g, w + 2, 4, d + 2, 0, H - 4, 0, 'top');
        box3(g, 45, 2, 35, -w / 4, H - 1, 0, 'chrome', false);         // 盆
        box3(g, 55, 1.5, 45, w / 4, H, 0, 'black', false);              // 電磁爐
        break;
      }
      case 'fridge': {
        box3(g, w, H, d, 0, 0, 0, 'white');
        box3(g, w + 0.5, 1.5, 1, 0, H * 0.66, d / 2, 'steel', false);
        box3(g, 3, 45, 4, w / 2 - 8, H * 0.25, d / 2 + 2, 'chrome', false);
        box3(g, 3, 28, 4, w / 2 - 8, H * 0.72, d / 2 + 2, 'chrome', false);
        break;
      }
      case 'sofa': {
        box3(g, w, 40, d, 0, 0, 0, 'sofa');
        const n = w > 150 ? 3 : 2, cw = (w - 24) / n;
        for (let i = 0; i < n; i++) box3(g, cw - 2, 12, d - 24, -w / 2 + 12 + cw * (i + 0.5), 40, 8, 'cushion');
        box3(g, w, 45, 20, 0, 40, -d / 2 + 10, 'sofa');
        box3(g, 12, 22, d, -w / 2 + 6, 40, 0, 'sofa'); box3(g, 12, 22, d, w / 2 - 6, 40, 0, 'sofa');
        box3(g, 30, 28, 10, -w / 2 + 34, 52, -d / 2 + 26, 'yellow');   // 咕𠱸
        box3(g, 30, 28, 10, w / 2 - 34, 52, -d / 2 + 26, 'blue');
        break;
      }
      case 'table': {
        const top = it.type === 'kids_table' ? 'yellow' : it.type === 'folding_table' ? 'light' : 'wood';
        const leg = it.type === 'kids_table' ? 'blue' : it.type === 'folding_table' ? 'steel' : 'wood';
        box3(g, w, 4, d, 0, H - 4, 0, top);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box3(g, 4, H - 4, 4, sx * (w / 2 - 6), 0, sz * (d / 2 - 6), leg, false);
        break;
      }
      case 'roundtable':
        cyl3(g, w / 2, w / 2, 4, 0, H - 4, 0, 'wood', 32);
        cyl3(g, 4, 4, H - 4, 0, 0, 0, 'steel', 12);
        cyl3(g, w / 4, w / 4, 3, 0, 0, 0, 'steel', 24);
        break;
      case 'massage': {
        box3(g, w - 10, 22, d - 30, 0, 0, -6, 'black');                      // 底座
        box3(g, 14, 38, 80, -w / 2 + 7, 22, -8, 'leather'); box3(g, 14, 38, 80, w / 2 - 7, 22, -8, 'leather'); // 扶手
        box3(g, w - 28, 16, 55, 0, 28, 0, 'cushion');                        // 座墊
        const back = box3(g, w - 22, 80, 20, 0, 34, -d / 2 + 26, 'leather', false); back.rotation.x = -0.32;
        const head = box3(g, w - 34, 20, 16, 0, 108, -d / 2 + 6, 'cushion', false); head.rotation.x = -0.32;
        const legs = box3(g, w - 30, 12, 42, 0, 14, d / 2 - 20, 'leather', false); legs.rotation.x = 0.45; // 腳托
        break;
      }
      case 'treadmill': {
        box3(g, w, 14, d, 0, 0, 0, 'dark');
        box3(g, w - 16, 2, d - 34, 0, 14, 10, 'black', false);              // 跑帶
        for (const sx of [-1, 1]) {
          box3(g, 6, 110, 8, sx * (w / 2 - 5), 14, -d / 2 + 14, 'steel');   // 企柱
          box3(g, 4, 4, 55, sx * (w / 2 - 5), 100, -d / 2 + 40, 'chrome', false); // 扶手
        }
        box3(g, w, 12, 26, 0, 118, -d / 2 + 14, 'dark');                    // 控制台
        box3(g, 32, 8, 2, 0, 120, -d / 2 + 28, 'glassdark', false);
        break;
      }
      case 'bike': {
        box3(g, 10, 8, d, 0, 0, 0, 'dark');
        box3(g, w, 6, 10, 0, 0, -d / 2 + 5, 'dark'); box3(g, w, 6, 10, 0, 0, d / 2 - 5, 'dark');
        const fly = cyl3(g, 22, 22, 6, 0, 8, -d / 2 + 30, 'chrome', 28); fly.rotation.z = Math.PI / 2; fly.position.y = 32;
        box3(g, 6, 72, 6, 0, 8, d / 2 - 30, 'steel');
        box3(g, 22, 6, 30, 0, 80, d / 2 - 30, 'black');                     // 座位
        box3(g, 6, 95, 6, 0, 8, -d / 2 + 16, 'steel');
        box3(g, 46, 5, 6, 0, 100, -d / 2 + 14, 'black');                    // 手把
        box3(g, 18, 12, 6, 0, 104, -d / 2 + 10, 'glassdark', false);
        break;
      }
      case 'mat': box3(g, w, Math.max(H, 1.5), d, 0, 0, 0, 'rubber', false); break;
      case 'playmat': {
        const nx = 4, nz = 3, tw = w / nx, td = d / nz, cols = ['#F2C14E', '#7FB8E0', '#F08A7E', '#8FCB8A', '#C9A3E0', '#F6B26B'];
        const tiles = [];
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) tiles.push({ w: tw - 0.6, h: Math.max(H, 2), d: td - 0.6, x: -w / 2 + tw * (i + 0.5), y: 0, z: -d / 2 + td * (j + 0.5), color: cols[(i + j * 2) % cols.length] });
        // 積木
        const rnd = seeded(it.id);
        [[-w / 2 + 30, -d / 2 + 30], [-w / 2 + 48, -d / 2 + 34], [-w / 2 + 38, -d / 2 + 50]].forEach(([x, z], k) => tiles.push({ w: 15, h: 15, d: 15, x, y: H, z, color: BRIGHT[Math.floor(rnd() * 6)] }));
        tiles.push({ w: 15, h: 15, d: 15, x: -w / 2 + 38, y: H + 15, z: -d / 2 + 38, color: '#F2C14E' });
        colorBlocks(g, tiles);
        const ball = new T.Mesh(new T.SphereGeometry(12, 20, 14), mat('red')); ball.position.set(w / 2 - 40, H + 12, d / 2 - 35); ball.castShadow = true; g.add(ball);
        const body = new T.Mesh(new T.SphereGeometry(11, 16, 12), mat('card')); body.position.set(w / 4, H + 11, -d / 4); body.castShadow = true; g.add(body);
        const headM = new T.Mesh(new T.SphereGeometry(8, 16, 12), mat('card')); headM.position.set(w / 4, H + 27, -d / 4); headM.castShadow = true; g.add(headM);
        break;
      }
      case 'toyshelf': {
        box3(g, w, H, d, 0, 0, 0, 'white');
        const bins = [], rnd = seeded(it.id);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) bins.push({ w: w / 3 - 8, h: H / 2 - 10, d: 6, x: -w / 2 + w / 3 * (i + 0.5), y: 5 + j * H / 2, z: d / 2 + 1, color: BRIGHT[Math.floor(rnd() * 6)] });
        colorBlocks(g, bins);
        break;
      }
      case 'laundry': {
        const u = H / 2;
        for (let k = 0; k < 2; k++) {
          box3(g, w, u - 1, d, 0, k * u, 0, 'white');
          box3(g, w - 6, 8, 2, 0, k * u + u - 14, d / 2 + 1, 'steel', false);          // 控制板
          const ring = cyl3(g, 19, 19, 3, 0, 0, 0, 'chrome', 28); ring.rotation.x = Math.PI / 2; ring.position.set(0, k * u + u * 0.42, d / 2 + 1.5);
          const glassM = cyl3(g, 14, 14, 3.4, 0, 0, 0, 'glassdark', 28); glassM.rotation.x = Math.PI / 2; glassM.position.set(0, k * u + u * 0.42, d / 2 + 1.8);
        }
        break;
      }
      case 'tv': box3(g, w, H, Math.max(d, 4), 0, 100, 0, 'screen'); break;
      case 'plant': {
        const pot = new T.Mesh(new T.CylinderGeometry(w * 0.3, w * 0.24, 35, 16), mat('pot')); pot.position.y = 17.5; pot.castShadow = true; g.add(pot);
        const leaf = new T.Mesh(new T.SphereGeometry(w * 0.5, 16, 12), mat('plant')); leaf.position.y = 35 + w * 0.45; leaf.castShadow = true; g.add(leaf);
        break;
      }
      case 'column': box3(g, w, wallH, d, 0, 0, 0, 'column'); break;
      case 'door': box3(g, 4, low ? 100 : 210, d, -w / 2 + 2, 0, 0, 'door'); break;
      case 'door2': { const dh = low ? 100 : 210; box3(g, 4, dh, d, -w / 2 + 2, 0, 0, 'door'); box3(g, 4, dh, d, w / 2 - 2, 0, 0, 'door'); break; }
      default: box3(g, w, H, d, 0, 0, 0, itemMat(it));
    }
    const out = new T.Group(); out.add(g);
    if (it.lay) {
      if (it.lay === 1) g.rotation.z = Math.PI / 2; else g.rotation.x = -Math.PI / 2;
      out.updateMatrixWorld(true);
      const lb = new T.Box3().setFromObject(out);
      g.position.set(-(lb.min.x + lb.max.x) / 2, -lb.min.y, -(lb.min.z + lb.max.z) / 2);
    }
    out.position.set(it.x, elev(it, plan), it.y);
    out.rotation.y = -rad(it.r || 0);
    return out;
  }

  function walls3D(parent, H, plan) {
    const opens = openingsOf(plan);
    baseSegments(plan).forEach(sg => {
      const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, L = Math.hypot(dx, dy); if (L < 1) return;
      const holes = holesOn(sg, opens), g = new T.Group(), main = sg.glass ? 'glass' : 'wall';
      const piece = (s0, s1, y0, y1, m = main) => {
        if (s1 - s0 > 0.5 && y1 - y0 > 0.5) box3(g, s1 - s0, y1 - y0, sg.t, (s0 + s1) / 2, y0, 0, m, m !== 'glass');
        if (m === 'wall' && y1 >= H - 0.5 && s1 - s0 > 0.5) box3(g, s1 - s0, 2, sg.t + 1, (s0 + s1) / 2, H, 0, 'cap', false);
      };
      // 牆兩頭各伸出半個牆厚，轉角位就唔會有缺口。
      solidSpans(L, holes).forEach(([s0, s1]) => piece(s0 < 1 ? -sg.t / 2 : s0, s1 > L - 1 ? L + sg.t / 2 : s1, 0, H));
      holes.forEach(hl => {
        if (hl.kind === 'door') piece(hl.s0, hl.s1, 210, H);
        else { piece(hl.s0, hl.s1, 0, Math.min(90, H)); piece(hl.s0, hl.s1, Math.min(240, H), H); if (H > 90) piece(hl.s0, hl.s1, 90, Math.min(240, H), 'glass'); }
      });
      if (sg.glass) { box3(g, L, 6, 6, L / 2, 0, 0, 'steel', false); if (H > 20) box3(g, L, 5, 6, L / 2, H - 5, 0, 'steel', false); }
      g.position.set(sg.a.x, 0, sg.a.y); g.rotation.y = -Math.atan2(dy, dx);
      parent.add(g);
    });
  }

  const shapeOf = (pts, holes = []) => {
    const s = new T.Shape(pts.map(p => new T.Vector2(p.x, -p.y)));
    holes.forEach(h => s.holes.push(new T.Path(h.map(p => new T.Vector2(p.x, -p.y)))));
    return s;
  };
  // 一層嘅模型：地板（上層有樓梯井）、樓板、牆、傢俬、天花（下層喺樓梯位開窿）
  function buildRoot(fl, H) {
    const plan = plans[fl.id], root = new T.Group();
    const floorHoles = SG && SG.upper.floor === fl.id ? [SG.hole] : [];
    const ceilHoles = SG && SG.lower.floor === fl.id ? [SG.footprint] : [];
    plan.rooms.forEach(r => {
      const floorM = new T.Mesh(new T.ShapeGeometry(shapeOf(r.pts, floorHoles)), mat('floor'));
      floorM.rotation.x = -Math.PI / 2; floorM.receiveShadow = true; floorM.userData.floor = true; root.add(floorM);
      if (fl.index > 0) {
        const slab = new T.Mesh(new T.ExtrudeGeometry(shapeOf(r.pts, floorHoles), { depth: FLOOR_H - WALL_H - 0.5, bevelEnabled: false }), mat('slab'));
        slab.rotation.x = -Math.PI / 2; slab.position.y = -(FLOOR_H - WALL_H); slab.castShadow = true; slab.receiveShadow = true; root.add(slab);
      }
    });
    walls3D(root, H, plan);
    plan.items.forEach(it => {
      const f = furniture3D(it, H, plan);
      if (f) { f.traverse(o => { if (o.isMesh) { o.castShadow = o.material !== M.glass; o.receiveShadow = true; } }); root.add(f); }
    });
    if (floorHoles.length) root.add(stairRailing());
    if (H >= WALL_H) {
      const ceil = new T.Group();
      plan.rooms.forEach(r => { const m = new T.Mesh(new T.ShapeGeometry(shapeOf(r.pts, ceilHoles)), mat('ceiling')); m.rotation.x = -Math.PI / 2; m.position.y = WALL_H; ceil.add(m); });
      ceil.userData.noPick = true; root.add(ceil); root.userData.ceiling = ceil;
    }
    root.position.y = fl.base; root.userData.floorId = fl.id;
    root.visible = false; scene.add(root);
    return root;
  }
  // 樓梯本地座標 → 3D 群組（x 同 y 對應 3D 嘅 x 同 z）
  const stairGroup = () => { const g = new T.Group(); g.position.set(SG.c.x, 0, SG.c.y); g.rotation.y = -rad(SG.c.r); return g; };
  // U 形樓梯：第一跑（左）上到平台，第二跑（右）返轉頭上到上層
  function buildStairs() {
    const g = stairGroup(), rise = FLOOR_H / STAIR.risers, t = STAIR.tread, hw = SG.hw, hd = SG.hd, fw = STAIR.flight, gx = STAIR.gap / 2;
    const n1 = STAIR.firstRisers - 1, n2 = STAIR.risers - STAIR.firstRisers - 1, land = STAIR.firstRisers * rise;
    for (let i = 1; i <= n1; i++) box3(g, fw, i * rise, t, -gx - fw / 2, 0, hd - t * (i - 0.5), 'stair');
    box3(g, STAIR.w, land, 100, 0, 0, -hd + 50, 'stair');                                    // 轉角平台
    for (let j = 1; j <= n2; j++) box3(g, fw, land + j * rise, t, gx + fw / 2, 0, -hd + 100 + t * (j - 0.5), 'stair');
    box3(g, STAIR.gap, FLOOR_H, hd - (-hd + 100), 0, 0, (hd + (-hd + 100)) / 2, 'wall');      // 中間牆
    g.userData.stairs = true; scene.add(g);
    return g;
  }
  // 上層樓梯井四邊欄杆（樓梯頂嗰邊留空俾人上落）
  function stairRailing() {
    const g = stairGroup(), hw = SG.hw, hd = SG.hd, top = SG.topY, gx = STAIR.gap / 2;
    g.position.y = 0;
    const rail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, horiz = Math.abs(z1 - z0) < 1;
      box3(g, horiz ? L : 3, 92, horiz ? 3 : L, mx, 0, mz, 'glass', false);
      box3(g, horiz ? L + 4 : 5, 5, horiz ? 5 : L + 4, mx, 92, mz, 'steel', false);
    };
    rail(-hw, -hd, hw, -hd); rail(hw, -hd, hw, top); rail(-hw, -hd, -hw, top); rail(-hw, top, gx, top);
    return g;
  }
  const ground = new T.Mesh(new T.CircleGeometry(size * 3, 48), mat('ground'));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -1, cz); ground.receiveShadow = true; ground.userData.ground = true;
  scene.add(ground);

  // 設施範圍：地面淡淡顏色（同 2D 平面圖一樣），揀咗就加深。
  const fx = new T.Group(); scene.add(fx);
  const fxBy = {};
  facilities.forEach(f => {
    const color = new T.Color(f.color);
    let mesh;
    if (f.area) {
      mesh = new T.Mesh(new T.ShapeGeometry(shapeOf(f.area)), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthWrite: false, side: T.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.userData.lift = 1.2;
    } else {
      mesh = new T.Mesh(new T.RingGeometry(48, 66, 40), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(f.at.x, 0, f.at.y); mesh.userData.lift = 1.5;
    }
    mesh.userData.noPick = true; mesh.renderOrder = 2;
    fx.add(mesh); fxBy[f.id] = mesh;
  });
  function updateFx() {
    facilities.forEach(f => { const m = fxBy[f.id]; m.visible = onFloorF(f); m.position.y = baseOf(fFloor(f)) + m.userData.lift; });
  }

  // 每層兩個版本：矮牆（由上面睇）同完整牆身（漫遊）
  const roots = {};
  const rootOf = (id, full) => { const R = roots[id] || (roots[id] = {}), k = full ? 'full' : 'low'; return R[k] || (R[k] = buildRoot(floorObj(id), full ? WALL_H : LOW_H)); };
  const stairsMesh = SG ? buildStairs() : null;
  let wallsFull = false, current = null, shown = [];
  function showWalls(full) {
    const want = [rootOf(floor, full)];
    // 睇緊上層：下面嘅樓層用完整牆身，睇落似一棟樓
    floorList.filter(f => f.index < floorObj(floor).index).forEach(f => want.push(rootOf(f.id, true)));
    shown.forEach(r => { if (!want.includes(r)) r.visible = false; });
    want.forEach(r => { r.visible = true; });
    shown = want; current = want[0]; wallsFull = full;
  }

  /* ---------- 設施標記（HTML，字體清楚，手機易撳） ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  pinHost.innerHTML = '<svg class="pin-leaders" aria-hidden="true"></svg>' + facilities.map(f => `<button type="button" class="pin" data-fid="${esc(f.id)}" style="--c:${f.color}" aria-label="${esc(f.name)}"><span class="pin-i" aria-hidden="true">${esc(f.icon)}</span><span class="pin-t">${esc(f.name)}</span></button>`).join('');
  const leaders = pinHost.querySelector('.pin-leaders');
  const pins = facilities.map((f, i) => ({ f, i, el: pinHost.querySelector(`[data-fid="${CSS.escape(f.id)}"]`), fw: 0, fh: 0, cw: 0, last: '', line: '' }));
  pinHost.addEventListener('click', e => { const p = e.target.closest('[data-fid]'); if (p) onPick?.(p.dataset.fid); });
  function measurePins() {
    pins.forEach(p => {
      p.el.classList.remove('compact'); p.fw = p.el.offsetWidth; p.fh = p.el.offsetHeight;
      p.el.classList.add('compact'); p.cw = p.el.offsetWidth; p.el.classList.remove('compact');
    });
  }
  let hi = null;
  const v3 = new T.Vector3();
  function updatePins() {
    const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    const cam2 = { x: camera.position.x, y: camera.position.z }, walking = mode === 'walk';
    const list = pins.map(p => {
      v3.set(p.f.at.x, baseOf(fFloor(p.f)) + PIN_Y, p.f.at.y).project(camera);
      return { p, x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, z: v3.z, d: Math.hypot(p.f.at.x - cam2.x, p.f.at.y - cam2.y) };
    }).sort((a, c) => (c.p.f.id === hi) - (a.p.f.id === hi) || (walking ? a.d - c.d : a.p.i - c.p.i));
    let dirty = false;
    // 畫面上嘅掣（例如「返回全景」）當係障礙物，標記唔好擺喺佢哋下面。
    const cr = renderer.domElement.getBoundingClientRect();
    const placed = obstacles.filter(el => el.getClientRects().length && !el.closest('[hidden]')).map(el => { const r = el.getBoundingClientRect(); return [r.left - cr.left - 4, r.top - cr.top - 4, r.right - cr.left + 4, r.bottom - cr.top + 4]; });
    const overlaps = r => placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    list.forEach(({ p, x, y, z, d }) => {
      let show = onFloorF(p.f) && z < 1 && x > -40 && x < W + 40 && y > -20 && y < H + 60;
      let op = 1;
      if (show && walking) {
        if (d > 1100 || lineBlocked(cam2, p.f.at, colOf(floor))) show = false;
        else op = d > 750 ? Math.max(0.25, 1 - (d - 750) / 350) : 1;
      }
      if (mode === 'tour' && hi && p.f.id !== hi) op = Math.min(op, 0.5);
      // 疊埋就：先縮做淨圖示；再唔得就搬去最近嘅空位，用幼線連返真正位置，確保每個都撳得到。
      let compact = false, shifted = false;
      const x0 = x, y0 = y;
      if (show) {
        const rect = (cx, w, bottom) => [cx - w / 2 - 3, bottom - p.fh - 3, cx + w / 2 + 3, bottom + 3];
        let r = rect(x, p.fw, y);
        if (p.f.id !== hi && overlaps(r)) {
          compact = true;
          const cands = [rect(x, p.cw, y)];
          placed.forEach(q => {
            cands.push(rect(q[2] + p.cw / 2 + 4, p.cw, y), rect(q[0] - p.cw / 2 - 4, p.cw, y), rect(x, p.cw, q[1] - 4), rect(x, p.cw, q[3] + p.fh + 4));
          });
          const free = cands.filter(c => !overlaps(c) && c[0] >= 0 && c[2] <= W && c[1] >= 0 && c[3] <= H)
            .sort((a, c) => Math.hypot((a[0] + a[2]) / 2 - x, a[3] - y) - Math.hypot((c[0] + c[2]) / 2 - x, c[3] - y));
          r = free[0] || cands[0];
          const nx = (r[0] + r[2]) / 2, ny = r[3] - 3;
          shifted = Math.hypot(nx - x, ny - y) > 2; x = nx; y = ny;
        }
        placed.push(r);
      }
      const line = show && shifted ? `<line x1="${Math.round(x0)}" y1="${Math.round(y0)}" x2="${Math.round(x)}" y2="${Math.round(y - p.fh / 2)}" style="stroke:${p.f.color}"/><circle cx="${Math.round(x0)}" cy="${Math.round(y0)}" r="5" style="fill:${p.f.color}"/>` : '';
      if (line !== p.line) { p.line = line; dirty = true; }
      const key = show ? `${Math.round(x)},${Math.round(y)},${compact},${shifted},${op.toFixed(2)},${p.f.id === hi}` : 'hide';
      if (key === p.last) return;
      p.last = key;
      p.el.hidden = !show;
      if (!show) return;
      p.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      p.el.style.opacity = op;
      p.el.classList.toggle('compact', compact);
      p.el.classList.toggle('shifted', shifted);
      p.el.classList.toggle('is-on', p.f.id === hi);
      p.el.style.zIndex = p.f.id === hi ? 5 : 1;
    });
    if (dirty) leaders.innerHTML = pins.map(p => p.line).join('');
  }
  function highlight(fid) {
    hi = fid || null;
    facilities.forEach(f => {
      const m = fxBy[f.id];
      m.material.opacity = f.area ? (f.id === hi ? 0.42 : 0.14) : (f.id === hi ? 0.9 : 0);
      m.scale.set(1, 1, 1);
    });
    pins.forEach(p => { p.last = ''; });
  }

  /* ---------- 撳 3D 模型揀設施 ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let tap = null;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', e => { if (e.isPrimary) tap = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  dom.addEventListener('pointerup', e => {
    const t0 = tap; tap = null;
    if (!t0 || !e.isPrimary || Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 8 || performance.now() - t0.t > 700) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [current].concat(stairsMesh ? [stairsMesh] : [], floorObj(floor).index === 0 ? [ground] : []);
    for (const h of ray.intersectObjects(targets, true)) {
      let skip = false;
      for (let q = h.object; q; q = q.parent) if (q.userData?.noPick) { skip = true; break; }
      if (skip || h.object.material === M.glass || !h.object.visible) continue;
      const f = facilityAt(facilitiesOn(facilities, floor), { x: h.point.x, y: h.point.z });
      onPick?.(f ? f.id : null);
      return;
    }
    onPick?.(null);
  });

  /* ---------- 鏡頭 ---------- */
  // inset：畫面下面俾導覽字卡遮住嘅高度。將鏡頭中心向上移一半，設施就唔會俾字卡遮住。
  let inset = 0;
  function applyOffset() {
    const w = canvasHost.clientWidth || 1, h = canvasHost.clientHeight || 1, s = Math.min(inset, h * 0.6) / 2;
    if (s > 0) { camera.aspect = w / (h + 2 * s); camera.setViewOffset(w, h + 2 * s, 0, 2 * s, w, h); }
    else { camera.aspect = w / h; camera.clearViewOffset(); }
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = canvasHost.clientWidth || 1, h = canvasHost.clientHeight || 1;
    renderer.setSize(w, h, false); applyOffset();
    measurePins(); pins.forEach(p => { p.last = ''; });
  }
  new ResizeObserver(resize).observe(canvasHost);
  resize();

  // 自動取景：搵一個距離，令 pts 啱啱好擺入畫面 lim 範圍（NDC，-1 至 1），再將佢哋擺返正中。
  const V = (x, y, z) => new T.Vector3(x, y, z);
  function fitPose(pts, aim, dir, lim) {
    const cam = camera.clone(), tgt = aim.clone(), v = new T.Vector3();
    const ndcBox = d => {
      cam.position.copy(tgt).addScaledVector(dir, d); cam.lookAt(tgt); cam.updateMatrixWorld();
      const bx = [Infinity, -Infinity, Infinity, -Infinity];
      for (const p of pts) { v.copy(p).project(cam); if (v.z > 1 || v.z < -1) return null; bx[0] = Math.min(bx[0], v.x); bx[1] = Math.max(bx[1], v.x); bx[2] = Math.min(bx[2], v.y); bx[3] = Math.max(bx[3], v.y); }
      return bx;
    };
    const fits = bx => bx && bx[0] >= -lim.x && bx[1] <= lim.x && bx[2] >= lim.bottom && bx[3] <= lim.top;
    const search = () => { let lo = 150, hiD = 40000; for (let i = 0; i < 26; i++) { const d = (lo + hiD) / 2; if (fits(ndcBox(d))) hiD = d; else lo = d; } return hiD; };
    let d = search();
    const vf = cam.view ? cam.view.height / cam.view.fullHeight : 1, hf = cam.view ? cam.view.width / cam.view.fullHeight : cam.aspect;
    for (let k = 0; k < 3; k++) {
      const bx = ndcBox(d); if (!bx) break;
      const t = d * Math.tan(rad(cam.fov) / 2);
      const mx = (bx[0] + bx[1]) / 2, my = (bx[2] + bx[3]) / 2 - (lim.top + lim.bottom) / 2;
      const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      tgt.addScaledVector(right, mx * t * hf).addScaledVector(up, my * t * vf);
      d = search();
    }
    return { pos: tgt.clone().addScaledVector(dir, d), tgt };
  }
  const dirOf = (hx, hy, el) => { const L = Math.hypot(hx, hy) || 1; return V(hx / L * Math.cos(el), Math.sin(el), hy / L * Math.cos(el)); };
  // 全景：由南面斜上望，成個平面圖擺得入畫面（上面留位俾標記）。
  function overviewPose() {
    const pts = [], y0 = baseOf(floor);
    plans[floor].rooms.forEach(r => r.pts.forEach(p => { pts.push(V(p.x, y0, p.y), V(p.x, y0 + LOW_H, p.y)); }));
    return fitPose(pts, V(cx, y0, cz), dirOf(Math.sin(rad(-12)), Math.cos(rad(-12)), rad(58)), { x: 0.9, top: 0.72, bottom: -0.9 });
  }
  // 導覽每一站：由大廳中間望向設施（或者按 center.json 嘅 view），包住設施範圍同標記，唔俾字卡遮住。
  function viewPose(f) {
    const plan = plans[fFloor(f)], y0 = baseOf(fFloor(f));
    let hx, hy, el = rad(50);
    if (f.view.from) {
      hx = f.view.from.x - f.at.x; hy = f.view.from.y - f.at.y;
      if (f.view.height) el = Math.atan2(f.view.height, Math.hypot(hx, hy) || 1);
    } else {
      hx = plan0.center.x - f.at.x; hy = plan0.center.y - f.at.y;
      if (Math.hypot(hx, hy) < 80) { hx = 0; hy = 1; }
      if (f.view.height && f.view.dist) el = Math.atan2(f.view.height, f.view.dist);
    }
    // 包住：設施範圍＋周圍最少 3 米（睇到環境）＋設施標記。
    const pts = [];
    if (f.area) f.area.forEach(p => { pts.push(V(p.x, y0, p.y), V(p.x, y0 + LOW_H, p.y)); });
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, q = { x: f.at.x + Math.cos(a) * 300, y: f.at.y + Math.sin(a) * 300 };
      if (insideBuilding(plan, q)) pts.push(V(q.x, y0, q.y)); // 只包大廈入面，唔好拍一大片外面
    }
    pts.push(V(f.at.x, y0 + PIN_Y + 30, f.at.y));
    const Hh = canvasHost.clientHeight || 1, bottom = Math.min(0.1, -1 + 2 * (inset / Hh) + 0.12);
    const aim = f.area ? V(f.area.reduce((s, p) => s + p.x, 0) / f.area.length, y0, f.area.reduce((s, p) => s + p.y, 0) / f.area.length) : V(f.at.x, y0, f.at.y);
    return fitPose(pts, aim, dirOf(hx, hy, el), { x: 0.86, top: 0.8, bottom });
  }
  let anim = null;
  function flyTo(pose, dur, onDone) {
    const p0 = camera.position.clone(), q0 = controls.target.clone();
    const far = p0.distanceTo(pose.pos);
    if (reduceMotion()) dur = Math.min(dur, 0.5);
    anim = { p0, q0, p1: pose.pos, q1: pose.tgt, dur: Math.max(0.2, dur), el: 0, lift: reduceMotion() ? 0 : Math.min(220, far * 0.12), onDone };
  }
  const flyDur = pose => Math.min(3, Math.max(1.3, camera.position.distanceTo(pose.pos) / 900));
  const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  /* ---------- 模式：overview（睇全貌）、tour（自動導覽）、walk（漫遊） ---------- */
  let mode = 'overview', savedOverview = null, lowPref = true;
  function setMode(m) {
    if (m === mode) return;
    const prev = mode;
    if (prev === 'walk') { W.k = {}; W.pad = {}; W.look = null; camera.rotation.order = 'XYZ'; camera.fov = 45; camera.updateProjectionMatrix(); minimap.toggleAttribute('hidden', true); }
    if (prev === 'tour') { tour.active = false; anim = null; }
    if (prev === 'overview') savedOverview = { pos: camera.position.clone(), tgt: controls.target.clone(), floor };
    mode = m;
    if (m === 'overview') {
      showWalls(!lowPref);
      if (prev === 'walk') { const s = savedOverview && savedOverview.floor === floor ? savedOverview : overviewPose(); camera.position.copy(s.pos); controls.target.copy(s.tgt); }
      controls.enabled = true; controls.update(); highlight(hi);
    } else if (m === 'tour') {
      showWalls(false); controls.enabled = false;
    } else if (m === 'walk') {
      showWalls(true); controls.enabled = false; anim = null;
      camera.fov = 70; camera.updateProjectionMatrix(); camera.rotation.order = 'YXZ';
      if (!W.started) walkHome(); else placeCam();
      buildMini(); minimap.toggleAttribute('hidden', false);
    }
    pins.forEach(p => { p.last = ''; });
    onMode?.(m);
  }

  /* ---------- 自動導覽 ---------- */
  const tour = { active: false, idx: 0, phase: 'idle', paused: false, dwell: 0 };
  function tourState() {
    const f = facilities[tour.idx];
    return { active: tour.active, idx: tour.idx, total: facilities.length, fid: f?.id, floor: f ? fFloor(f) : floor, phase: tour.phase, paused: tour.paused, progress: tour.phase === 'dwell' ? Math.min(1, tour.dwell / dwellSeconds(f)) : tour.phase === 'done' ? 1 : 0 };
  }
  const emitTour = () => onTour?.(tourState());
  function tourGo(i) {
    tour.idx = Math.max(0, Math.min(facilities.length - 1, i));
    tour.phase = 'fly'; tour.dwell = 0; tour.paused = false; controls.enabled = false;
    const f = facilities[tour.idx];
    if (f.floor !== 'all' && f.floor !== floor) setFloor(f.floor, { fly: false }); // 轉層，鏡頭會飛上／落去
    highlight(f.id);
    emitTour(); // 先更新字卡（高度會變），再計鏡頭位置
    const pose = viewPose(f);
    flyTo(pose, flyDur(pose), () => { tour.phase = 'dwell'; emitTour(); });
  }
  const tourApi = {
    start() { setMode('tour'); tour.active = true; tourGo(0); },
    next() { if (!tour.active) return; if (tour.idx >= facilities.length - 1) { tour.phase = 'done'; tour.paused = false; anim = null; emitTour(); } else tourGo(tour.idx + 1); },
    prev() { if (tour.active) tourGo(tour.phase === 'done' ? facilities.length - 1 : tour.idx - 1); },
    pause() { if (!tour.active || tour.phase === 'done') return; tour.paused = true; controls.enabled = true; emitTour(); },
    resume() {
      if (!tour.active || !tour.paused) return;
      tour.paused = false; controls.enabled = false;
      const pose = viewPose(facilities[tour.idx]);
      if (tour.phase === 'fly') { tourGo(tour.idx); return; }
      if (camera.position.distanceTo(pose.pos) > 5 || controls.target.distanceTo(pose.tgt) > 5) flyTo(pose, 0.9);
      emitTour();
    },
    stop() { setMode('overview'); emitTour(); },
    state: tourState,
  };

  /* ---------- 第一身漫遊（同辦公室工具一樣：WASD、方向鍵、拖動望四周、手機掣） ---------- */
  const W = { x: 0, y: 0, yaw: 0, pitch: 0, k: {}, pad: {}, run: false, look: null, started: false, home: null, mm: null, lastEmit: 0 };
  function homePose() {
    let p = start.at, l = start.lookAt;
    if (!p) { const f0 = facilities[0]; p = f0 ? f0.at : { x: cx, y: cz }; }
    if (!l) l = plan0.center;
    const q = resolveWalk({ x: p.x, y: p.y }, colOf(floorList[0].id));
    return { x: q.x, y: q.y, yaw: Math.atan2(-(l.x - q.x), -(l.y - q.y)) };
  }
  function placeCam() {
    camera.position.set(W.x, baseOf(floor) + EYE_H, W.y); camera.rotation.set(W.pitch, W.yaw, 0);
    drawMini();
    const now = performance.now();
    if (now - W.lastEmit > 120) { W.lastEmit = now; onWalk?.({ x: W.x, y: W.y, yaw: W.yaw, floor }); }
  }
  function walkHome() {
    if (floor !== floorList[0].id) setFloor(floorList[0].id, { fly: false });
    W.home = W.home || homePose(); Object.assign(W, { x: W.home.x, y: W.home.y, yaw: W.home.yaw, pitch: 0, started: true }); placeCam();
  }
  function walkTo(x, y) { const p = resolveWalk({ x, y }, colOf(floor)); W.x = p.x; W.y = p.y; placeCam(); }
  // 行入樓梯口：轉層，企喺樓梯另一頭（面向樓梯外面）
  function checkStairs() {
    if (!SG) return;
    const which = floor === SG.lower.floor && SG.inTrigger(W, 'lower') ? 'upper' : floor === SG.upper.floor && SG.inTrigger(W, 'upper') ? 'lower' : null;
    if (!which) return;
    const to = SG[which];
    setFloor(to.floor, { fly: false });
    Object.assign(W, { x: to.arrive.x, y: to.arrive.y, yaw: to.arrive.yaw, pitch: 0 });
    placeCam();
    onStairs?.(to.floor, floorObj(to.floor).name);
  }
  function walkUpdate(dt) {
    const k = W.k, pd = W.pad;
    const f = (k.f || pd.f ? 1 : 0) - (k.b || pd.b ? 1 : 0), st = (k.r || pd.r ? 1 : 0) - (k.l || pd.l ? 1 : 0), tr = (k.tr || pd.tr ? 1 : 0) - (k.tl || pd.tl ? 1 : 0);
    if (!tr && !f && !st) return;
    if (tr) W.yaw -= tr * 1.6 * dt;
    if (f || st) {
      const n2 = Math.hypot(f, st) || 1, sp = 130 * (W.run ? 2 : 1) * dt, sy = Math.sin(W.yaw), cy = Math.cos(W.yaw);
      const to = { x: W.x + ((-sy * f + cy * st) / n2) * sp, y: W.y + ((-cy * f - sy * st) / n2) * sp };
      const p = stepWalk({ x: W.x, y: W.y }, to, colOf(floor));
      W.x = p.x; W.y = p.y;
      checkStairs();
    }
    placeCam();
  }
  const WALK_KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', d: 'r', arrowleft: 'tl', q: 'tl', arrowright: 'tr', e: 'tr' };
  function walkKey(e, down) {
    if (mode !== 'walk' || e.target.closest?.('input, textarea, select')) return;
    const key = e.key.toLowerCase();
    if (key === 'shift') { W.run = down; return; }
    if (down && key === 'escape') { onExitWalk?.(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m = WALK_KEYS[key]; if (!m) return;
    e.preventDefault(); W.k[m] = down;
  }
  window.addEventListener('keydown', e => walkKey(e, true));
  window.addEventListener('keyup', e => walkKey(e, false));
  window.addEventListener('blur', () => { W.k = {}; W.pad = {}; W.run = false; });
  dom.addEventListener('pointerdown', e => {
    if (mode !== 'walk' || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    W.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { dom.setPointerCapture(e.pointerId); } catch (err) { /* 冇所謂 */ }
  });
  dom.addEventListener('pointermove', e => {
    const l = W.look; if (mode !== 'walk' || !l || e.pointerId !== l.id) return;
    W.yaw -= (e.clientX - l.x) * 0.005; W.pitch = Math.max(-1.1, Math.min(1.1, W.pitch - (e.clientY - l.y) * 0.005));
    l.x = e.clientX; l.y = e.clientY; placeCam();
  });
  ['pointerup', 'pointercancel'].forEach(t => dom.addEventListener(t, e => { if (W.look && e.pointerId === W.look.id) W.look = null; }));

  // 小地圖：撳一下可以傳送。
  const r2 = n => Math.round(n * 10) / 10;
  function buildMini() {
    const plan = plans[floor];
    const MW = 132, pad = 6, bw = MW - pad * 2, sc = bw / Math.max(b.w, b.h);
    W.mm = { sc, ox: pad + (bw - b.w * sc) / 2 - b.x * sc, oy: pad - b.y * sc, h: Math.round(b.h * sc + pad * 2), w: MW };
    const X = x => r2(x * sc + W.mm.ox), Y = y => r2(y * sc + W.mm.oy);
    minimap.setAttribute('viewBox', `0 0 ${MW} ${W.mm.h}`);
    minimap.style.width = MW + 'px'; minimap.style.height = W.mm.h + 'px';
    let h = '';
    plan.rooms.forEach(r => { h += `<polygon class="mm-room" points="${r.pts.map(q => X(q.x) + ',' + Y(q.y)).join(' ')}"/>`; });
    plan.items.forEach(it => { if (['door', 'door2', 'window'].includes(it.type)) return; h += `<polygon class="mm-item" points="${corners(it).map(q => X(q.x) + ',' + Y(q.y)).join(' ')}"/>`; });
    plan.walls.forEach(w => { h += `<line class="${w.glass ? 'mm-glass' : 'mm-wall'}" x1="${X(w.a.x)}" y1="${Y(w.a.y)}" x2="${X(w.b.x)}" y2="${Y(w.b.y)}"/>`; });
    if (SG) h += `<polygon class="mm-stairs" points="${SG.footprint.map(q => X(q.x) + ',' + Y(q.y)).join(' ')}"/>`;
    facilitiesOn(facilities, floor).forEach(f => { if (!f.stairs) h += `<circle class="mm-f" cx="${X(f.at.x)}" cy="${Y(f.at.y)}" r="3.2" style="fill:${f.color}"/>`; });
    h += '<g class="mm-me"><path d="M0 -8 L5 5 L0 2 L-5 5 Z"/></g>';
    minimap.innerHTML = h; drawMini();
  }
  function drawMini() {
    const g = minimap.querySelector('.mm-me'); if (!g || !W.mm) return;
    g.setAttribute('transform', `translate(${r2(W.x * W.mm.sc + W.mm.ox)} ${r2(W.y * W.mm.sc + W.mm.oy)}) rotate(${r2(-W.yaw * 180 / Math.PI)})`);
  }
  minimap.addEventListener('pointerdown', e => {
    if (mode !== 'walk' || !W.mm) return;
    e.preventDefault();
    const r = minimap.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W.mm.w, vy = (e.clientY - r.top) / r.height * W.mm.h;
    walkTo((vx - W.mm.ox) / W.mm.sc, (vy - W.mm.oy) / W.mm.sc);
  });

  /* ---------- 主迴圈 ---------- */
  let running = false, last = 0, clock = 0;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t; clock += dt;
    if (anim && !(mode === 'tour' && tour.paused)) {
      anim.el += dt;
      const k = Math.min(1, anim.el / anim.dur), e = ease(k);
      camera.position.lerpVectors(anim.p0, anim.p1, e); camera.position.y += anim.lift * Math.sin(Math.PI * k);
      controls.target.lerpVectors(anim.q0, anim.q1, e); camera.lookAt(controls.target);
      if (k >= 1) { const done = anim.onDone; anim = null; if (mode === 'overview') controls.enabled = true; done?.(); }
    } else if (controls.enabled) controls.update();
    if (mode === 'tour' && tour.active && !tour.paused && tour.phase === 'dwell') {
      tour.dwell += dt;
      if (tour.dwell >= dwellSeconds(facilities[tour.idx])) tourApi.next(); else emitTour();
    }
    if (mode === 'walk') walkUpdate(dt);
    if (hi && fById[hi] && !fById[hi].area && !reduceMotion()) { const s = 1 + 0.08 * Math.sin(clock * 4); fxBy[hi].scale.set(s, s, 1); }
    shown.forEach(r => { if (r.userData.ceiling) r.userData.ceiling.visible = camera.position.y < r.position.y + WALL_H - 5; });
    renderer.render(scene, camera);
    updatePins();
    requestAnimationFrame(frame);
  }
  function setActive(on) {
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); resize(); requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { running = false; setActive.resumeOnShow = true; } else if (!document.hidden && setActive.resumeOnShow) { setActive.resumeOnShow = false; setActive(true); } });

  // 轉層：overview 時顯示成層嘅全景（一定見晒嗰層設施）；導覽同漫遊自己處理鏡頭。
  function setFloor(id, opts = {}) {
    if (!floorList.some(f => f.id === id) || id === floor) return;
    floor = id;
    showWalls(mode === 'walk' ? true : mode === 'overview' ? !lowPref : false);
    updateFx();
    if (mode === 'overview') {
      const pose = overviewPose();
      if (opts.fly !== false) { controls.enabled = false; flyTo(pose, 1); }
      else { anim = null; camera.position.copy(pose.pos); controls.target.copy(pose.tgt); controls.update(); }
    }
    if (mode === 'walk') buildMini();
    pins.forEach(p => { p.last = ''; });
    onFloor?.(id);
  }

  // 開始：地下，矮牆全貌。
  showWalls(false);
  updateFx();
  const p0 = overviewPose(); camera.position.copy(p0.pos); controls.target.copy(p0.tgt); controls.update();
  highlight(null);

  return {
    setActive, setMode, get mode() { return mode; }, tour: tourApi, highlight,
    setFloor, get floor() { return floor; }, floors: floorList,
    focus(fid) {
      const f = fById[fid]; if (!f) return;
      if (mode !== 'overview') setMode('overview');
      if (f.floor !== 'all' && f.floor !== floor) setFloor(f.floor, { fly: false });
      highlight(fid);
      const pose = viewPose(f); controls.enabled = false; flyTo(pose, flyDur(pose));
    },
    resetView() { if (mode !== 'overview') setMode('overview'); const p = overviewPose(); controls.enabled = false; flyTo(p, 1.2); },
    setInset(px) {
      if (Math.abs(px - inset) < 1) return;
      inset = px; applyOffset(); pins.forEach(p => { p.last = ''; });
      if (mode === 'tour' && tour.active && tour.phase === 'dwell' && !tour.paused) flyTo(viewPose(facilities[tour.idx]), 0.5);
    },
    setFullWalls(full) { lowPref = !full; if (mode === 'overview') showWalls(full); },
    get fullWalls() { return wallsFull; },
    walkPad(key, down) { W.pad[key] = down; },
    walkHome() { if (mode === 'walk') walkHome(); },
    walkState: () => ({ x: W.x, y: W.y, yaw: W.yaw, pitch: W.pitch, floor }),
    walkTo,
    // 測試用：即刻畫一格，等測試可以讀到畫面。
    renderNow() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    setYaw(y) { W.yaw = y; W.pitch = 0; placeCam(); },
    // 測試用：平面圖一點（cm）喺畫面上嘅位置（px，相對 3D 畫面）。
    screenOf(x, y, h = 0) { const v = new T.Vector3(x, baseOf(floor) + h, y).project(camera), c = renderer.domElement; return { x: (v.x + 1) / 2 * c.clientWidth, y: (1 - v.y) / 2 * c.clientHeight }; },
    cameraState: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    pinState: () => pins.map(p => ({ id: p.f.id, hidden: p.el.hidden, compact: p.el.classList.contains('compact') })),
    get collision() { return colOf(floor); },
  };
}
