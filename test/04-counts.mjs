/* 一覧画面での枚数入力：直接入力／日付追加／GPS中のカウントとの整合 */
import { open, check, eq, done } from './lib.mjs';
console.log('04 枚数の入力');
const t = await open();
const { page, ctx } = t;
const day = await page.evaluate(()=>today());

// GPSでタップして30枚
await page.click('#startBtn'); await page.waitForTimeout(300);
await t.fakeClock();
for (let i=1;i<=8;i++){ await t.advance(11000);
  await ctx.setGeolocation({latitude:35.6812+i*0.00012, longitude:139.7671, accuracy:8});
  await page.waitForTimeout(30); }
for (let i=0;i<30;i++) await page.click('#countBtn');
await page.click('#startBtn'); await page.waitForTimeout(400);
eq('GPS中のタップが記録される', await page.evaluate(()=>db.sessions[0].count), 30);

await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(500);
const sel = `.cin[data-day="${day}"]`;
eq('一覧に今日の枚数が出る', await page.inputValue(sel), '30');

await page.fill(sel, '500'); await page.dispatchEvent(sel, 'change'); await page.waitForTimeout(300);
const up = await page.evaluate(()=>({sess:db.sessions[0].count, tally:JSON.stringify(db.tally)}));
check('増やすと手入力ぶんで補われる', up.sess===30 && /":470/.test(up.tally), JSON.stringify(up));

await page.fill(sel, '10'); await page.dispatchEvent(sel, 'change'); await page.waitForTimeout(300);
const down = await page.evaluate(()=>db.sessions[0].count);
eq('タップ数より減らすとタップ側を削る', down, 10);
eq('表示も合計と一致する', await page.inputValue(sel), '10');

await page.fill('#addDay','2026-08-11'); await page.dispatchEvent('#addDay','change'); await page.waitForTimeout(400);
await page.fill('.cin[data-day="2026-08-11"]','620');
await page.dispatchEvent('.cin[data-day="2026-08-11"]','change'); await page.waitForTimeout(300);
check('地図の記録がない日も枚数だけ入る',
      await page.evaluate(()=>JSON.stringify(db.tally).includes('"2026-08-11":620')));
done(t.errors); await t.close();
