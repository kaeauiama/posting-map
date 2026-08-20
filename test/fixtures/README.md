# テスト用の実データ

`08-roads.mjs` が使う、東京・文京区あたりの実データです。作り物ではなく
本物の道路網で試すためのもので、性能の数字（取り込み時間・被覆計算・描画）も
このデータでの実測値です。

| ファイル | 中身 | 件数 |
|---|---|---|
| `roads.geojson` | `highway` タグの付いた way（形状つき） | 2,183 |
| `buildings.geojson` | 建物の way と relation（重心の点） | 13,970 |

取得日 2026-08-19。範囲はおよそ 北緯 35.7155–35.7382 / 東経 139.7397–139.7711
（2.84 × 2.53 km、7.17 km²）。取り直し方と Overpass のクエリは
`../../DEVELOPMENT.md` の「道路データの取り直し方」にあります。

## 出典とライセンス

データは [OpenStreetMap](https://www.openstreetmap.org/copyright) から
[overpass-turbo](https://overpass-turbo.eu) 経由で取得したものです。

> © OpenStreetMap contributors

**ライセンスは [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**
（Open Database License）で、この2ファイルはそのまま ODbL の下で配布されています。
リポジトリの他の部分の扱いとは別なので、切り出して使うときは ODbL の条件
（出典表示と、派生データベースの同ライセンスでの公開）に従ってください。

各ファイルの先頭にある `"copyright"` の行は、この出典表示そのものです。
消さないでください。
