/* ポケットモード：黒くして触っても何も起きない。GPSの記録だけは続く */
import { open, check, eq, near, done } from './lib.mjs';
console.log('11 ポケットモード');
const t = await open();
const { page, ctx, cdp } = t;

// 記録を始めるまで、ポケットの帯は出ない
check('記録前は帯が出ていない', !(await page.isVisible('#pocketBtn')));

await page.click('#startBtn'); await page.waitForTimeout(600);
check('記録を始めると帯が出る', await page.isVisible('#pocketBtn'));
check('代わりに説明の行は消える', !(await page.isVisible('#hint')));

// 何枚か歩いてから、ポケットに入れる
const walk = async (n, from) => {
  for (let i = 0; i < n; i++) {
    await ctx.setGeolocation({latitude: from + i*0.00025, longitude: 139.7671, accuracy: 8});
    await page.waitForTimeout(260);
  }
};
await page.evaluate(()=>{ pref.interval = 0; savePref(); });   // 毎回の測位を点にする
await walk(6, 35.6812);
const before = await page.evaluate(()=> cur.pts.length);
check('歩いた分の点が入っている', before >= 4, `${before}点`);

await page.click('#pocketBtn'); await page.waitForTimeout(400);
check('黒い画面になる', await page.evaluate(()=> pocket && document.body.classList.contains('pocket')));
check('地図が隠れる', !(await page.isVisible('#map')));
check('下の操作も隠れる', !(await page.isVisible('#bottom')));

// ここが本題：ポケットの中で布に押されても、何も起きてはいけない
const countBefore = await page.evaluate(()=> statsFor(today(), null).count);
for (const [x, y] of [[180,300],[90,650],[300,120],[200,760],[60,420]]) {
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y, id:1}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
}
await page.waitForTimeout(300);
eq('あちこち触っても枚数は増えない',
   await page.evaluate(()=> statsFor(today(), null).count), countBefore);
check('触っただけでは戻らない', await page.evaluate(()=> pocket));

// 暗いままでも記録は続く。ただし地図は取りに行かない（通信と描画を止めている）
let tiles = 0;
page.on('request', r => { if (r.url().includes('cyberjapandata')) tiles++; });
await walk(6, 35.6828);
await page.waitForTimeout(600);
eq('ポケット中は地図を取りに行かない', tiles, 0);
const during = await page.evaluate(()=> cur.pts.length);
check('黒い画面のままでも点が増える', during > before, `${before} → ${during}点`);

// ノブを少しだけ引いても解除されない
const knob = await page.locator('#pkKnob').boundingBox();
const cy = knob.y + knob.height/2;
await cdp.send('Input.dispatchTouchEvent',
  {type:'touchStart', touchPoints:[{x: knob.x + knob.width/2, y: cy, id:1}]});
await cdp.send('Input.dispatchTouchEvent',
  {type:'touchMove', touchPoints:[{x: knob.x + knob.width/2 + 40, y: cy, id:1}]});
await page.waitForTimeout(120);
check('少し引いただけでは戻らない', await page.evaluate(()=> pocket));

// 最後まで引くと戻る
const rail = await page.locator('#pkSlide').boundingBox();
for (let x = knob.x + 60; x < rail.x + rail.width; x += 30) {
  await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x, y: cy, id:1}]});
  await page.waitForTimeout(30);
}
await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
await page.waitForTimeout(500);
check('最後まで引くと戻る', await page.evaluate(()=> !pocket));
check('地図が戻る', await page.isVisible('#map'));

// 戻ったときに、暗い間の軌跡がそのまま線になっている
const back = await page.evaluate(()=> ({
  pts: cur.pts.length,
  line: liveLine.getLatLngs().length,
  size: map.getSize().y,
}));
eq('暗い間の点も線に反映される', back.line, back.pts);
check('地図の大きさを取り戻している', back.size > 100, `${back.size}px`);

// 記録を止めたら帯は消える
await page.click('#startBtn'); await page.waitForTimeout(600);
check('記録を止めると帯も消える', !(await page.isVisible('#pocketBtn')));
const saved = await page.evaluate(()=> db.sessions[db.sessions.length-1].pts.length);
near('暗い間の点も保存に含まれる', saved, back.pts, 1);

done(t.errors); await t.close();
