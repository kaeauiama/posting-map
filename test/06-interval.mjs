/* 記録間隔：点は減るが、道からのずれは実用範囲に収まること
   （L字に120秒歩く。曲がり角は間隔を待たずに記録される想定） */
import { open, check, done } from './lib.mjs';
console.log('06 記録の間隔と精度');
const START = {latitude:35.6800, longitude:139.7660, accuracy:8};
const t = await open({geolocation: START});
const { page, ctx } = t;
await t.fakeClock();

const M=111320, K=Math.cos(35.68*Math.PI/180), TURN=55, TURNM=TURN*1.1;
const xy = p => [ (p[1]-139.7660)*M*K, (p[0]-35.6800)*M ];
const segDist = (p,a,b) => {
  const vx=b[0]-a[0], vy=b[1]-a[1], wx=p[0]-a[0], wy=p[1]-a[1];
  const L=vx*vx+vy*vy; let s=L?(wx*vx+wy*vy)/L:0; s=Math.max(0,Math.min(1,s));
  return Math.hypot(p[0]-(a[0]+s*vx), p[1]-(a[1]+s*vy));
};
async function walk(interval){
  await page.evaluate(()=>{ db.sessions=[]; saveDB(); drawHistory(); });
  await page.evaluate(iv=>{ pref.interval=iv; savePref(); }, interval);
  await ctx.setGeolocation(START); await page.waitForTimeout(200);
  await page.click('#startBtn'); await page.waitForTimeout(400);
  let lat=35.6800, lng=139.7660;
  for(let s=1;s<=120;s++){
    if(s<=TURN) lat += 1.1/M; else lng += 1.1/(M*K);
    await t.advance(1000);
    await ctx.setGeolocation({latitude:lat, longitude:lng, accuracy:8});
    await page.waitForTimeout(18);
  }
  await page.waitForTimeout(250);
  const pts = await page.evaluate(()=>cur.pts.slice());
  await page.click('#startBtn'); await page.waitForTimeout(300);
  return pts.map(xy);
}
const rows=[];
for (const iv of [3,10,20]) {
  const P = await walk(iv);
  let dev=0;
  for (let d=0; d<=TURNM; d++)
    for (const truth of [[0,d],[d,TURNM]]) {
      let m=Infinity;
      for (let i=1;i<P.length;i++) m=Math.min(m, segDist(truth,P[i-1],P[i]));
      dev=Math.max(dev,m);
    }
  rows.push({iv, n:P.length, dev:+dev.toFixed(1)});
  console.log(`     ${iv}秒 → ${P.length}点 / 最大ずれ ${dev.toFixed(1)}m`);
}
check('間隔を延ばすと点が減る', rows[0].n > rows[1].n && rows[1].n > rows[2].n, JSON.stringify(rows));
check('10秒でも道からのずれは5m以内', rows[1].dev <= 5, JSON.stringify(rows[1]));
check('20秒でも10m以内には収まる', rows[2].dev <= 10, JSON.stringify(rows[2]));
done(t.errors); await t.close();
