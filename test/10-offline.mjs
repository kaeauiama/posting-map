/* オフライン：地図タイルのまとめ保存と、電波が無いときの起動 */
import { open, check, eq, done } from './lib.mjs';
console.log('10 オフライン');

/* ---- 前半：タイルの保存（Service Worker は使わない部分） ---- */
const t = await open();
const { page, ctx } = t;

await page.evaluate(()=>{
  pref.home = [35.6812, 139.7671]; pref.radius = 500; pref.base = 'pale';
  savePref(); saveDB();          // 記録が消えないことを後で見るので、先に1件書いておく
  syncHome();
  document.getElementById('baseSel').value = 'pale';
});

const plan = await page.evaluate(()=> {
  const p = tilePlan();
  const zs = {};
  p.urls.forEach(u => { const a = u.split('/'); zs[a[a.length-3]] = (zs[a[a.length-3]]||0)+1; });
  return {n: p.urls.length, mb: p.mb, zs, sample: p.urls[0]};
});
check('z14〜18をまとめて数える', Object.keys(plan.zs).sort().join(',') === '14,15,16,17,18',
      JSON.stringify(plan.zs));
check('拡大するほど枚数が増える', plan.zs['18'] > plan.zs['17'] && plan.zs['17'] > plan.zs['16']);
check('半径500mなら数百枚に収まる', plan.n > 30 && plan.n < 600, `${plan.n}枚`);
check('見積りのMBが桁として妥当', plan.mb > 0.5 && plan.mb < 60, `${plan.mb.toFixed(1)}MB`);
check('国土地理院のURLを組み立てている', plan.sample.includes('cyberjapandata.gsi.go.jp'));

// 実際に保存する（タイルはダミーに差し替わっている）
await page.evaluate(()=>{ window.confirm = ()=> true; });
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(400);
await page.click('#tileSave');
await page.waitForFunction(()=> !saving && document.getElementById('tileState')
                                 .textContent.indexOf('保存中') < 0, null, {timeout: 120000});
const saved = await page.evaluate(async ()=>{
  const keys = await (await caches.open('postingmap-tiles-v1')).keys();
  return {n: keys.length, label: document.getElementById('tileState').textContent};
});
eq('計画した枚数がそのまま保存される', saved.n, plan.n);
check('保存した量が画面に出る', saved.label.includes('枚') && saved.label.includes('MB'), saved.label);

// OpenStreetMap を選ぶと、まとめ保存はできない
await page.selectOption('#baseSel', 'osm'); await page.waitForTimeout(400);
check('OSMでは保存ボタンが押せない', await page.evaluate(()=> document.getElementById('tileSave').disabled));
await page.selectOption('#baseSel', 'pale'); await page.waitForTimeout(400);
check('地理院に戻せば押せる', await page.evaluate(()=> !document.getElementById('tileSave').disabled));

// 削除
await page.click('#tileClear'); await page.waitForTimeout(600);
const after = await page.evaluate(async ()=>{
  const has = await caches.has('postingmap-tiles-v1');
  const keys = has ? await (await caches.open('postingmap-tiles-v1')).keys() : [];
  return {n: keys.length, label: document.getElementById('tileState').textContent};
});
eq('削除すると空になる', after.n, 0);
check('削除後の表示が「未保存」に戻る', after.label.includes('未保存'), after.label);

// 記録は道連れにしない
check('保存を消しても配布の記録は残る',
      await page.evaluate(()=> !!localStorage.getItem('postingmap.v1')));
const errs = t.errors.slice();
await t.close();

/* ---- 後半：Service Worker が居るときの、電波が無い状態での起動 ---- */
const u = await open({sw:true});
await u.page.waitForFunction(()=> navigator.serviceWorker.controller !== null, null, {timeout:20000})
  .then(()=> check('Service Worker がページを受け持つ', true))
  .catch(()=> check('Service Worker がページを受け持つ', false));

// 1度読み直して、必要なものをキャッシュに入れさせる
await u.page.reload({waitUntil:'networkidle'}); await u.page.waitForTimeout(800);
check('オフラインでの起動が「有効」と出る',
      (await u.page.textContent('#swState')).includes('有効'));

await u.ctx.setOffline(true);
await u.page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
await u.page.waitForTimeout(1500);
const alive = await u.page.evaluate(()=> ({
  boot: typeof window.saveDB === 'function',
  btn:  !!document.getElementById('startBtn'),
  map:  !!document.querySelector('.leaflet-container'),
}));
check('電波が無くてもアプリが起動する', alive.boot && alive.btn, JSON.stringify(alive));
check('地図の枠も出る', alive.map);
await u.ctx.setOffline(false);

done(errs.concat(u.errors)); await u.close();
