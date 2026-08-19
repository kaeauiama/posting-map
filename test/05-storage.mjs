/* データの安全：永続化の要求と表示／バックアップの記録と催促／壊れたデータの退避 */
import { open, check, eq, done } from './lib.mjs';
console.log('05 データの保存');
const t = await open({quiet:false});   // タブ警告そのものを確認するため
const { page } = t;

await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(800);
const ui = await page.evaluate(()=>({
  state: document.getElementById('stPersist').textContent,
  backup: document.getElementById('stBackup').textContent,
  usage: document.getElementById('stUsage').textContent,
  tabWarn: getComputedStyle(document.getElementById('stTab')).display !== 'none'}));
check('永続化の状態を表示する', /保存の永続化：(有効|未許可)/.test(ui.state), ui.state);
check('バックアップの状況を表示する', /最後のバックアップ/.test(ui.backup), ui.backup);
check('ホーム画面かタブかを表示する', /タブで表示中|ホーム画面から起動中/.test(ui.usage), ui.usage);
check('タブ表示なら警告を出す', ui.tabWarn);

await Promise.all([page.waitForEvent('download'), page.click('#expJson')]);
await page.waitForTimeout(400);
check('書き出すとバックアップ日が記録される',
      await page.evaluate(()=>!!JSON.parse(localStorage.getItem('postingmap.pref.v1')).lastBackup));
eq('催促の印が消える', await page.evaluate(()=>document.getElementById('expJson').classList.contains('nag')), false);

// 30日以上前 + 記録あり → 催促
await page.evaluate(()=>{
  const pf=JSON.parse(localStorage.getItem('postingmap.pref.v1'));
  pf.lastBackup = Date.now()-31*86400000;
  localStorage.setItem('postingmap.pref.v1', JSON.stringify(pf));
  db.marks=[{id:9,ts:1,day:'2026-08-10',f:db.flyers[0].id,type:'line',
             pts:[[35.68,139.76],[35.681,139.762]]}];
  saveDB();
});
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(3200);
check('30日たつと書き出しを促す',
      await page.evaluate(()=>document.getElementById('expJson').classList.contains('nag')));

// 壊れたデータ
await page.evaluate(()=>localStorage.setItem('postingmap.v1','{"sessions":[{"id":1,,,BROKEN'));
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2000);
const broken = await page.evaluate(()=>({
  flagged: loadError,
  kept: Object.keys(localStorage).filter(k=>k.includes('.broken')).length,
  content: Object.keys(localStorage).filter(k=>k.includes('.broken')).map(k=>localStorage.getItem(k))[0],
  usable: Array.isArray(db.sessions)}));
check('壊れたデータを検出する', broken.flagged);
eq('上書きせず退避する', broken.kept, 1);
check('中身をそのまま保持する', broken.content.startsWith('{"sessions"'), broken.content);
check('アプリは使える状態を保つ', broken.usable);
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(500);
check('退避データの書き出しボタンが出る',
      await page.evaluate(()=>getComputedStyle(document.getElementById('stBroken')).display!=='none'));
done(t.errors); await t.close();
