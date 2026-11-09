#!/usr/bin/env node
// 產生網頁嘅 QR code（PNG 同 SVG），放喺 assets/。
// 用法：npm install && node tools/make-qr.mjs [網址]
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const url = process.argv[2] || 'https://mm7-lab.github.io/community-living-room/';
const out = join(fileURLToPath(new URL('..', import.meta.url)), 'assets');
mkdirSync(out, { recursive: true });
// 糾錯 Q 級：印出嚟有少少污糟或者反光都仲掃到。深啡色對白底，對比夠高。
const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#2B1A10', light: '#FFFFFF' } };
await QRCode.toFile(join(out, 'qr-code.png'), url, { ...opts, width: 1200 });
await QRCode.toFile(join(out, 'qr-code.svg'), url, { ...opts, type: 'svg' });
console.log(`已產生 assets/qr-code.png 同 assets/qr-code.svg → ${url}`);
