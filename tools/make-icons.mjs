/* app-icon.svg 相当の図を描いて、必要な大きさの PNG を書き出す。
     node tools/make-icons.mjs
   出力はリポジトリ直下（index.html と同じ場所）。 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

/* 配布マップ アイコン
   紺（道着の色）の街区の上を白い道が通り、オレンジの現在地。
   その上にチラシ（オレンジの見出し＋本文）。 */
function svg({scale=1, bg=true}={}){
  const inner = `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <!-- 街区 -->
    <path d="M0 180H1024 M0 430H1024 M0 700H1024 M0 905H1024 M140 0V1024 M420 0V1024 M700 0V1024 M910 0V1024"
          stroke="#ffffff" stroke-opacity="0.075" stroke-width="15" fill="none"/>
    <!-- 歩いた道 -->
    <path d="M215 835 V690 H470 V520" fill="none" stroke="#ffffff" stroke-width="80"
          stroke-linecap="round" stroke-linejoin="round"/>
    <!-- 現在地 -->
    <circle cx="215" cy="835" r="92" fill="#ff6a1f"/>
    <circle cx="215" cy="835" r="34" fill="#16203a"/>
    <!-- チラシ -->
    <g transform="rotate(-10 620 400)" filter="url(#sh)">
      <rect x="424" y="170" width="418" height="486" rx="38" fill="#ffffff"/>
      <rect x="488" y="248" width="290" height="68" rx="34" fill="#ff6a1f"/>
      <rect x="488" y="382" width="290" height="44" rx="22" fill="#b9c3d4"/>
      <rect x="488" y="474" width="212" height="44" rx="22" fill="#b9c3d4"/>
    </g>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16203a"/><stop offset="1" stop-color="#28375f"/>
    </linearGradient>
    <filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="26" flood-color="#000814" flood-opacity="0.42"/>
    </filter>
  </defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}
  ${inner}
</svg>`;
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
const page = await browser.newPage({viewport:{width:1024,height:1024}});

async function render(markup, out, size){
  await page.setViewportSize({width:size, height:size});
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px">
    <div style="width:${size}px;height:${size}px">${markup.replace('width="1024" height="1024"',`width="${size}" height="${size}"`)}</div></body>`);
  await page.waitForTimeout(90);
  await page.screenshot({path:out});
}

const main = svg();
const mask = svg({scale:0.76});          // Android maskable: 安全域の内側に収める
fs.writeFileSync("app-icon.svg", main);

for(const s of [512, 192, 180, 32]) await render(main, `icon-${s}.png`, s);
await render(mask, "icon-maskable-512.png", 512);

// プレビュー
const sizes=[180,120,76,56,40];
const one = (src)=>sizes.map(sz=>`<div class="ic" style="width:${sz}px;height:${sz}px"><img src="${src}"></div>`).join("");
fs.mkdirSync("test/out",{recursive:true});
fs.writeFileSync("test/out/preview.html",`<html><body style="margin:0;font-family:system-ui">
<div class="band" style="background:#dfe1e8">${one('../../icon-512.png')}</div>
<div class="band" style="background:#0f1116">${one('../../icon-512.png')}</div>
<div class="band" style="background:linear-gradient(120deg,#6b8cae,#c3a3c9)">${one('../../icon-512.png')}</div>
<div class="band" style="background:#dfe1e8"><div class="ic sq" style="width:180px;height:180px"><img src="../../icon-maskable-512.png"></div>
<div style="font:12px system-ui;align-self:center;margin-left:10px">← maskable（Android用・安全域）</div></div>
<style>.band{display:flex;gap:20px;padding:22px;align-items:center}
.ic{border-radius:23%;overflow:hidden;box-shadow:0 3px 12px #0005}.ic.sq{border-radius:50%}
.ic img{width:100%;height:100%;display:block}</style></body></html>`);
await page.setViewportSize({width:640,height:760});
await page.goto("file://"+ROOT+"/test/out/preview.html"); await page.waitForTimeout(400);
await page.screenshot({path:"test/out/icon-preview.png", fullPage:true});
await browser.close();
console.log(fs.readdirSync(".").filter(f=>f.startsWith("icon-")&&f.endsWith(".png")).join(" "));
