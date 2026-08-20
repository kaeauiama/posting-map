# テスト

実機に近い条件（iPhone相当のビューポート・タッチ・位置情報・時計の固定）で
Playwright を使って動かしています。地図タイルはネットに出ずダミーを返します。

```bash
npm install
npx playwright install chromium   # 初回だけ
npm test                          # dev/ をビルドして全部走らせる
node test/08-roads.mjs            # 個別に走らせる
```

| ファイル | 見ているもの |
|---|---|
| `01-gps-record.mjs` | 記録の開始・間引き・保存・復元、裏に回ったときの区切り |
| `02-draw-modes.mjs` | なぞる／囲む／消す／ひとつ戻す、2本指との排他、日付のさかのぼり |
| `03-flyers.mjs` | 版のない旧データの移行、版の追加・改名・色、絞り込み、CSV、削除と復元 |
| `04-counts.mjs` | 一覧での枚数入力、GPS中のタップとの整合、日付の追加 |
| `05-storage.mjs` | 永続化の要求と表示、バックアップの催促、壊れたデータの退避 |
| `06-interval.mjs` | 記録間隔ごとの点数と、実際の道からのずれの実測 |
| `07-fog.mjs` | 「エリア」表示のレイヤとキャンバスの位置合わせ |
| `08-roads.mjs` | 実データ（`fixtures/`）の取り込み、配布率、描画性能 |

`fixtures/roads.geojson` と `fixtures/buildings.geojson` は東京の実データ
（2.84 × 2.53 km、道路2,183本・建物13,970件）です。OpenStreetMap 由来で
ライセンスは ODbL 1.0 — 出典表示と取り直し方は `fixtures/README.md` にあります。

環境変数 `PW_CHROMIUM` で Chromium の実行ファイルを指定できます。
