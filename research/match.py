import json, math, random, numpy as np, collections
from scipy.spatial import cKDTree
M=111320.0; lat0=35.7268; K=math.cos(math.radians(lat0))
R=json.load(open("roads.geojson",encoding="utf-8"))
to_m=lambda lng,lat:(lng*M*K, lat*M)
def lines_of(g):
    if not g: return []
    t=g["type"]; c=g["coordinates"]
    if t=="LineString": return [c]
    if t=="MultiLineString": return c
    if t=="Polygon": return c
    if t=="MultiPolygon": return [r for poly in c for r in poly]
    return []
EXCLUDE={"motorway","motorway_link","trunk","trunk_link","proposed","construction","raceway"}

SEG=25.0
segs=[]; owner=[]
for f in R["features"]:
    hw=f["properties"].get("highway","")
    if hw in EXCLUDE or f["properties"].get("area")=="yes": continue
    wid=f["properties"].get("@id","?")
    for ln in lines_of(f.get("geometry")):
        for i in range(1,len(ln)):
            a=ln[i-1]; b=ln[i]
            am=to_m(*a); bm=to_m(*b)
            d=math.hypot(bm[0]-am[0], bm[1]-am[1]); n=max(1,int(round(d/SEG)))
            for k in range(n):
                t0,t1=k/n,(k+1)/n
                p0=to_m(a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0)
                p1=to_m(a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1)
                segs.append((p0,p1)); owner.append((wid,hw))
S=np.array(segs)                      # (N,2,2)
A=S[:,0,:]; Bp=S[:,1,:]
mid=(A+Bp)/2
tree=cKDTree(mid)
segdir=np.arctan2(Bp[:,1]-A[:,1], Bp[:,0]-A[:,0])
print(f"セグメント {len(segs):,}")

def pt_seg_dist(p, i):
    a=A[i]; b=Bp[i]; v=b-a; w=p-a
    L=(v*v).sum(1)
    t=np.where(L>0,(w*v).sum(1)/np.maximum(L,1e-9),0); t=np.clip(t,0,1)
    proj=a+v*t[:,None]
    return np.hypot(*(p-proj).T)

def snap(p, heading, use_heading, tol=28.0):
    cand=tree.query_ball_point(p, r=tol+SEG)
    if not cand: return None
    cand=np.array(cand)
    d=pt_seg_dist(p, cand)
    ok=d<=tol
    if not ok.any(): return None
    cand=cand[ok]; d=d[ok]
    cost=d.copy()
    if use_heading and heading is not None:
        ang=np.abs(np.arctan2(np.sin(segdir[cand]-heading), np.cos(segdir[cand]-heading)))
        ang=np.minimum(ang, math.pi-ang)          # 向きは往復どちらでもよい
        cost = d + np.degrees(ang)*0.55            # 1度=0.55m 相当のペナルティ
    return cand[int(np.argmin(cost))]

# --- 実在の道に沿った経路を作る（residential を連結せず1本ずつ歩く想定）---
random.seed(7); np.random.seed(7)
routes=[]
for f in R["features"]:
    if f["properties"].get("highway")!="residential": continue
    for ln in lines_of(f.get("geometry")):
        pts=[to_m(*p) for p in ln]
        L=sum(math.dist(pts[i-1],pts[i]) for i in range(1,len(pts)))
        if L>=180: routes.append((f["properties"]["@id"], pts, L))
routes=routes[:60]
print(f"検証に使う実在の道: {len(routes)} 本  (合計 {sum(r[2] for r in routes)/1000:.1f} km)")

def walk_points(pts, step=11.0):
    out=[]; carry=0
    for i in range(1,len(pts)):
        a=np.array(pts[i-1]); b=np.array(pts[i]); d=math.dist(a,b)
        if d==0: continue
        t=carry
        while t<d:
            out.append(tuple(a+(b-a)*(t/d))); t+=step
        carry=t-d
    return out

for sigma in [4.0, 8.0, 15.0]:
    for use_h in [False, True]:
        hit=miss=none=0; wrongtype=collections.Counter()
        for wid,pts,_ in routes:
            truth=walk_points(pts)
            noisy=[(p[0]+np.random.normal(0,sigma), p[1]+np.random.normal(0,sigma)) for p in truth]
            prev=None
            for j,p in enumerate(noisy):
                h=None
                if j>0:
                    dx=noisy[j][0]-noisy[j-1][0]; dy=noisy[j][1]-noisy[j-1][1]
                    if math.hypot(dx,dy)>3: h=math.atan2(dy,dx)
                i=snap(np.array(p), h, use_h)
                if i is None: none+=1
                elif owner[i][0]==wid: hit+=1
                else: miss+=1; wrongtype[owner[i][1]]+=1
        tot=hit+miss+none
        print(f"GPS誤差σ={sigma:4.1f}m 方位考慮={'あり' if use_h else 'なし'}: "
              f"正解 {100*hit/tot:5.1f}%  誤マッチ {100*miss/tot:4.1f}%  未マッチ {100*none/tot:4.1f}%"
              + (f"   誤マッチ先: {dict(wrongtype.most_common(3))}" if miss else ""))
