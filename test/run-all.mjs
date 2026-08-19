/* すべてのテストを順に走らせる。 npm test で呼ばれる。 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter(f=>/^\d\d-.*\.mjs$/.test(f)).sort();
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir,f)], {stdio:'inherit'});
  if (r.status !== 0) bad++;
  console.log('');
}
console.log(bad ? `${bad}/${files.length} ファイルが失敗しました` : `${files.length} ファイル すべて合格`);
process.exit(bad ? 1 : 0);
