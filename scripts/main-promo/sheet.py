import sys,os
from PIL import Image,ImageDraw
fs=sorted([f for f in os.listdir('pv') if f[0].isdigit()],key=lambda f:float(f[:-4]))
for part in range(0,len(fs),9):
  sub=fs[part:part+9]; W,H=640,360; sh=Image.new('RGB',(W*3,H*3))
  for i,f in enumerate(sub):
    im=Image.open('pv/'+f); im.thumbnail((W,H)); x,y=(i%3)*W,(i//3)*H; sh.paste(im,(x,y)); ImageDraw.Draw(sh).text((x+8,y+8),f[:-4],fill='yellow')
  sh.save(f'pv/sheet{part//9}.jpg',quality=80)
