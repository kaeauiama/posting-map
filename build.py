#!/usr/bin/env python3
"""src/index.html に Leaflet を埋め込んで、配信用の dist/ を作る。

  python3 build.py            # dist/ を作る（GitHub Pages に上がるのはここ）
  python3 build.py --dev      # 開発用に dev/ も作る（Leafletを外部ファイル参照にする）

Leaflet は node_modules から取る。無ければ  npm install  を先に実行すること。
"""
import hashlib, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).parent
SRC  = ROOT / "src" / "index.html"
SW   = ROOT / "src" / "sw.js"
LEAF = ROOT / "node_modules" / "leaflet" / "dist"
LICE = ROOT / "node_modules" / "leaflet" / "LICENSE"   # BSD-2は再配布時に本文の掲示が要る
MARK = "<!--LEAFLET-->"
# dist/ と dev/ に一緒に置くもの（アプリ本体と同じ階層にある必要がある）
ASSETS = ["manifest.webmanifest", "icon-32.png", "icon-180.png",
          "icon-192.png", "icon-512.png", "icon-maskable-512.png"]

def main():
    src = SRC.read_text(encoding="utf-8")
    if MARK not in src:
        sys.exit(f"{MARK} が src/index.html に見つかりません")
    css = (LEAF / "leaflet.css").read_text(encoding="utf-8")
    js  = (LEAF / "leaflet.js").read_text(encoding="utf-8")

    # ライセンス本文もコメントに入れる。配信されるのは dist/index.html 単体なので、
    # このファイルだけで BSD-2 の条件（著作権表示と本文の掲示）を満たす必要がある。
    lic = LICE.read_text(encoding="utf-8").replace("--", "- -")   # HTMLコメントを閉じさせない
    inline = ("<!-- Leaflet 1.9.4 https://leafletjs.com/ を同梱\n\n"
              + lic + "\n-->\n"
              "<style>\n" + css + "\n</style>\n<script>\n" + js + "\n</script>")
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / "index.html"
    out.write_text(src.replace(MARK, inline), encoding="utf-8")
    for f in ASSETS:
        shutil.copy(ROOT / f, dist / f)
    write_sw(dist, out.read_text(encoding="utf-8"))
    print(f"built: dist/index.html  ({out.stat().st_size//1024} KB) ＋ アイコンとmanifest")

    if "--dev" in sys.argv:
        dev = ROOT / "dev"
        (dev / "lib").mkdir(parents=True, exist_ok=True)
        shutil.copy(LEAF / "leaflet.js",  dev / "lib" / "leaflet.js")
        shutil.copy(LEAF / "leaflet.css", dev / "lib" / "leaflet.css")
        (dev / "index.html").write_text(src.replace(
            MARK, '<link rel="stylesheet" href="lib/leaflet.css">\n<script src="lib/leaflet.js"></script>'),
            encoding="utf-8")
        for f in ASSETS:
            shutil.copy(ROOT / f, dev / f)
        write_sw(dev, (dev / "index.html").read_text(encoding="utf-8"))
        print("built: dev/index.html （テスト用。Leafletは外部参照）")

def write_sw(dest, html):
    """sw.js を置く。中身のハッシュを STAMP に刻むことで、アプリを更新したときだけ
    Service Worker が入れ替わる（変わらなければブラウザは入れ直さない）。"""
    stamp = hashlib.sha256(html.encode("utf-8")).hexdigest()[:12]
    dest.joinpath("sw.js").write_text(
        SW.read_text(encoding="utf-8").replace("__BUILD__", stamp), encoding="utf-8")
    return stamp


if __name__ == "__main__":
    main()
