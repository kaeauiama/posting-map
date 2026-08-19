# 調査スクリプト

道路データ方式を採用するかどうかを判断するために書いたものです。
結論は `../DEVELOPMENT.md` の §6 にまとめてあります。ここは再現用。

```bash
pip install numpy scipy matplotlib
cd research
cp ../test/fixtures/*.geojson .
python3 survey.py     # 規模と道路種別の内訳
python3 analyze.py    # 建物→最寄り道路の距離分布（← 判断の決め手）
python3 buffer.py     # バッファ判定の取りこぼし率
python3 match.py      # 素朴なスナップの誤マッチ率（採用しなかった方式）
python3 pack.py       # 配信用に詰めたときのサイズ
python3 viz.py        # 配布状況の図（coverage.png）
```

`analyze.py` と `viz.py` は `cent.npy`（建物の重心）を作る／使うので、
`analyze.py` を先に走らせてください。

## それぞれ何を見ているか

| ファイル | 問い | 出た答え |
|---|---|---|
| `survey.py` | どれくらいの量か | 7.17km²・道路2,183本・162km・22.6km/km² |
| `analyze.py` | **OSM の道路網は足りているか** | 建物の99.8%が道から40m以内。`residential` だけだと83.1% |
| `match.py` | 最寄り道路スナップで足りるか | 誤差8mで**誤マッチ26%**。使えない |
| `buffer.py` | バッファ判定で足りるか | 20mバッファで取りこぼしほぼ0%。**これを採用** |
| `pack.py` | アプリに載る大きさか | 9,432区間で生229KB・gzip 64KB |
| `viz.py` | 見た目はどうなるか | `coverage.png` |

## データの取り直し

`../DEVELOPMENT.md` の「道路データの取り直し方」を参照。
`test/fixtures/` のものは東京の実データ（2026-08-19 取得）です。
