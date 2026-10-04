/* 記録していないときの現在地：出るが、追従も記録もしない */
import { open, check, eq, done } from './lib.mjs';
console.log('14 記録していないときの現在地');

/* 一度でも位置が取れている端末（pref.geoOK）で開く */
const t = await open({initScript:
  `localStorage.setItem('postingmap.pref.v1', JSON.stringify({tabWarned:true, geoOK:true, mode:'gps'}))`});
const { page, ctx } = t;

const state = () => page.evaluate(()=> ({
  marker: !!meMarker,
  at: meMarker ? [ +meMarker.getLatLng().lat.toFixed(5), +meMarker.getLatLng().lng.toFixed(5) ] : null,
  center: [ +map.getCenter().lat.toFixed(5), +map.getCenter().lng.toFixed(5) ],
  watching: watchId !== null,
  tracking,
  dot: getComputedStyle(document.getElementById('gpsdot')).backgroundColor,
  pts: cur ? cur.pts.length : null,
  sessions: db.sessions.length,
}));

// ---- 記録していなくても現在地が出る ----
let st = await state();
check('記録していないのに監視が動いている', st.watching);
check('現在地の丸が出ている', st.marker);
eq('記録は始まっていない', st.tracking, false);
const start = st.center;

// ---- 動いても画面は追いかけない ----
for (const lat of [35.6840, 35.6870, 35.6900]) {
  await ctx.setGeolocation({latitude: lat, longitude: 139.7671, accuracy: 8});
  await page.waitForTimeout(350);
}
st = await state();
eq('丸は動いている', st.at[0] > 35.688, true);
eq('でも画面は動いていない', st.center, start);
check('記録もされていない', st.sessions === 0 && (st.pts === null || st.pts === 0));
check('緑の点は消えたまま（記録中ではないので）', st.dot === 'rgb(187, 187, 187)', st.dot);

// ---- 「現在地へ」を押したときだけ寄る ----
await page.click('[data-act="loc"]:visible'); await page.waitForTimeout(500);
st = await state();
eq('押せば現在地に寄る', [st.center[0] > 35.688, st.center[1] > 139.76], [true, true]);

// ---- 記録を始めれば、これまでどおり追従して記録する ----
await page.click('#startBtn'); await page.waitForTimeout(500);
await page.evaluate(()=>{ pref.interval = 0; savePref(); });
// 1歩ずつは200m以内にする（それを超えると「飛んだ点」として捨てられる）
for (const lat of [35.6908, 35.6916, 35.6924, 35.6932]) {
  await ctx.setGeolocation({latitude: lat, longitude: 139.7671, accuracy: 8});
  await page.waitForTimeout(350);
}
st = await state();
check('記録中は点が溜まる', st.pts >= 2, `${st.pts}点`);
check('記録中は緑の点がつく', st.dot !== 'rgb(187, 187, 187)', st.dot);
check('記録中は画面が追いかける', st.center[0] > 35.689, JSON.stringify(st.center));

// ---- 止めても現在地は出続ける ----
await page.click('#startBtn'); await page.waitForTimeout(600);
st = await state();
eq('止めても監視は続く', [st.tracking, st.watching], [false, true]);
check('止めたあとも丸は残る', st.marker);
const afterStop = st.center;
await ctx.setGeolocation({latitude: 35.7100, longitude: 139.7671, accuracy: 8});
await page.waitForTimeout(500);
st = await state();
check('止めたあとは追従しない', JSON.stringify(st.center) === JSON.stringify(afterStop));
check('止めたあとも丸は動く', st.at[0] > 35.70, JSON.stringify(st.at));

// ---- ログ入力モードでは受信機を止める ----
await page.click('#modebar button[data-mode="draw"]'); await page.waitForTimeout(500);
eq('なぞるモードでは監視を止める', await page.evaluate(()=> watchId !== null), false);
await page.click('#modebar button[data-mode="gps"]'); await page.waitForTimeout(500);
eq('GPSモードに戻すと再開する', await page.evaluate(()=> watchId !== null), true);

done(t.errors); await t.close();
