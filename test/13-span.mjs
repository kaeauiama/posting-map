/* 表示する期間：同じチラシを期間をあけて配り直したとき、配り漏れが見えること */
import { open, check, eq, done } from './lib.mjs';
console.log('13 表示する期間と月ごとの集計');

const DAY = 86400000;
const now = Date.now();
const ymOf = ms => { const d = new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const dayOf = ms => new Date(ms).toISOString().slice(0,10);

/* チラシA（id:1）を半年前と今日、チラシB（id:2）を3か月前に配った端末 */
const old1 = now - 180*DAY, mid = now - 90*DAY;
const DB = {
  flyers: [{id:1, name:'チラシA', color:'#e34948', created:1},
           {id:2, name:'チラシB', color:'#2a78d6', created:2}],
  current: 1,
  sessions: [
    {id:11, start:old1, end:old1+36e5, count:300, f:1,
     pts:[[35.6800,139.7660],[35.6830,139.7660]]},          // 半年前のA
    {id:12, start:mid,  end:mid+36e5,  count:200, f:2,
     pts:[[35.6800,139.7680],[35.6830,139.7680]]},          // 3か月前のB
  ],
  marks: [{id:13, ts:old1, day:dayOf(old1), type:'line', f:1,
           pts:[[35.6800,139.7700],[35.6830,139.7700]]}],   // 半年前の手描き
  tally: {1:{[dayOf(old1)]:120}, 2:{[dayOf(mid)]:80}},
};

const t = await open({initScript:
  `localStorage.setItem('postingmap.v1', ${JSON.stringify(JSON.stringify(DB))})`});
const { page } = t;

const shown = () => page.evaluate(()=> ({
  lines: histGroup.getLayers().length,
  chip: document.getElementById('filterChip').textContent,
}));

// ---- 全期間では、昔の記録も出る ----
let st = await shown();
eq('全期間なら3件とも地図に出る', st.lines, 3);
check('チップに期間は出ない', !st.chip.includes('日'), st.chip);

// ---- 90日で絞ると、半年前のぶんが消える ----
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(400);
await page.click('#spanbar button[data-span="90"]'); await page.waitForTimeout(600);
st = await shown();
eq('90日なら半年前の2件が消える', st.lines, 1);
check('何で絞っているかチップに出る', st.chip.includes('90日'), st.chip);
eq('設定が保存される', await page.evaluate(()=> [pref.span, pref.from]), [90, null]);

// ---- ここが本題：配り漏れの判定も期間で行う ----
await page.evaluate(()=>{
  pref.home = [35.6815, 139.7680]; pref.radius = 1000; pref.miss = 'area';
  savePref(); syncHome(); syncMiss();
});
await page.waitForTimeout(500);
const band = async () => page.evaluate(()=>{
  // エリア表示は「配った帯」を抜く。抜けた面積の割合を数える
  const c = document.querySelector('canvas.fog-canvas');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let clear = 0, dark = 0;
  for(let i=3; i<d.length; i+=4*37){ if(d[i] > 20) dark++; else clear++; }
  return clear / (clear + dark);
});
await page.evaluate(()=>{ pref.span = 0; savePref(); drawHistory(); }); await page.waitForTimeout(500);
const all = await band();
await page.evaluate(()=>{ pref.span = 90; savePref(); drawHistory(); }); await page.waitForTimeout(500);
const recent = await band();
check('期間を絞ると「まだ配っていない」面が増える', recent < all, `全期間 ${all.toFixed(3)} → 90日 ${recent.toFixed(3)}`);

// ---- 開始日での指定 ----
await page.evaluate(d=>{
  const el = document.getElementById('spanFrom');
  el.value = d; el.dispatchEvent(new Event('change'));
}, dayOf(now - 30*DAY));
await page.waitForTimeout(600);
st = await shown();
eq('開始日より前の記録は出ない', st.lines, 0);
eq('日数の指定は解除される', await page.evaluate(()=> pref.span), 0);
await page.click('#spanClear'); await page.waitForTimeout(500);
st = await shown();
eq('解除すると全部戻る', st.lines, 3);

// ---- 月ごとの棒グラフ ----
const chart = await page.evaluate(()=>{
  const rows = monthlyCounts(12);
  const hit = rows.filter(r=>r.total>0).map(r=>({ym:r.ym, total:r.total, n:r.by.size}));
  return {hit, svg: document.getElementById('monthChart').innerHTML};
});
eq('枚数のある月が2つある', chart.hit.length, 2);
eq('半年前の月はA の 420枚（手入力120＋GPS300）',
   chart.hit.map(h=>h.total).sort((a,b)=>a-b), [280, 420]);
check('棒グラフが描かれている', chart.svg.includes('<svg') && chart.svg.includes('</svg>'));
check('凡例に版の名前が出る', chart.svg.includes('チラシA') && chart.svg.includes('チラシB'));
check('最後に配ってからの日数が出る', chart.svg.includes('最後に配ってから'));

// ---- 集計の数字は期間で変わらない（枚数とkmは全期間） ----
await page.evaluate(()=>{ pref.span = 90; savePref(); renderSummary(); }); await page.waitForTimeout(300);
const tot = await page.evaluate(()=> flyerTotals(1).count);
eq('期間で絞っても通算の枚数は変わる(全期間のまま)', tot, 420);
check('配布率が期間で計算されていると明記される',
      (await page.textContent('#flyerSummary')).includes('の記録だけ'));

done(t.errors); await t.close();
