"""CPU-only OCR and visual evidence. Models load only inside an analysis job."""
import re
from pathlib import Path
try:
    from .visual_outcomes import result_word, result_outcome, include_top_client_heading
    from .visual_playback import player_visible
    from .visual_lobby import BetweenGamesMatcher
except ImportError:
    from visual_outcomes import result_word, result_outcome, include_top_client_heading
    from visual_playback import player_visible
    from visual_lobby import BetweenGamesMatcher


def parse_hud(text):
    kda = re.search(r'(?<!\d)(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})(?!\d)', text)
    clocks = re.findall(r'(?<!\d)(\d{1,2})\s*:\s*([0-5]\d)(?!\d)', text)
    return ([int(v) for v in kda.groups()] if kda else None,
            int(clocks[-1][0])*60+int(clocks[-1][1]) if clocks else None)


def replay_text(text):
    # The animated banner sometimes splits a word or inserts punctuation.
    return 'INSTANTREPLAY' in re.sub(r'[^A-Z]', '', text.upper())


class VisualDetector:
    def __init__(self):
        import cv2
        import numpy as np
        from rapidocr_onnxruntime import RapidOCR
        self.cv, self.np = cv2, np
        cv2.setNumThreads(2)
        self.between_games = BetweenGamesMatcher(cv2)
        # Each OCR model otherwise creates a separate spinning worker pool.
        # Small HUD crops need one inference thread; keep models and thresholds.
        self.ocr = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1,
                            det_limit_side_len=480, max_side_len=960, min_side_len=30)
        reference = cv2.imread(str(Path(__file__).parent/'references/no-hud.png'))
        self.portrait = reference[4:77, 5:85] if reference is not None else None
        desktop=cv2.imread(str(Path(__file__).parent/'references/desktop-full.jpg'))
        self.desktop_logo=cv2.cvtColor(desktop[704:718,4:20],cv2.COLOR_BGR2GRAY) if desktop is not None else None

    def desktop_visible(self, image):
        """Recognize the Windows taskbar separately from a persistent OBS portrait."""
        if self.desktop_logo is None:
            return False
        cv=self.cv;h,w=image.shape[:2]
        area=cv.cvtColor(image[int(h*.94):,:max(32,int(w*.04))],cv.COLOR_BGR2GRAY)
        for width in (12,16,20,24):
            template=cv.resize(self.desktop_logo,(width,round(width*self.desktop_logo.shape[0]/self.desktop_logo.shape[1])))
            if template.shape[0]<=area.shape[0] and template.shape[1]<=area.shape[1]:
                if cv.minMaxLoc(cv.matchTemplate(area,template,cv.TM_CCOEFF_NORMED))[1]>.93:
                    return True
        return False

    def context(self, image):
        """Cheap context refresh preserves compatible HUD/result OCR work."""
        return {'player':player_visible(image),'desktop':self.desktop_visible(image),
                'playback_context':1}

    def read(self, image, scale=2):
        if not image.size:
            return []
        cv = self.cv
        image = cv.resize(image,None,fx=scale,fy=scale)
        result, _ = self.ocr(image, use_cls=False)
        return [(box, text, float(score)) for box,text,score in (result or []) if score >= .65]

    def line(self, image):
        if not image.size:
            return ''
        result,_=self.ocr(self.cv.resize(image,None,fx=3,fy=3),use_det=False,use_cls=False)
        return ' '.join(text for text,score in (result or []) if score>=.7)

    def observe(self, image, second=0):
        cv, np = self.cv, self.np
        h,w = image.shape[:2]
        context=self.context(image)
        # Cropped references can be tested through the same text policy.
        if w/h > 4 or w < 650:
            text = ' '.join(t for _,t,_ in self.read(image))
            kda, clock = parse_hud(text)
            return {'time':second,'active':kda is not None and clock is not None,'kda':kda,'clock':clock,
                    'continue':'CONTINUE' in text.upper(), 'loading':'LOADOUT' in text.upper(),
                    'replay':replay_text(text),
                    'outcome':result_word(text),
                    'no_hud':False, 'evidence':text, **context}
        # The two fixed HUD fields are text lines: direct recognition avoids running
        # a text detector on every sampled frame of a multi-hour stream.
        hud_height=max(20,int(h*.032))
        hud_text = self.line(image[:hud_height,int(w*.858):int(w*.91)])+' '+self.line(image[:hud_height,int(w*.953):])
        kda, clock = parse_hud(hud_text)
        active = kda is not None and clock is not None
        if not active and self.between_games.matches(image):
            # The supplied background is a useful approximate lobby marker.
            # Read only the small upper client area for a possible result, then
            # skip banner, button, full-scene OCR and portrait searches.
            details = self.read(image[:int(h*.30),int(w*.23):],1.25)
            text = ' '.join(t for _,t,_ in details).upper()
            outcome = result_outcome(details,text,desktop=context['desktop'],
                                     top_text=text,continued=False,height=h)
            return {'time':second,'active':False,'clock':clock,'kda':kda,
                    'between_games':True,'continue':False,'outcome':outcome,
                    'loading':False,'no_hud':False,'replay':False,**context,
                    'evidence':('Likely between games: reference background. '+text)[:1200]}
        # Replays retain the same HUD; the banner must be checked even during gameplay.
        top_image=image[:int(h*.19),int(w*.18):int(w*.82)]
        # The banner animates upward through the middle before settling at the top.
        banner_area=image[:int(h*.8),int(w*.18):int(w*.82)]
        hsv_top=cv.cvtColor(banner_area,cv.COLOR_BGR2HSV)
        gold=((hsv_top[:,:,0]>5)&(hsv_top[:,:,0]<35)&(hsv_top[:,:,1]>100)&(hsv_top[:,:,2]>170)).astype(np.uint8)
        _,_,stats,_=cv.connectedComponentsWithStats(cv.dilate(gold,np.ones((5,15),np.uint8)))
        banners=[s for s in stats[1:] if 150<s[cv.CC_STAT_WIDTH]<w*.5 and 20<s[cv.CC_STAT_HEIGHT]<h*.2]
        top = self.read(top_image,1.25) if not active else []
        header_readings=list(top)
        for x,y,bw,bh,_ in banners:
            if active or y>h*.19:
                top.extend(self.read(banner_area[max(0,y-8):y+bh+8,max(0,x-8):x+bw+8],1.5))
        top_text = ' '.join(t for _,t,_ in top).upper()
        replay = replay_text(top_text)
        loading = 'LOADOUT' in top_text or ('PREPARE' in top_text and 'YOUR' in top_text)
        outcome, cont, no_hud, desktop, details = None, False, False, context['desktop'], []
        if not active:
            button_area=image[int(h*.25):int(h*.86),int(w*.25):int(w*.76)]
            button_hsv=cv.cvtColor(button_area,cv.COLOR_BGR2HSV)
            red=(((button_hsv[:,:,0]<12)|(button_hsv[:,:,0]>170))&(button_hsv[:,:,1]>120)&(button_hsv[:,:,2]>120)).astype(np.uint8)
            _,_,button_stats,_=cv.connectedComponentsWithStats(cv.dilate(red,np.ones((3,5),np.uint8)))
            button_text=[]
            for x,y,bw,bh,area_size in button_stats[1:]:
                if 45<bw<220 and 8<bh<50 and 2.4<bw/bh<7:
                    crop=button_area[max(0,y-3):y+bh+3,max(0,x-3):x+bw+3]
                    button_text.append(self.line(crop))
            # Include the enlarged lobby/client in the right of the stream presentation.
            # The rounded lobby mask can place the result title above 6% of the
            # frame. Keep the top edge so its header/control context is readable.
            details = self.read(image[:int(h*.9),int(w*.23):],1.5)
            details=include_top_client_heading(details,header_readings,
                top_left=int(w*.18),details_left=int(w*.23),height=h)
            text = ' '.join([top_text]+[t for _,t,_ in details]+button_text).upper()
            replay = replay or replay_text(text)
            # Cursor commonly obscures the first letters of this button.
            cont = any('CONTINUE' in t.upper() or 'NTINUE' in t.upper() or 'VTINUE' in t.upper() for t in button_text)
            # Browser images/history rows are not current game results.
            outcome=result_outcome(details,text,desktop=desktop,top_text=top_text,
                                   continued=cont,height=h)
            # Loading screen card borders: ten cards arranged as two rows of five.
            hsv = cv.cvtColor(image,cv.COLOR_BGR2HSV)
            purple = ((hsv[:,:,0]>125)&(hsv[:,:,0]<165)&(hsv[:,:,1]>70)&(hsv[:,:,2]>90)).astype(np.uint8)
            margin=max(4,int(w*.025))
            lines = [float(purple[:int(h*.9),max(0,int(w*x)-margin):min(w,int(w*x)+margin)].mean(axis=0).max()) for x in (.01,.20,.40,.60,.80,.99)]
            interiors=[float(purple[:int(h*.9),max(0,int(w*x)-2):int(w*x)+2].mean()) for x in (.1,.3,.5,.7,.9)]
            # Loading borders concentrate purple in narrow columns. A flat purple
            # camera-off/background scene has the same color inside those columns.
            loading = loading or (sum(v>.14 for v in lines)>=4 and float(purple.mean())>.025
                                  and float(np.median(lines))>max(.14,float(np.median(interiors))*2))
            if self.portrait is not None and not loading and not outcome:
                area = image[int(h*.80):,int(w*.30):int(w*.74)]
                for width in (48,56,64,72,80):
                    template=cv.resize(self.portrait,(width,round(width*self.portrait.shape[0]/self.portrait.shape[1])))
                    if template.shape[0]>area.shape[0]:
                        continue
                    _,score,_,pos=cv.minMaxLoc(cv.matchTemplate(area,template,cv.TM_CCOEFF_NORMED))
                    if score>.70:
                        # A real HUD has bright health/mana and spell slots next to the portrait.
                        x,y=pos; adjacent=area[y:y+template.shape[0],x+width:x+width+220]
                        if adjacent.size:
                            a=cv.cvtColor(adjacent,cv.COLOR_BGR2HSV)
                            bars=((a[:,:,0]>35)&(a[:,:,0]<125)&(a[:,:,1]>100)&(a[:,:,2]>160)).mean()
                            no_hud=bars<.035
                        break
                if not no_hud:
                    # Generic champion portrait fallback when this is a different Udyr skin.
                    circles=cv.HoughCircles(cv.cvtColor(area,cv.COLOR_BGR2GRAY),cv.HOUGH_GRADIENT,1,70,
                                            param1=90,param2=25,minRadius=20,maxRadius=42)
                    for x,y,radius in (circles[0] if circles is not None else []):
                        x,y,radius=int(x),int(y),int(radius)
                        if y+radius<area.shape[0]-25:
                            continue
                        adjacent=area[max(0,y-radius):min(area.shape[0],y+radius),x+radius:x+radius+180]
                        if adjacent.shape[1]<100:
                            continue
                        a=cv.cvtColor(adjacent,cv.COLOR_BGR2HSV)
                        bars=((a[:,:,0]>35)&(a[:,:,0]<125)&(a[:,:,1]>100)&(a[:,:,2]>160)).mean()
                        if bars<.035:
                            no_hud=True
                            break
        return {'time':second,'active':active,'clock':clock,'kda':kda,'continue':cont,'outcome':outcome,
                'loading':bool(loading),'no_hud':bool(no_hud),'replay':bool(replay),
                **context,
                'evidence':' '.join([hud_text,top_text]+[t for _,t,_ in details]+(button_text if not active else []))[:1200]}


class FrameReader:
    """One capture per analysis; sparse seeks avoid transcoding entire streams."""
    def __init__(self, path, duration=None):
        import cv2
        self.cv = cv2
        self.capture = cv2.VideoCapture(str(path),cv2.CAP_FFMPEG,[cv2.CAP_PROP_N_THREADS,2])
        self.duration=duration
        self.warnings=[]
        self.actual_time=None
        if not self.capture.isOpened():
            self.capture.release()
            raise ValueError('Cannot open source for visual analysis')

    def frame(self, second):
        self.capture.set(self.cv.CAP_PROP_POS_MSEC,second*1000)
        ok,image=self.capture.read()
        self.actual_time=float(second)
        if not ok and self.duration is not None and self.duration-3<=second<=self.duration:
            # Container duration can extend beyond the final video frame (audio
            # tails / truncated downloads). Keep the actual fallback timestamp.
            for offset in (.5,1.0,2.0,3.0):
                earlier=max(0,second-offset)
                self.capture.set(self.cv.CAP_PROP_POS_MSEC,earlier*1000)
                ok,image=self.capture.read()
                if ok:
                    self.actual_time=float(earlier)
                    self.warnings.append(f'No visual frame at {second:.1f}s; sampled {earlier:.1f}s near the source end.')
                    break
        if not ok:
            raise ValueError(f'Could not decode source frame at {second:.1f}s')
        if image.shape[1]>1280:
            image=self.cv.resize(image,(1280,round(image.shape[0]*1280/image.shape[1])))
        return image

    def close(self):
        self.capture.release()
