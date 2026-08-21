/* テスト共通のお膳立て。
   実機と同じ条件（iPhone相当のビューポート・タッチ・位置情報）でアプリを開き、
   地図タイルはネットに出ずにダミーを返す。 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = path.join(ROOT, 'test', 'fixtures');

const MIME = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
              '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json'};

/** dev/ を配信する使い捨てサーバ */
export async function serve(dir = path.join(ROOT, 'dev')) {
  const srv = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => srv.listen(0, r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}

const TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
<rect width="256" height="256" fill="#f5f3ee"/>
<g stroke="#fff" stroke-width="9" fill="none"><path d="M0 43H256M0 107H256M0 171H256M0 235H256M43 0V256M107 0V256M171 0V256M235 0V256"/></g>
<g fill="#e7e2d7"><rect x="8" y="8" width="27" height="27"/><rect x="72" y="8" width="27" height="27"/>
<rect x="136" y="72" width="27" height="27"/><rect x="8" y="136" width="27" height="27"/>
<rect x="200" y="136" width="27" height="27"/><rect x="72" y="200" width="27" height="27"/></g></svg>`;

/** quiet=true（既定）のとき、起動時の「Safariのタブ」注意を出さない。
    この注意そのものを見たいテストだけ quiet:false にする。 */
export async function open({geolocation = {latitude:35.6812, longitude:139.7671, accuracy:8},
                            viewport = {width:390, height:844}, initScript, quiet = true,
                            sw = false} = {}) {
  const server = await serve();
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP',
    permissions: ['geolocation'], geolocation,
    serviceWorkers: sw ? 'allow' : 'block',
  });
  await ctx.route(/cyberjapandata|tile\.openstreetmap/, r =>
    r.fulfill({status:200, contentType:'image/svg+xml', body:TILE}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_|Failed to load/.test(m.text()))
                              errors.push('CONSOLE: ' + m.text()); });
  if (quiet) await page.addInitScript(() => {
    const K='postingmap.pref.v1';
    const p = (()=>{ try { return JSON.parse(localStorage.getItem(K)) || {}; } catch(e){ return {}; } })();
    p.tabWarned = true;
    localStorage.setItem(K, JSON.stringify(p));
  });
  if (initScript) await page.addInitScript(initScript);
  await page.goto(server.url + '/index.html', {waitUntil: 'networkidle'});
  await page.waitForTimeout(900);
  const cdp = await ctx.newCDPSession(page);
  return {
    browser, ctx, page, cdp, errors,
    close: async () => { await browser.close(); server.close(); },
    stroke: async (pts) => {
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:pts[0][0], y:pts[0][1], id:1}]});
      for (const [x,y] of pts.slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x,y,id:1}]});
        await page.waitForTimeout(12);
      }
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await page.waitForTimeout(200);
    },
    fakeClock: () => page.evaluate(() => {
      window.__t = Date.now(); Date.now = () => window.__t;
      window.__advance = ms => { window.__t += ms; };
    }),
    advance: (ms) => page.evaluate(m => window.__advance(m), ms),
  };
}

export const line = (x1,y1,x2,y2,n=12) =>
  Array.from({length:n+1}, (_,i) => [x1+(x2-x1)*i/n, y1+(y2-y1)*i/n]);

/* ---- ごく小さなアサーション ---- */
let failures = [];
export function check(name, cond, detail='') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  NG   ${name}  ${detail}`); failures.push(name); }
}
export function eq(name, actual, expected) {
  check(name, JSON.stringify(actual)===JSON.stringify(expected),
        `期待=${JSON.stringify(expected)} 実際=${JSON.stringify(actual)}`);
}
export function near(name, actual, expected, tol) {
  check(name, Math.abs(actual-expected)<=tol, `期待=${expected}±${tol} 実際=${actual}`);
}
export function done(errors=[]) {
  errors.forEach(e => { console.log('  NG   ' + e); failures.push(e); });
  if (failures.length) { console.log(`\n${failures.length} 件失敗`); process.exit(1); }
  console.log('  すべて合格');
}
