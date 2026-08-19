import json, math, numpy as np, gzip, collections
from scipy.spatial import cKDTree
M=111320.0; lat0=35.7268; K=math.cos(math.radians(lat0))
R=json.load(open("roads.geojson",encoding="utf-8"))
C=np.load("cent.npy")
to_m=lambda p:(p[0]*M*K, p[1]*M)
def lines_of(g):
    if not g: return []
    t=g["type"]; c=g["coordinates"]
    if t=="LineString": return [c]
    if t=="MultiLineString": return c
    if t=="Polygon": return c
    if t=="MultiPolygon": return [r for poly in c for r in poly]
    return []
EXCLUDE={"motorway","motorway_link","trunk","trunk_link","proposed","construction","raceway"}

# ---- 25m 前後のセグメントに分割 ----
SEG=25.0
segs=[]   # (lat1,lng1,lat2,lng2, highway)
for f in R["features"]:
    hw=f["properties"].get("highway","")
    if hw in EXCLUDE: continue
    if f["properties"].get("area")=="yes": continue
    for ln in lines_of(f.get("geometry")):
        # 連結して等間隔に切る
        acc=[]; 
        for i in range(1,len(ln)):
            a=ln[i-1]; b=ln[i]
            am=to_m(a); bm=to_m(b)
            d=math.hypot(bm[0]-am[0], bm[1]-am[1])
            n=max(1,int(round(d/SEG)))
            for k in range(n):
                t0=k/n; t1=(k+1)/n
                p0=(a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0)
                p1=(a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1)
                segs.append((p0,p1,hw))
print(f"セグメント数（{SEG:.0f}m刻み）: {len(segs):,}")

# ---- 建物が近くにあるセグメントだけ「配布対象」にする ----
btree=cKDTree(C)
mids=np.array([( (s[0][0]+s[1][0])/2*M*K, (s[0][1]+s[1][1])/2*M ) for s in segs])
cnt=btree.query_ball_point(mids, r=30.0, workers=-1, return_length=True)
useful=[i for i,n in enumerate(cnt) if n>0]
print(f"30m以内に建物があるセグメント: {len(useful):,} ({100*len(useful)/len(segs):.1f}%)")
bytype=collections.Counter(segs[i][2] for i in useful)
print("  内訳:", ", ".join(f"{k}={v}" for k,v in bytype.most_common(8)))
drop=collections.Counter(segs[i][2] for i in range(len(segs)) if cnt[i]==0)
print("  除外された（建物なし）:", ", ".join(f"{k}={v}" for k,v in drop.most_common(6)))

# ---- 配信用のコンパクト形式 ----
# [ typeIdx, lat1e5, lng1e5, dlat, dlng ]  を平坦な整数配列にする
TYPES=sorted({s[2] for s in segs})
ti={t:i for i,t in enumerate(TYPES)}
flat=[]
for i in useful:
    p0,p1,hw=segs[i]
    a=(round(p0[1]*1e5), round(p0[0]*1e5))
    b=(round(p1[1]*1e5), round(p1[0]*1e5))
    flat += [ti[hw], a[0], a[1], b[0]-a[0], b[1]-a[1]]
payload={"types":TYPES,"seg":flat}
raw=json.dumps(payload,separators=(",",":")).encode()
gz=gzip.compress(raw,9)
print(f"\n配信データ: 生 {len(raw)/1024:.0f} KB / gzip {len(gz)/1024:.0f} KB  （元のgeojson {len(open('roads.geojson','rb').read())/1024:.0f} KB）")
print(f"7.17km²あたり。半径1.5kmの円(7.1km²)ならほぼ同じ。")
open("seg.json","wb").write(raw)
