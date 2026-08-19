import json, math, collections

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)

R = json.load(open("roads.geojson", encoding="utf-8"))
B = json.load(open("buildings.geojson", encoding="utf-8"))
print("roads features   :", len(R["features"]))
print("buildings features:", len(B["features"]))

# bbox
mnx=mny=1e9; mxx=mxy=-1e9
def walk(g, fn):
    if g is None: return
    t=g["type"]; c=g["coordinates"]
    if t=="Point": fn(c)
    elif t in ("LineString","MultiPoint"):
        for p in c: fn(p)
    elif t in ("Polygon","MultiLineString"):
        for r in c:
            for p in r: fn(p)
    elif t=="MultiPolygon":
        for poly in c:
            for r in poly:
                for p in r: fn(p)
def acc(p):
    global mnx,mny,mxx,mxy
    mnx=min(mnx,p[0]); mxx=max(mxx,p[0]); mny=min(mny,p[1]); mxy=max(mxy,p[1])
for f in R["features"]: walk(f.get("geometry"), acc)
lat0=(mny+mxy)/2
M=111320.0; K=math.cos(math.radians(lat0))
w=(mxx-mnx)*M*K; h=(mxy-mny)*M
print(f"bbox: lon {mnx:.5f}..{mxx:.5f}  lat {mny:.5f}..{mxy:.5f}")
print(f"範囲 : 東西 {w/1000:.2f} km × 南北 {h/1000:.2f} km = {w*h/1e6:.2f} km²")

# road types & length
def seglen(a,b):
    return math.hypot((b[0]-a[0])*M*K, (b[1]-a[1])*M)
types = collections.Counter(); tlen = collections.Counter()
nlines=0; npts=0
for f in R["features"]:
    g=f.get("geometry");
    if not g: continue
    hw = f["properties"].get("highway","(none)")
    lines=[]
    if g["type"]=="LineString": lines=[g["coordinates"]]
    elif g["type"]=="MultiLineString": lines=g["coordinates"]
    elif g["type"]=="Polygon": lines=g["coordinates"]
    elif g["type"]=="MultiPolygon": lines=[r for poly in g["coordinates"] for r in poly]
    L=0
    for ln in lines:
        nlines+=1; npts+=len(ln)
        for i in range(1,len(ln)): L+=seglen(ln[i-1],ln[i])
    types[hw]+=1; tlen[hw]+=L
print("\n道路種別（本数 / 総延長km）")
tot=0
for k,v in types.most_common():
    print(f"  {k:16s} {v:6d}  {tlen[k]/1000:8.1f} km")
    tot+=tlen[k]
print(f"  {'合計':16s} {sum(types.values()):6d}  {tot/1000:8.1f} km")
print(f"道路密度: {tot/1000/(w*h/1e6):.1f} km/km²")
print(f"ジオメトリ点数: {npts:,}  (線 {nlines:,} 本)")
