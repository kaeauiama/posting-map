/* 配布マップの Service Worker

   やることは2つだけ。
     1. アプリ本体を保存して、電波の無い場所でも起動できるようにする
     2. 地図タイルを保存して、一度見た場所は通信なしで出るようにする

   ビルドのたびに build.py が下の STAMP を書き換える。中身が1バイトでも変わると
   ブラウザが「新しい版」として入れ直すので、更新が確実に届く。
   ここを凝ると利用者が自力で直せなくなる。小さいまま保つこと。 */

const STAMP = "bbbe34fba1ac";
const APP   = "postingmap-app-" + STAMP;
const TILES = "postingmap-tiles-v1";     // タイルは版が変わっても捨てない
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-32.png",
               "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
const TILE_HOSTS = ["cyberjapandata.gsi.go.jp", "tile.openstreetmap.org"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    // 1つ欠けても全部落ちないように、1件ずつ入れる
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.indexOf("postingmap-app-") === 0 && k !== APP)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (TILE_HOSTS.indexOf(url.hostname) >= 0) { e.respondWith(tile(e.request)); return; }
  if (url.origin === self.location.origin)   { e.respondWith(shell(e.request)); }
});

/* 地図タイル：保存してあればそれを返す。無ければ取りに行って、ついでに保存する。
   ignoreVary は、保存したときと <img> から来たときで Origin ヘッダが違うため。
   これを外すと、事前保存したタイルが二度と見つからない。 */
async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) c.put(req.url, res.clone());
    return res;
  } catch (err) {
    return new Response("", { status: 504 });   // 圏外。地図は下地の色のまま
  }
}

/* アプリ本体：まず保存したものを返して、裏で新しい版を取ってくる。
   新しい版が反映されるのは次に開いたとき。すぐ反映したいときは
   メニューの「更新を確認」を押す。 */
async function shell(req) {
  const c = await caches.open(APP);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (res && res.status === 200) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || new Response("", { status: 504 });
}
