"""
How deck-assets/architecture-2026-09-24.png was made (24 Sep 2026). Kept for the
record; the deck script uses the PNG, not this file.

Input: ppt/media/image24.png from the team's deck (the slide-3 architecture
picture, 1597x799). Fonts: Inter 400/600 from Google Fonts. Each wrong label is
located by its ink, removed with OpenCV inpainting (no streaks), and the new
label rendered at 4x and downsampled, sized to match the old label's width and
placed on its baseline. Paths below are the cloud session's scratch paths.
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, cv2
SRC='s3_Freeform_6.png'; OUT='arch_patched2.png'
img=Image.open(SRC).convert('RGBA'); A=np.array(img)
F={w:f'/tmp/finexdeck/inter-{w}.ttf' for w in (400,500,600,700)}
SS=4  # supersample factor

def detect(x0,y0,x1,y1,thr=70):
    reg=A[y0:y1,x0:x1,:3].astype(int); bg=np.median(reg.reshape(-1,3),axis=0)
    ink=np.abs(reg-bg).sum(axis=2)>thr
    rows=np.where(ink.any(axis=1))[0]; out=[]; start=None; prev=None
    for r in rows:
        if start is None: start=r
        elif r!=prev+1: out.append((start,prev)); start=r
        prev=r
    if start is not None: out.append((start,prev))
    return [(int(x0+np.where(ink[a:b+1].any(axis=0))[0].min()), int(y0+a), int(x0+np.where(ink[a:b+1].any(axis=0))[0].max()), int(y0+b)) for a,b in out]

def render(s, weight, size_px):
    """Text rendered at SS× and downsampled: (alpha array, ink bbox in final px)."""
    f=ImageFont.truetype(F[weight], size_px*SS)
    W=int(len(s)*size_px*SS*0.9)+40*SS; H=int(size_px*SS*2)
    im=Image.new('L',(W,H),0); ImageDraw.Draw(im).text((10*SS,int(size_px*SS*0.4)),s,font=f,fill=255)
    im=im.resize((W//SS,H//SS),Image.LANCZOS)
    a=np.array(im).astype(float)/255.0
    ys,xs=np.where(a>0.25)
    return a,(xs.min(),ys.min(),xs.max(),ys.max())

def fit(s, weight, target_w):
    best=None
    for t in range(80,200):
        size=t/10; a,(x0,y0,x1,y1)=render(s,weight,size); w=x1-x0+1
        if best is None or abs(w-target_w)<abs(best[1]-target_w): best=(size,w)
    return best[0]

def patch(box, old, new, weight, align):
    global A
    x0,y0,x1,y1=box
    size=fit(old,weight,x1-x0+1)
    reg=A[y0:y1+1,x0:x1+1,:3].astype(int).reshape(-1,3); lum=reg.sum(axis=1)
    col=np.median(reg[lum<=np.percentile(lum,12)],axis=0)*(0.80 if weight==400 else 0.92)
    # inpaint the old ink (and where the new text will sit) from its surroundings
    a_new,(nx0,ny0,nx1,ny1)=render(new,weight,size); nw=nx1-nx0+1
    a_old,(ox0,oy0,ox1,oy1)=render(old,weight,size)
    left = int(round((x0+x1)/2 - nw/2)) if align=='center' else x0
    mask=np.zeros(A.shape[:2],np.uint8)
    mask[y0-2:y1+3, min(x0,left)-2:max(x1,left+nw)+3]=255
    bgr=cv2.cvtColor(A[:,:,:3],cv2.COLOR_RGB2BGR)
    fixed=cv2.inpaint(bgr,mask,5,cv2.INPAINT_TELEA)
    A[:,:,:3]=cv2.cvtColor(fixed,cv2.COLOR_BGR2RGB)
    # composite the new text: its ink-top aligned to the old ink-top (same baseline for same font)
    top = y0 - (oy0 - ny0) if True else y0
    oxs = left - nx0; oys = y0 - oy0
    h,w=a_new.shape
    for yy in range(h):
        Y=yy+oys
        if Y<0 or Y>=A.shape[0]: continue
        for xx in range(w):
            al=a_new[yy,xx]
            if al<=0.01: continue
            X=xx+oxs
            if 0<=X<A.shape[1]:
                A[Y,X,:3]=np.clip((1-al)*A[Y,X,:3]+al*col,0,255)
    return size

jobs=[]
c1=detect(982,718,1114,758); c2=detect(1130,718,1262,758); c4=detect(1426,718,1556,758)
jobs+=[(c1[0],'Case Database','Case Files',600,'center'),(c1[1],'(case details, status)','(committed JSON)',400,'center'),
       (c2[0],'Transaction Database','Chain Reads',600,'center'),(c2[1],'(on-chain data)','(cached, SHA-256)',400,'center'),
       (c4[0],'Evidence Repository','Evidence Packets',600,'center'),(c4[1],'(reports, graphs, logs)','(reports, hashes)',400,'center')]
dex=[b for b in detect(1290,276,1545,350) if b[2]-b[0]>20]; ins=[b for b in detect(1290,364,1545,452) if b[2]-b[0]>20]
jobs+=[(dex[0],'DEX Metrics','OFAC SDN List',600,'left'),(dex[1],'• Cluster data','• Sanctioned addresses',400,'left'),(dex[2],'• DEX activity','• 20 assets screened',400,'left'),
       (ins[0],'InsightX (Future)','Explorer Tags',600,'left'),(ins[1],'• Multi-chain support','• Tagged exchange wallets',400,'left'),
       (ins[2],'• (sol, eth, bsc, base, monad, xlayer, abs)','• Seeds for sweep clustering',400,'left'),(ins[3],'• Tags (exchange, team, lp, bots, etc.)','• 15 seeds, source-linked',400,'left')]
api=[b for b in detect(488,258,640,300) if b[2]-b[0]>20]
jobs+=[(api[0],'(/api/trace, /api/cases,','(/api/trace, /api/screen,',400,'left'),(api[1],'/test-trongrid, etc.)','/api/tx, etc.)',400,'left')]
jobs+=[((824,747,909,758),'(Excel Download)','(CSV Download)',400,'center')]
for box,old,new,w,al in jobs: print(f'{new!r:32}', patch(box,old,new,w,al))
Image.fromarray(A,'RGBA').save(OUT)
