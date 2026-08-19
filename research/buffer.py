import json, math, numpy as np, collections
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
            am=to_m(*a); bm=to_m(*b); d=math.hypot(bm[0]-am[0],bm[1]-am[1]); n=max(1,int(round(d/SEG)))
            for k in range(n):
                t0,t1=k/n,(k+1)/n
                segs.append((to_m(a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0),
                             to_m(a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1)))
                owner.append((wid,hw))
S=np.array(segs); A=S[:,0,:]; Bp=S[:,1,:]; mid=(A+Bp)/2
mtree=cKDTree(mid)

def cover(trace_pts, buf):
    """記録した点の集合から buf(m) 以内のセグメントを「配布済み」にする"""
    P=np.array(trace_pts)
    idx=set()
    for i in mtree.query_ball_point(P, r=buf+SEG/2, workers=-1):
        idx.update(i)
    if not idx: return set()
    idx=np.array(sorted(idx))
    a=A[idx]; b=Bp[idx]; v=b-a
    L=(v*v).sum(1); keep=[]
    for p in P:
        w=p-a
        t=np.clip(np.where(L>0,(w*v).sum(1)/np.maximum(L,1e-9),0),0,1)
        d=np.hypot(*(p-(a+v*t[:,None])).T)
        keep.append(d<=buf)
    return set(idx[np.any(keep,axis=0)].tolist())

routes=[]
for f in R["features"]:
    if f["properties"].get("highway")!="residential": continue
    for ln in lines_of(f.get("geometry")):
        pts=[to_m(*p) for p in ln]
        L=sum(math.dist(pts[i-1],pts[i]) for i in range(1,len(pts)))
        if L>=180: routes.append((f["properties"]["@id"], pts, L))
routes=routes[:42]
def walk_points(pts, step=11.0):
    out=[]; carry=0
    for i in range(1,len(pts)):
        a=np.array(pts[i-1]); b=np.array(pts[i]); d=math.dist(a,b)
        if d==0: continue
        t=carry
        while t<d: out.append(tuple(a+(b-a)*(t/d))); t+=step
        carry=t-d
    return out
own_way=np.array([o[0] for o in owner]); own_hw=np.array([o[1] for o in owner])

np.random.seed(3)
print("目的：歩いた道のセグメントを取りこぼさず（再現率）、関係ない道を巻き込まない（巻き込み距離）")
for sigma in [4.0,8.0,15.0]:
    for buf in [15.0,20.0,25.0,30.0]:
        rec=[]; extra_far=[]
        for wid,pts,_ in routes:
            truth=walk_points(pts)
            noisy=[(p[0]+np.random.normal(0,sigma), p[1]+np.random.normal(0,sigma)) for p in truth]
            got=cover(noisy, buf)
            mine=set(np.where(own_way==wid)[0].tolist())
            rec.append(len(got & mine)/max(1,len(mine)))
            # 巻き込んだ他の道が、実際に歩いた線からどれだけ離れているか
            T=np.array(truth)
            for i in got-mine:
                m=mid[i]; d=np.min(np.hypot(*(T-m).T)); extra_far.append(d)
        ef=np.array(extra_far) if extra_far else np.array([0])
        print(f"σ={sigma:4.1f}m buf={buf:4.1f}m → 再現率 {100*np.mean(rec):5.1f}%  "
              f"巻き込み {len(ef)/len(routes):5.1f}本/道  その中央距離 {np.median(ef):4.1f}m  最大 {ef.max():4.1f}m")
