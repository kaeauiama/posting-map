/* チラシの版：旧データの移行／追加・改名・色／記録の紐づけ／絞り込み／削除／復元 */
import { open, line, check, eq, done } from './lib.mjs';
console.log('03 チラシの版');
// 版の概念が無かった頃のデータを置いて起動する
const t = await open({initScript: () => localStorage.setItem('postingmap.v1', JSON.stringify({
  sessions:[{id:11,start:Date.parse('2026-08-14T10:00'),end:Date.parse('2026-08-14T12:00'),count:300,
             pts:[[35.6800,139.7660],[35.6830,139.7660],[35.6830,139.7690]]}],
  marks:[{id:12,ts:Date.parse('2026-08-14T13:00'),day:'2026-08-14',type:'line',
          pts:[[35.6790,139.7700],[35.6820,139.7700]]}],
  tally:{'2026-08-14':50}}))});
const { page } = t;

const mig = await page.evaluate(()=>({flyers:db.flyers.length, sessF:db.sessions[0].f,
  markF:db.marks[0].f, tally:db.tally}));
eq('旧データに版が1つ作られる', mig.flyers, 1);
check('既存の記録がその版に移る', mig.sessF===1 && mig.markF===1);
eq('枚数も版ごとの形に移る', mig.tally, {'1':{'2026-08-14':50}});

await page.click('#flyerChip'); await page.waitForTimeout(400);
await page.click('[data-edit]'); await page.waitForTimeout(400);
await page.fill('#fName','2026春・少年部'); await page.click('#fSave'); await page.waitForTimeout(400);
await page.click('#addFlyer'); await page.waitForTimeout(400);
await page.fill('#fName','2026夏・体験会');
await page.click('#fColors button[data-c="#e34948"]');
await page.click('#fSave'); await page.waitForTimeout(400);
eq('版を追加・改名・色変更できる',
   await page.evaluate(()=>db.flyers.map(f=>[f.name,f.color])),
   [['2026春・少年部','#2a78d6'],['2026夏・体験会','#e34948']]);
check('追加した版が使用中になる', await page.evaluate(()=>db.current===db.flyers[1].id));
await page.click('#closeFlyer'); await page.waitForTimeout(300);

await page.click('#modebar button[data-mode="draw"]'); await page.waitForTimeout(300);
await t.stroke(line(120,220,120,500));
check('新しい記録は使用中の版に入る',
      await page.evaluate(()=>db.marks[db.marks.length-1].f===db.current));

// 地図はcanvas描画なので、DOMではなくレイヤ数で数える
await page.click('#filterChip'); await page.waitForTimeout(500);
const only = await page.evaluate(()=>({only:pref.only, layers:histGroup.getLayers().length}));
await page.click('#filterChip'); await page.waitForTimeout(500);
const all = await page.evaluate(()=>({only:pref.only, layers:histGroup.getLayers().length}));
check('「この版だけ」で表示が減る', only.layers < all.layers, JSON.stringify({only,all}));

// 一覧から枚数を入れる → CSV に出る
await page.click('#logControls [data-act="menu"]'); await page.waitForTimeout(600);
const day = await page.evaluate(()=>today());
await page.fill(`.cin[data-day="${day}"]`, '40');
await page.dispatchEvent(`.cin[data-day="${day}"]`, 'change'); await page.waitForTimeout(400);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expCsv')]);
const csv = (await import('node:fs')).readFileSync(await dl.path(), 'utf8');
check('CSVに版と枚数が出る', /2026夏・体験会,40,/.test(csv), csv);
check('CSVのヘッダが揃っている', csv.includes('日付,チラシの版,枚数,GPS距離km,手描き距離km,手描き件数'));
const [dlj] = await Promise.all([page.waitForEvent('download'), page.click('#expJson')]);
const backup = await dlj.path();

// 版を記録ごと削除 → JSONで復元
await page.click('#closePanel');
page.on('dialog', d => d.accept());
await page.click('#flyerChip'); await page.waitForTimeout(400);
const id2 = await page.evaluate(()=>db.flyers[1].id);
await page.click(`[data-edit="${id2}"]`); await page.waitForTimeout(300);
await page.click('#fDelete'); await page.waitForTimeout(500);
eq('版を消すと記録も消える', await page.evaluate(()=>db.flyers.length), 1);
await page.click('#closeFlyer');
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(400);
await page.setInputFiles('#fileIn', backup); await page.waitForTimeout(800);
eq('JSONから版ごと復元できる', await page.evaluate(()=>db.flyers.length), 2);
done(t.errors); await t.close();
