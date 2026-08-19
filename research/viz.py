import json, math, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from scipy.spatial import cKDTree
M=111320.0; lat0=35.7268; K=math.cos(math.radians(lat0))
R=json.load(open("roads.geojson",encoding="utf-8"))
C=np.load("cent.npy")
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
segs=[]
for f in R["features"]:
    hw=f["properties"].get("highway","")
    if hw in EXCLUDE or f["properties"].get("area")=="yes": continue
    for ln in lines_of(f.get("geometry")):
        for i in range(1,len(ln)):
            a=ln[i-1]; b=ln[i]; am=to_m(*a); bm=to_m(*b)
            d=math.hypot(bm[0]-am[0],bm[1]-am[1]); n=max(1,int(round(d/SEG)))
            for k in range(n):
                t0,t1=k/n,(k+1)/n
                segs.append([to_m(a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0),
                             to_m(a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1)])
S=np.array(segs); A=S[:,0,:]; Bp=S[:,1,:]; mid=(A+Bp)/2
seglen=np.hypot(*(Bp-A).T)
btree=cKDTree(C)
target = btree.query_ball_point(mid, r=30.0, workers=-1, return_length=True) > 0

# 商圏の円（データ範囲の中心 半径1.2km）
cx,cy=mid[:,0].mean(), mid[:,1].mean(); RAD=1200.0
inside=np.hypot(mid[:,0]-cx, mid[:,1]-cy)<=RAD

# 疑似的に「北東の3分の1だけ配り終えた」状態を作る
ang=np.arctan2(mid[:,1]-cy, mid[:,0]-cx)
covered = inside & target & (((ang>-0.35)&(ang<1.9)) | (np.hypot(mid[:,0]-cx,mid[:,1]-cy)<420))
todo = inside & target & ~covered
out  = inside & ~target

fig,ax=plt.subplots(figsize=(9.2,9.2), dpi=132)
fig.patch.set_facecolor("#ffffff")
def draw(mask,color,lw,z,label=None):
    if mask.sum()==0: return
    ax.add_collection(LineCollection(S[mask], colors=color, linewidths=lw, zorder=z,
                                     capstyle="round", label=label))
draw(~inside, "#e4e6ec", 1.0, 1)
draw(out,     "#c9ccd6", 1.4, 2, "対象外（近くに建物がない道）")
draw(covered, "#2a78d6", 2.6, 3, "配布済み")
draw(todo,    "#e34948", 3.0, 4, "未配布（配り漏れ）")
th=np.linspace(0,2*np.pi,300)
ax.plot(cx+RAD*np.cos(th), cy+RAD*np.sin(th), color="#182440", lw=1.4, ls=(0,(6,5)), zorder=5)
ax.set_aspect("equal"); ax.axis("off")
ax.set_xlim(cx-RAD*1.12, cx+RAD*1.12); ax.set_ylim(cy-RAD*1.12, cy+RAD*1.12)
kmC=seglen[covered].sum()/1000; kmT=seglen[todo].sum()/1000
pct=100*kmC/(kmC+kmT)
ax.set_title(f"商圏 半径1.2km・配布対象 {kmC+kmT:.1f}km のうち {pct:.0f}% 配布済み\n"
             f"未配布 {int(todo.sum()):,}区間 / {kmT:.1f}km",
             fontsize=13, color="#182440", pad=14,
             fontfamily=["Noto Sans CJK JP","DejaVu Sans"])
leg=ax.legend(loc="lower left", frameon=True, fontsize=10.5,
              prop={"family":["Noto Sans CJK JP","DejaVu Sans"]})
leg.get_frame().set_edgecolor("#dfe3ec")
plt.tight_layout(); plt.savefig("coverage.png", facecolor="#fff")
print(f"配布対象セグメント（半径1.2km内）: {int((covered|todo).sum()):,} / {(kmC+kmT):.1f} km")
print(f"うち未配布: {int(todo.sum()):,} 区間 / {kmT:.1f} km")
print(f"対象外（建物なし）: {int(out.sum()):,} 区間")
