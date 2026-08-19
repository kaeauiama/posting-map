/* GPS記録：軌跡が残る／保存される／再読込で復元される／
   裏に回った区間で線が切れる */
import { open, check, eq, done } from './lib.mjs';
console.log('01 GPS記録');
const t = await open();
const { page, ctx } = t;

await page.click('#startBtn'); await page.waitForTimeout(400);
eq('スタートで記録中になる', await page.evaluate(()=>tracking), true);

await t.fakeClock();
for (let i=1; i<=24; i++) {                       // 1秒ごとに1.2m進む
  await t.advance(1000);
  await ctx.setGeolocation({latitude:35.6812+i*0.000011, longitude:139.7671, accuracy:8});
  await page.waitForTimeout(25);
}
for (let i=0;i<12;i++) await page.click('#countBtn');
const during = await page.evaluate(()=>({pts:cur.pts.length, count:cur.count,
  hud:document.getElementById('sCount').textContent}));
check('間隔10秒で点が間引かれる', during.pts>=3 && during.pts<=6, JSON.stringify(during));
eq('枚数がHUDに出る', during.hud, '12');

await page.click('#startBtn'); await page.waitForTimeout(400);
const saved = await page.evaluate(()=>{
  const d=JSON.parse(localStorage.getItem('postingmap.v1'));
  return {sessions:d.sessions.length, count:d.sessions[0].count, f:d.sessions[0].f===d.current};
});
eq('ストップで1件保存される', saved.sessions, 1);
eq('枚数が保存される', saved.count, 12);
check('いま選んでいる版に紐づく', saved.f);

// 裏に回ると記録を区切る
await page.click('#startBtn'); await page.waitForTimeout(300);
for (let i=1;i<=4;i++){ await t.advance(11000);
  await ctx.setGeolocation({latitude:35.6820+i*0.00012, longitude:139.7671, accuracy:8});
  await page.waitForTimeout(40); }
await page.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
                          document.dispatchEvent(new Event('visibilitychange')); });
await ctx.setGeolocation({latitude:35.6905, longitude:139.7750, accuracy:8});
await page.evaluate(()=>{ hiddenAt = Date.now()-20000;
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(600);
const split = await page.evaluate(()=>({sessions:db.sessions.length, curPts:cur.pts.length,
  toast:document.getElementById('toast').textContent}));
check('空白区間で記録が区切られる', split.sessions>=2, JSON.stringify(split));
check('止まっていたことを知らせる', /記録が止まって/.test(split.toast), split.toast);
await page.click('#startBtn'); await page.waitForTimeout(300);

await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1200);
check('再読込しても記録が残る', await page.evaluate(()=>db.sessions.length>=2));
done(t.errors); await t.close();
