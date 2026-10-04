"""Original short stereo spirit stings. Does not edit any saved gain or media."""
from pathlib import Path
import json
import wave
import numpy as np
RATE=48000
SPIRITS={'bear':(.86,41,98),'turtle':(.9,83,131),'ram':(.95,127,73.4),'phoenix':(.55,199,110)}

def render(spirit,follow=False):
    hit,seed,root=SPIRITS[spirit]
    duration=1.35 if follow else 3.8
    t=np.arange(round(duration*RATE))/RATE
    random=np.random.default_rng(seed)
    noise=random.normal(0,1,len(t))
    wind=np.convolve(noise,np.ones(48)/48,mode='same')
    signal=np.zeros(len(t))
    score=[(.03,root*8,.5),(.14,root*12,.5)] if follow else [(.08,root*2,.7),(.32,root*3,.6),(hit,root*4,1.3),(hit+.04,root*5,1.2),(hit+.09,root*6,1.2),(1.75,root*8,.7),(2,root*12,.8),(2.35,root*16,.85)]
    for at,freq,length in score:
        age=np.maximum(0,t-at);env=(t>=at)*np.minimum(1,age/.02)*np.exp(-age*4)*np.minimum(1,np.maximum(0,length-age)/.12)
        signal+=(np.sin(2*np.pi*freq*age)+.15*np.sin(2*np.pi*freq*2*age))*env*.13
    if not follow:
        age=np.maximum(0,t-hit)
        signal+=np.sin(2*np.pi*(root*.75*age-15*age**2))*np.exp(-age*8)*(t>=hit)*.27
        if spirit=='bear':signal+=wind*np.exp(-((t-.74)/.2)**2)*.85+wind*np.exp(-age*24)*(t>=hit)*.35
        elif spirit=='turtle':signal+=wind*np.exp(-((t-.3)/.3)**2)*.35+np.sin(2*np.pi*root*10*t)*np.exp(-((t-1.1)/.5)**2)*.025
        elif spirit=='ram':signal+=wind*np.exp(-((t-.7)/.16)**2)*.65+noise*np.exp(-age*80)*(t>=hit)*.06
        else:signal+=wind*np.exp(-((t-.5)/.25)**2)*.7+wind*np.exp(-((t-1.2)/.5)**2)*.3
    fade=np.minimum(1,t/.02)*np.minimum(1,(duration-t)/.28)
    signal*=fade
    signal*= (0.23 if follow else .32)/max(.001,np.max(np.abs(signal)))
    pan=.15*np.sin(t*1.8+seed)
    stereo=np.stack([signal*(1-pan),signal*(1+pan)],axis=1)
    return stereo,duration

if __name__=='__main__':
    stats=[]
    for spirit in SPIRITS:
        for follow in (False,True):
            signal,duration=render(spirit,follow)
            file=Path(__file__).parent/'media'/f"supporter-{'follow' if follow else 'sub'}-{spirit}.wav"
            with wave.open(str(file),'wb') as out:
                out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE);out.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
            stats.append(dict(file=file.name,seconds=duration,peak_db=round(20*np.log10(np.max(np.abs(signal))),2)))
    print(json.dumps(stats))
