/* 「エリア」表示：商圏を暗くして通った帯だけ抜く。地図を動かしてもずれない */
import { open, check, eq, done } from './lib.mjs';
console.log('07 配り漏れ（エリア表示）');
const t = await open();
const { page } = t;
await page.evaluate(()=>{
  const H=[35.6800,139.7660];
  db.sessions=[{id:1,start:Date.now()-6e6,end:Date.now()-3e6,count:520,f:db.current,
    pts:Array.from({length:26},(_,i)=>[H[0]+(i-13)*0.00022, H[1]])}];
  pref.home=H; pref.radius=500; pref.miss='area'; savePref(); saveDB();
  drawHistory(); syncMiss(); syncHome(); map.setView(H,16);
});
await page.waitForTimeout(1200);
check('エリア表示のレイヤが出る', await page.evaluate(()=>map.hasLayer(fog)));
check('専用のキャンバスができる', await page.evaluate(()=>!!document.querySelector('canvas.fog-canvas')));

await page.evaluate(()=>map.setZoom(17)); await page.waitForTimeout(900);
await page.evaluate(()=>map.panBy([90,70])); await page.waitForTimeout(900);
const align = await page.evaluate(()=>{
  const c=document.querySelector('canvas.fog-canvas');
  const tl=map.containerPointToLayerPoint([0,0]); const pos=L.DomUtil.getPosition(c);
  const s=map.getSize(); const dpr=Math.min(2,devicePixelRatio);
  return {dx:Math.round(pos.x-tl.x), dy:Math.round(pos.y-tl.y),
          sized: c.width===s.x*dpr && c.height===s.y*dpr};
});
eq('動かしてもキャンバスがずれない', [align.dx, align.dy], [0,0]);
check('キャンバスの大きさが画面と一致する', align.sized);

await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(500);
await page.click('#radbar button[data-r="1000"]'); await page.waitForTimeout(400);
eq('半径を変えられる', await page.evaluate(()=>pref.radius), 1000);
await page.click('#missbar button[data-miss="none"]'); await page.waitForTimeout(400);
eq('「なし」で消える', await page.evaluate(()=>[pref.miss, map.hasLayer(fog)]), ['none', false]);
done(t.errors); await t.close();
