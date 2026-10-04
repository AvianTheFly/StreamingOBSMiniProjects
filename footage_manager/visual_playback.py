"""Pixel evidence for full-screen browser playback, independent of game OCR."""


def player_visible(image):
    """Require paired pause bars and a nearby seek line at the screen's foot.

    Embedded players and normal game HUDs do not fill this corner. Controls
    auto-hide; chronology extends positive evidence across the same HUD run.
    """
    import cv2
    import numpy as np
    h,w=image.shape[:2]
    if w<650 or w/h>4:
        return False
    scale=h/720
    area=image[int(h*.94):]
    bright=((area.min(axis=2)>130)&
            (area.max(axis=2)-area.min(axis=2)<70)).astype(np.uint8)
    _,_,stats,_=cv2.connectedComponentsWithStats(bright[:,:max(24,int(w*.03))])
    bars=[s for s in stats[1:] if scale<=s[2]<=6*scale and 5*scale<=s[3]<=15*scale
          and s[3]>s[2]*1.3 and s[4]>=s[2]*s[3]*.65]
    for left in bars:
        for right in bars:
            if (3*scale<=right[0]-left[0]<=10*scale and
                    abs(left[1]-right[1])<=2*scale and abs(left[3]-right[3])<=2*scale):
                line=cv2.morphologyEx(bright,cv2.MORPH_OPEN,
                    np.ones((1,max(20,round(w*.04))),np.uint8))
                _,_,lines,_=cv2.connectedComponentsWithStats(line)
                center=left[1]+left[3]/2
                return any(s[0]>w*.02 and s[2]>=w*.04 and s[3]<=5*scale
                           and abs(s[1]+s[3]/2-center)<=3*scale for s in lines[1:])
    return False
