# 使っているものと、その権利関係

このアプリが同梱・利用している第三者の成果物と、それぞれの条件をまとめます。

> **このリポジトリ自体にはライセンスを付けていません。** 公開はしていますが、
> 作者（kaoya）が書いた部分について利用許諾を与えるものではありません。
> 以下に挙げるものは、それぞれの権利者の条件が優先します。

---

## Leaflet 1.9.4 — BSD 2-Clause License

地図ライブラリ。<https://leafletjs.com/>
`dist/index.html` に丸ごと埋め込んで配信しています（実行時に CDN を読みに行かない
ためで、`build.py` が `node_modules/leaflet/dist/` から流し込みます）。

再配布にあたり、以下の全文を掲示します。

```
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## 地図タイル

アプリが実行時に読み込むもので、リポジトリには含まれません。
出典は画面右下に自動で表示されます（`src/index.html` の `BASES` と `syncCredit()`）。

| タイル | 提供元 | 条件 |
|---|---|---|
| 淡色 / 標準 / 航空写真 | [国土地理院](https://maps.gsi.go.jp/development/ichiran.html) | 出典の明示が必要。ウェブ表示は申請不要 |
| OpenStreetMap | [OSM Foundation](https://operations.osmfoundation.org/policies/tiles/) | © OpenStreetMap contributors の表示。タイル利用ポリシーの範囲内で使うこと |

## 道路・建物データ — ODbL 1.0

「Overpassから取得」で読み込むデータと、`test/fixtures/` に入れてある
テスト用の実データは、どちらも [OpenStreetMap](https://www.openstreetmap.org/copyright)
由来で **[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)** です。

> © OpenStreetMap contributors

利用者の端末に取り込まれたデータは端末内にとどまり、どこにも送信されません。
リポジトリに含まれる実データについては `test/fixtures/README.md` を見てください。
