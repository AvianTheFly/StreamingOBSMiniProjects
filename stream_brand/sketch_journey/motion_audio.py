"""Original procedural contact effects for this finite animatic; no runtime audio state."""
from pathlib import Path
import json,math,shutil,wave
import numpy as np
from .motion_timeline import state,beat,HIT,RAM_HIT,BEAR_CONTACT,BEAM_LAUNCH
from .motion_rig import skeleton

RATE=48000
DURATION=40


def effects(cavein_start=None):
    rng=np.random.default_rng(5103);samples=np.zeros(RATE*DURATION,dtype=np.float32);events=[]
    def place(start,signal,kind):
        i=round(start*RATE);end=min(len(samples),i+len(signal))
        if end>i:samples[i:end]+=signal[:end-i]
        events.append({'time':round(start,5),'kind':kind})
    def thud(start,amp,freq=70,duration=.30,kind='contact'):
        t=np.arange(round(duration*RATE))/RATE
        tone=np.sin(math.tau*(freq*t-24*t*t))*np.exp(-t*15)
        crack=rng.normal(0,.30,len(t))*np.exp(-t*34)
        signal=amp*(tone+crack)*(1-np.exp(-t*1200))
        place(start,signal.astype(np.float32),kind)
    for i,start in enumerate(BEAM_LAUNCH):
        duration=.9;t=np.arange(round(duration*RATE))/RATE
        noise=rng.normal(0,1,len(t));noise=np.convolve(noise,np.ones(24)/24,mode='same')
        swell=np.sin(math.pi*t/duration)**2
        signal=.016*swell*(noise+.20*np.sin(math.tau*((180+i*37)*t+120*t*t)))
        place(start,signal.astype(np.float32),'statue energy swell')
    previous={}
    for fi in range(1200):
        p=state(fi/30);rig=skeleton(p)
        strength=max(p['bear_running'],p['ram_running'])
        for name,planted in rig['contacts'].items():
            if planted and not previous.get(name,False) and strength>.75:
                thud(fi/30,.045 if p['bear_running'] else .060,95,.14,'planted paw')
        previous=rig['contacts']
    for i in range(2):
        start=BEAR_CONTACT+i*.22;t=np.arange(round(.25*RATE))/RATE
        noise=rng.normal(0,1,len(t));high=noise-np.convolve(noise,np.ones(9)/9,mode='same')
        place(start,(.045*high*np.exp(-t*23)*(1-np.exp(-t*1500))).astype(np.float32),'lightning claw crackle')
    masonry_start=beat(31) if cavein_start is None else cavein_start
    for j in range(8):thud(masonry_start+j*.16,.022,120-j*8,.22,'loose masonry')
    thud(HIT,.13,48,.55,'ceiling onto turtle shell')
    thud(RAM_HIT,.22,58,.58,'ram contact')
    for j in range(9):thud(RAM_HIT+.06+j*.045,.018,160-j*6,.16,'broken gate stone')
    t=np.arange(len(samples))/RATE
    wind=rng.normal(0,1,len(t));wind=np.convolve(wind,np.ones(40)/40,mode='same')
    def ramp(a,b):
        q=np.clip((t-a)/(b-a),0,1);return q*q*(3-2*q)
    samples+=.025*wind*ramp(beat(54),beat(57))*(1-ramp(beat(62),beat(66)))
    thud(beat(64),.075,110,.7,'phoenix storm release')
    samples=np.clip(samples,-.8,.8)
    return samples,{'sample_rate':RATE,'duration':DURATION,'peak':float(np.max(np.abs(samples))),
        'rms':float(np.sqrt(np.mean(samples*samples))),'events':events,'origin':'original deterministic procedural synthesis'}


def write_effects(path,cavein_start=None):
    samples,info=effects(cavein_start);pcm=(samples*32767).astype('<i2')
    with wave.open(str(path),'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(pcm.tobytes())
    return info


def mix_movie(output,stem='spirit-motion-mvp',plan_name='motion-plan.json',cavein_start=None):
    from .render import run,MUSIC
    from stream_brand.intro.render import fingerprint
    output=Path(output);plan_path=output/plan_name;plan=json.loads(plan_path.read_text(encoding='utf-8'))
    if plan.get('contact_audio_applied'):return plan['contact_audio']
    before=fingerprint(MUSIC);assert before==plan['music_sha256']
    main=output/f'{stem}-40s.mp4';dry=output/f'{stem}-music-only-40s.mp4'
    shutil.copy2(main,dry);effect_path=output/'motion-foley.wav';info=write_effects(effect_path,cavein_start)
    temp=output/'motion-mixed-40s.mp4'
    run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-i',str(dry),'-i',str(effect_path),
        '-filter_complex_threads','1','-filter_complex','[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.88:level=0:latency=1[a]',
        '-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','40','-movflags','+faststart',str(temp)])
    run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(temp),'-threads','1','-f','null','-'])
    assert fingerprint(MUSIC)==before
    temp.replace(main);plan['contact_audio_applied']=True;plan['contact_audio']=info
    plan_path.write_text(json.dumps(plan,indent=2),encoding='utf-8')
    return info
