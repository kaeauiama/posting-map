/* 「道路」表示：実データを取り込み、通った道を配布済みにして塗り分ける */
import { open, check, eq, near, done, FIXTURES } from './lib.mjs';
import path from 'node:path';
console.log('08 配り漏れ（道路表示）');
const HOME = [35.7268, 139.7554];
const t = await open({geolocation:{latitude:HOME[0], longitude:HOME[1], accuracy:8}});
const { page } = t;
await page.evaluate(h=>{ pref.home=h; pref.radius=1000; pref.tabWarned=true; savePref(); syncHome();
                         map.setView(h,15); }, HOME);

const t0 = Date.now();
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(400);
await page.setInputFiles('#roadFile', [path.join(FIXTURES,'roads.geojson'),
                                       path.join(FIXTURES,'buildings.geojson')]);
await page.waitForFunction(()=>typeof roads!=='undefined' && roads!==null, {timeout:120000});
const sec = (Date.now()-t0)/1000;
console.log(`     取り込み ${sec.toFixed(1)}秒`);
check('実データを30秒以内に取り込める', sec < 30, sec+'秒');

const r = await page.evaluate(()=>({n:roads.n, km:+roads.totalKm.toFixed(1),
  kb: Math.round(localStorage.getItem('postingmap.roads.v1').length/1024), miss:pref.miss}));
console.log(`     ${r.n.toLocaleString()}区間 / ${r.km}km / 保存 ${r.kb}KB`);
check('区間に切れている', r.n > 5000 && r.n < 20000, JSON.stringify(r));
check('保存サイズが現実的', r.kb < 900, r.kb+'KB');
eq('取り込むと道路表示に切り替わる', r.miss, 'road');

// 商圏の北東側を歩いたことにする
await page.click('#closePanel'); await page.waitForTimeout(200);
await page.evaluate(h=>{
  const sel=[];
  for(let i=0;i<roads.n;i++){
    const la=(roads.lat1[i]+roads.lat2[i])/2, ln=(roads.lng1[i]+roads.lng2[i])/2;
    const dy=(la-h[0])*111320, dx=(ln-h[1])*111320*Math.cos(h[0]*Math.PI/180);
    if(dx>-120 && dy>-120 && Math.hypot(dx,dy)<650) sel.push([la,ln,dy]);
  }
  const ROW=40;
  sel.sort((a,b)=>{ const ra=Math.floor(a[2]/ROW), rb=Math.floor(b[2]/ROW);
                    return ra!==rb ? ra-rb : (ra%2?-1:1)*(a[1]-b[1]); });
  db.sessions=[{id:1,start:Date.now()-3e6,end:Date.now()-1e6,count:640,f:db.current,
                pts:sel.map(p=>[p[0],p[1]])}];
  saveDB(); covCache=null; drawHistory(); syncMiss(); renderSummary(); renderRoadRow();
}, HOME);
await page.waitForTimeout(800);
const st = await page.evaluate(()=>{const s=roadStats(null);
  return {km:+s.km.toFixed(1), pct:+s.pct.toFixed(1), n:s.n, done:s.done};});
console.log(`     商圏内 ${st.km}km / 配布率 ${st.pct}%`);
check('歩いた分だけ配布済みになる', st.pct > 5 && st.pct < 60, JSON.stringify(st));
check('商圏の外は数えない', st.n < r.n, JSON.stringify(st));
check('集計表に配布率が出る', /配布率/.test(await page.textContent('#flyerSummary')));
check('未配布の距離を示す', /未配布/.test(await page.textContent('#flyerSummary')));

await page.evaluate(()=>{ pref.miss='road'; savePref(); syncMiss(); });
await page.waitForTimeout(900);
check('道路レイヤが出る', await page.evaluate(()=>map.hasLayer(roadLayer)));
check('道路モードでは軌跡を重ねない',
      await page.evaluate(()=>document.querySelectorAll('#map path.leaflet-interactive').length===0));

const perf = await page.evaluate(()=>{
  const a=performance.now(); covCache=null; coverage(); const cov=performance.now()-a;
  const b=performance.now(); roadLayer.redraw(); const draw=performance.now()-b;
  return {cov:+cov.toFixed(0), draw:+draw.toFixed(0)};
});
console.log(`     被覆計算 ${perf.cov}ms / 描画 ${perf.draw}ms`);
check('被覆計算が200ms以内', perf.cov < 200, perf.cov+'ms');
check('描画が200ms以内', perf.draw < 200, perf.draw+'ms');

await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200);
const after = await page.evaluate(()=>({n:roads?roads.n:null, pct:+roadStats(null).pct.toFixed(1)}));
eq('再読込しても道路データが残る', after.n, r.n);
near('配布率も保たれる', after.pct, st.pct, 0.2);
done(t.errors); await t.close();
