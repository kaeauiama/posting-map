/* ログ入力：なぞる／囲む／消す／ひとつ戻す／記録日をさかのぼる */
import { open, line, check, eq, done } from './lib.mjs';
console.log('02 ログ入力モード');
const t = await open();
const { page } = t;

await page.click('#modebar button[data-mode="draw"]'); await page.waitForTimeout(400);
const m = await page.evaluate(()=>({mode, drag:map.dragging.enabled(),
  hud:getComputedStyle(document.getElementById('hud')).display,
  ctrl:getComputedStyle(document.getElementById('controls')).display,
  log:getComputedStyle(document.getElementById('logControls')).display}));
eq('なぞるモードになる', m.mode, 'draw');
eq('1本指の地図ドラッグを切る', m.drag, false);
eq('上の数字は出さない', m.hud, 'none');
eq('記録スタートとカウンターは出さない', m.ctrl, 'none');
eq('ログ入力の操作列だけ出す', m.log, 'flex');

await t.stroke(line(90,200,90,520));
await t.stroke([...line(90,520,300,520), ...line(300,520,300,240,10)]);
eq('なぞった線が2本保存される', await page.evaluate(()=>db.marks.length), 2);
eq('線として保存される', await page.evaluate(()=>db.marks.map(x=>x.type)), ['line','line']);

// 2本指は地図操作にゆずる
await t.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:400,id:1},{x:250,y:400,id:2}]});
await t.cdp.send('Input.dispatchTouchEvent',{type:'touchMove', touchPoints:[{x:130,y:400,id:1},{x:270,y:400,id:2}]});
await t.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',  touchPoints:[]});
await page.waitForTimeout(300);
eq('2本指では線を引かない', await page.evaluate(()=>db.marks.length), 2);

await page.click('#modebar button[data-mode="area"]'); await page.waitForTimeout(250);
await t.stroke([...line(140,260,290,260,7),...line(290,260,290,420,7),
                ...line(290,420,140,420,7),...line(140,420,140,260,7)]);
eq('囲みが面として保存される', await page.evaluate(()=>db.marks[db.marks.length-1].type), 'area');

// 日付をさかのぼる
await page.click('#modebar button[data-mode="draw"]'); await page.waitForTimeout(200);
await page.fill('#dayPick','2026-08-10'); await page.dispatchEvent('#dayPick','change');
await page.waitForTimeout(250);
await t.stroke(line(200,220,200,500));
eq('指定した日付で記録される', await page.evaluate(()=>db.marks[db.marks.length-1].day), '2026-08-10');

// 消す
await page.click('#modebar button[data-mode="erase"]'); await page.waitForTimeout(300);
const before = await page.evaluate(()=>db.marks.length);
await page.touchscreen.tap(200,380); await page.waitForTimeout(400);
eq('タップで1本消える', await page.evaluate(()=>db.marks.length), before-1);
await page.touchscreen.tap(370,150); await page.waitForTimeout(400);
check('何もない所では消えない', await page.evaluate(()=>/近くに手描き/.test(document.getElementById('toast').textContent)));

await page.click('#modebar button[data-mode="draw"]'); await page.waitForTimeout(200);
const b2 = await page.evaluate(()=>db.marks.length);
await page.click('#undoBtn'); await page.waitForTimeout(300);
eq('ひとつ戻すで1本減る', await page.evaluate(()=>db.marks.length), b2-1);

await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1200);
check('再読込しても手描きが残る', await page.evaluate(()=>db.marks.length>0));
done(t.errors); await t.close();
