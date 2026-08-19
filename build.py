#!/usr/bin/env python3
"""src/index.html に Leaflet を埋め込んで、配信用の dist/ を作る。

  python3 build.py            # dist/ を作る（GitHub Pages に上がるのはここ）
  python3 build.py --dev      # 開発用に dev/ も作る（Leafletを外部ファイル参照にする）

Leaflet は node_modules から取る。無ければ  npm install  を先に実行すること。
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(__file__).parent
SRC  = ROOT / "src" / "index.html"
LEAF = ROOT / "node_modules" / "leaflet" / "dist"
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

    inline = ("<!-- Leaflet 1.9.4 (BSD-2-Clause) https://leafletjs.com/ を同梱 -->\n"
              "<style>\n" + css + "\n</style>\n<script>\n" + js + "\n</script>")
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / "index.html"
    out.write_text(src.replace(MARK, inline), encoding="utf-8")
    for f in ASSETS:
        shutil.copy(ROOT / f, dist / f)
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
        print("built: dev/index.html （テスト用。Leafletは外部参照）")

if __name__ == "__main__":
    main()
