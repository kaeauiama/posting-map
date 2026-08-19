import json, math, collections, numpy as np
from scipy.spatial import cKDTree
M=111320.0
R=json.load(open("roads.geojson",encoding="utf-8"))
B=json.load(open("buildings.geojson",encoding="utf-8"))
lat0=35.7268; K=math.cos(math.radians(lat0))
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
STREETS={"residential","unclassified","living_street","tertiary","secondary","primary",
         "tertiary_link","secondary_link","primary_link","pedestrian"}
def densify(pred, step=2.0):
    pts=[]
    for f in R["features"]:
        hw=f["properties"].get("highway","")
        if not pred(hw): continue
        for ln in lines_of(f.get("geometry")):
            for i in range(1,len(ln)):
                a=to_m(ln[i-1]); b=to_m(ln[i])
                d=math.hypot(b[0]-a[0], b[1]-a[1]); n=max(1,int(d/step))
                for k in range(n+1):
                    t=k/n; pts.append((a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t))
    return np.array(pts)
cent=[]; btype=collections.Counter()
for f in B["features"]:
    g=f.get("geometry")
    if not g: continue
    rings=[]
    if g["type"]=="Polygon": rings=[g["coordinates"][0]]
    elif g["type"]=="MultiPolygon": rings=[poly[0] for poly in g["coordinates"]]
    elif g["type"]=="Point": rings=[[g["coordinates"]]]
    for r in rings:
        xs=[p[0] for p in r]; ys=[p[1] for p in r]
        cent.append(to_m([sum(xs)/len(xs), sum(ys)/len(ys)]))
    btype[f["properties"].get("building","yes")]+=1
C=np.array(cent)
print(f"建物（重心）: {len(C):,} 件")
print("建物タグ上位:", ", ".join(f"{k}={v}" for k,v in btype.most_common(8)))
res={}
for label,pred in [("全道路（高速・国道系を除く）", lambda h: h not in EXCLUDE),
                   ("街路のみ（service/footway/path/stepsを除く）", lambda h: h in STREETS)]:
    P=densify(pred); tree=cKDTree(P)
    d,_=tree.query(C, workers=-1); res[label]=d
    print(f"\n■ {label}   道路サンプル点 {len(P):,}")
    for th in [10,20,30,40,50,75,100]:
        print(f"   {th:3d}m以内: {100*np.mean(d<=th):5.1f}%   ({int(np.sum(d<=th)):,}件)")
    print(f"   中央値 {np.median(d):.1f}m / 平均 {d.mean():.1f}m / 90%点 {np.percentile(d,90):.1f}m / 最大 {d.max():.0f}m")
    far=int(np.sum(d>40))
    print(f"   40m超（道が無い疑い）: {far:,}件 = {100*far/len(d):.1f}%")
np.save("dist_all.npy", res["全道路（高速・国道系を除く）"])
np.save("dist_streets.npy", res["街路のみ（service/footway/path/stepsを除く）"])
np.save("cent.npy", C)
