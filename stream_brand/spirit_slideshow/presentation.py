"""Finite contact sheets and a portable local image/movie browsing page."""
from pathlib import Path
import html
import json
from PIL import Image, ImageDraw, ImageFont


def sheets(output, plan, images=None, prefix='storyboard'):
    output = Path(output)
    font = ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf', 17)
    paths = []
    for page in range((len(plan['shots']) + 8)//9):
        group = plan['shots'][page*9:(page+1)*9]
        sheet = Image.new('RGB', (1440, 894), '#080f1b')
        draw = ImageDraw.Draw(sheet)
        for j, shot in enumerate(group):
            if images is None:
                with Image.open(output / shot['file']) as source:
                    pic = source.convert('RGB').resize((480, 270), Image.Resampling.LANCZOS)
            else:
                pic = images[page*9+j].resize((480, 270), Image.Resampling.LANCZOS)
            x, y = (j % 3)*480, (j // 3)*298
            sheet.paste(pic, (x, y))
            label = f"{page*9+j+1:02} / {shot['actual_start_seconds']:.2f}s / {shot['title']}"
            draw.text((x+10, y+276), label, font=font, fill='#c6d5e5')
        path = output / f'{prefix}-{page+1}.jpg'
        sheet.save(path, quality=94)
        paths.append(path)
    return paths


def gallery(output, plan):
    output = Path(output)
    cards = []
    for j, s in enumerate(plan['shots']):
        cards.append(f'<button class="card" data-index="{j}"><img loading="lazy" src="{html.escape(s["file"])}" alt="{html.escape(s["title"])}"><span>{j+1:02} · {s["actual_start_seconds"]:.2f}s · {html.escape(s["title"])}</span></button>')
    data = json.dumps(plan['shots']).replace('</', '<\\/')
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sanctuary · Slideshow 01</title><style>
    *{box-sizing:border-box}body{margin:0;background:#080d16;color:#dae4ee;font:16px/1.5 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:26px}h1{font-size:26px;font-weight:600;margin:0 0 8px}p{color:#9eb0c4;margin:0 0 20px}video{width:100%;max-height:78vh;background:#000;border-radius:8px}details{margin:32px 0}summary{cursor:pointer;font-size:21px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{padding:0;background:#111c2b;border:1px solid #263346;border-radius:6px;overflow:hidden;text-align:left;color:inherit;cursor:pointer}.card img{width:100%;display:block}.card span{display:block;padding:9px;font-size:14px}dialog{border:1px solid #2d4560;background:#080d16;color:inherit;padding:14px;width:min(96vw,1500px)}dialog::backdrop{background:#000c}#full{display:block;width:100%;max-height:80vh;object-fit:contain}nav{display:flex;gap:12px;align-items:center;justify-content:space-between;padding-top:12px}nav button{background:#182b41;color:white;padding:8px 16px;border:1px solid #35506f;border-radius:5px;cursor:pointer}@media(max-width:750px){main{padding:12px}.grid{grid-template-columns:1fr 1fr}.card span{font-size:12px}}
    </style><main><h1>Sanctuary · Slideshow 01</h1><p>34 illustrated moments · 40 seconds · Bear / Turtle / Ram / Phoenix</p><video controls preload="metadata" poster="images/30-wings-unfurl.png" src="sanctuary-slideshow-40s.mp4"></video><details open><summary>Browse the original images</summary><p>Click a picture to enlarge. Use left / right arrows to move through the story.</p><section class="grid">CARDS</section></details></main><dialog id="viewer"><img id="full"><nav><button id="previous">← Previous</button><span id="caption"></span><button id="next">Next →</button><button id="close">Close</button></nav></dialog><script>
    const shots=DATA,viewer=document.getElementById('viewer'),full=document.getElementById('full'),caption=document.getElementById('caption');let index=0;
    function show(i){index=Math.max(0,Math.min(shots.length-1,i));full.src=shots[index].file;full.alt=shots[index].title;caption.textContent=`${index+1} / 34 · ${shots[index].actual_start_seconds.toFixed(2)}s · ${shots[index].title}`;if(!viewer.open)viewer.showModal()}
    for(const c of document.querySelectorAll('.card'))c.addEventListener('click',()=>show(Number(c.dataset.index)));
    document.getElementById('previous').onclick=()=>show(index-1);document.getElementById('next').onclick=()=>show(index+1);document.getElementById('close').onclick=()=>viewer.close();
    document.addEventListener('keydown',e=>{if(!viewer.open)return;if(e.key==='ArrowLeft'){e.preventDefault();show(index-1)}if(e.key==='ArrowRight'){e.preventDefault();show(index+1)}});
    </script></html>'''.replace('CARDS', ''.join(cards)).replace('DATA', data)
    document = document.replace('Slideshow 01', plan.get('version_label', 'Slideshow 01'))
    document = document.replace('34 illustrated moments', f"{len(plan['shots'])} illustrated moments")
    document = document.replace('${index+1} / 34', '${index+1} / ${shots.length}')
    document = document.replace('images/30-wings-unfurl.png', plan.get('poster', 'images/30-wings-unfurl.png'))
    (output / 'gallery.html').write_text(document, encoding='utf-8')
