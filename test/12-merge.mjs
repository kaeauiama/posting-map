/* 手分け配布の統合：他人の記録を足す。既に使っている端末のデータを壊さない */
import { open, check, eq, done } from './lib.mjs';
console.log('12 記録の統合');

const KEY = 'postingmap.v1';

/* すでに運用している端末を再現する。版が2つ、GPSの記録、手描き、手入力の枚数。
   who も tallyBy も無い、いまの形のデータ。 */
const EXISTING = {
  flyers: [{id:1, name:'2026春', color:'#e34948', created:1},
           {id:2, name:'2026秋', color:'#1668dc', created:2}],
  current: 1,
  sessions: [{id:1000, start:Date.UTC(2026,7,10,1), end:Date.UTC(2026,7,10,2), count:40, f:1,
              pts:[[35.681,139.767],[35.682,139.767]]}],
  marks: [{id:1001, ts:Date.UTC(2026,7,10,3), day:'2026-08-10', type:'line', f:2,
           pts:[[35.683,139.767],[35.684,139.767]]}],
  tally: {1:{'2026-08-10':60}, 2:{'2026-08-11':30}},
};

const t = await open({initScript: `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(EXISTING))})`});
const { page } = t;

// ---- 1. 既存データがそのまま読めること（移行） ----
const kept = await page.evaluate(()=> ({
  flyers: db.flyers.map(f=>f.name),
  sessions: db.sessions.length, marks: db.marks.length,
  tally: db.tally,
  tallyBy: db.tallyBy,
  day10: statsFor('2026-08-10', null).count,
}));
eq('版が2つとも残る', kept.flyers, ['2026春','2026秋']);
eq('軌跡と手描きが残る', [kept.sessions, kept.marks], [1,1]);
eq('手入力の枚数が残る', kept.tally, {1:{'2026-08-10':60}, 2:{'2026-08-11':30}});
eq('人ごとの枠が足される（空）', kept.tallyBy, {});
eq('その日の枚数は60＋40＝100', kept.day10, 100);

// ---- 2. 古い形式のバックアップ（owner なし）は、今までどおり復元 ----
const OLD_BACKUP = JSON.stringify({
  flyers: EXISTING.flyers, current: 1,
  sessions: [{id:2000, start:Date.UTC(2026,7,12,1), end:Date.UTC(2026,7,12,2), count:15, f:1,
              pts:[[35.690,139.760],[35.691,139.760]]}],
  marks: [], tally: {1:{'2026-08-12':25}},
});
const load = async (json) => {
  await page.evaluate(txt => {
    const dt = new DataTransfer();
    dt.items.add(new File([txt], 'in.json', {type:'application/json'}));
    const el = document.getElementById('fileIn');
    el.files = dt.files; el.dispatchEvent(new Event('change'));
  }, json);
  await page.waitForTimeout(400);
};
await page.evaluate(()=>{ window.confirm = ()=> true; });
await load(OLD_BACKUP);
let st = await page.evaluate(()=> ({n: db.sessions.length, c: statsFor('2026-08-12', null).count,
                                    by: Object.keys(db.tallyBy)}));
eq('古いバックアップが復元される', [st.n, st.c], [2, 40]);
eq('復元では人の枠を作らない', st.by, []);

await load(OLD_BACKUP);        // 2回目
st = await page.evaluate(()=> ({n: db.sessions.length, c: statsFor('2026-08-12', null).count}));
eq('2回復元しても増えない', [st.n, st.c], [2, 40]);

// ---- 3. ほかの人のファイルは「取り込み」になり、枚数が合算される ----
const TANAKA = JSON.stringify({
  owner: '田中', flyers: EXISTING.flyers, current: 1,
  sessions: [{id:1000, start:Date.UTC(2026,7,10,4), end:Date.UTC(2026,7,10,5), count:70, f:1,
              pts:[[35.700,139.780],[35.701,139.780]]}],   // ← 番号がこちらの1000と衝突している
  marks: [], tally: {1:{'2026-08-10':50}},
});
await load(TANAKA);
st = await page.evaluate(()=> ({
  n: db.sessions.length,
  who: db.sessions.filter(s=>s.who==='田中').length,
  day10: statsFor('2026-08-10', null).count,
  mine: db.tally[1]['2026-08-10'],
  his: db.tallyBy['田中']['1']['2026-08-10'],
}));
eq('番号が衝突しても別の記録として残る', [st.n, st.who], [3, 1]);
eq('自分の手入力は書き換わらない', st.mine, 60);
eq('相手の手入力は別枠に入る', st.his, 50);
eq('合算される（60+40 と 50+70）', st.day10, 220);

await load(TANAKA);            // 2回目
st = await page.evaluate(()=> ({n: db.sessions.length, day10: statsFor('2026-08-10', null).count}));
eq('同じ人を2回取り込んでも増えない', [st.n, st.day10], [3, 220]);

// ---- 4. 自分の記録が回り回って戻ってきても二重にならない ----
await page.evaluate(()=>{ pref.me = '青山'; savePref(); });
const MASTER = JSON.stringify({
  owner: 'まとめ役', flyers: EXISTING.flyers, current: 1,
  sessions: [{id:1000, start:Date.UTC(2026,7,10,1), end:Date.UTC(2026,7,10,2), count:40, f:1,
              who:'青山', pts:[[35.681,139.767],[35.682,139.767]]}],   // 自分のぶん
  marks: [], tally: {}, tallyBy: {'田中': {1:{'2026-08-10':50}}},
});
await load(MASTER);
st = await page.evaluate(()=> ({
  n: db.sessions.length, day10: statsFor('2026-08-10', null).count,
  his: db.tallyBy['田中']['1']['2026-08-10'],
}));
eq('自分の記録は戻ってきても増えない', [st.n, st.day10], [3, 220]);
eq('人づてに来た他人のぶんも重ならない', st.his, 50);

// ---- 5. 取り違えたときに消せる ----
await page.click('[data-act="menu"]:visible'); await page.waitForTimeout(400);
check('取り込んだ人が一覧に出る', (await page.textContent('#peopleBox')).includes('田中'));
await page.click('#peopleBox [data-drop="田中"]'); await page.waitForTimeout(500);
st = await page.evaluate(()=> ({n: db.sessions.length, day10: statsFor('2026-08-10', null).count,
                                by: Object.keys(db.tallyBy)}));
eq('その人の記録だけ消える', [st.n, st.by.length], [2, 0]);
eq('自分の記録は残る（60+40）', st.day10, 100);

// ---- 6. 書き出したファイルに名前が入る ----
const out = await page.evaluate(()=>{
  const o = Object.assign({}, db, {owner: (pref.me||'').trim()});
  return {owner: o.owner, hasTallyBy: 'tallyBy' in o};
});
eq('書き出しに配った人が入る', out.owner, '青山');
check('人ごとの枚数も持ち出せる', out.hasTallyBy);

done(t.errors); await t.close();
