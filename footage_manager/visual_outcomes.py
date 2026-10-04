"""Result-screen evidence, distinct from browser images and match-history rows."""
import re


def result_words(text):
    return set(re.findall(r'\b(VICTORY|DEFEAT)\b',text.upper()))


def result_word(text):
    words=result_words(text)
    return next(iter(words)).lower() if len(words)==1 else None


def masked_result_words(text):
    """Candidate clipped titles; callers must validate their client context."""
    patterns={'victory':r'\b[I1]CTORY\b','defeat':r'\bEFEAT\b'}
    return {word for word,pattern in patterns.items() if re.search(pattern,text.upper())}


def masked_result_word(text):
    words=masked_result_words(text)
    return next(iter(words)) if len(words)==1 else None


def _queue_type(text):
    normalized=re.sub(r'[^A-Z0-9]','',text.upper())
    return ('RANKED' in normalized and ('SOLO' in normalized or 'FLEX' in normalized)
            or 'DRAFTPICK' in normalized or 'BLINDPICK' in normalized or 'ARAM' in normalized)


def _current_client_panel(readings, heading, height, scale):
    """Require aligned result-header controls and a button inside that panel."""
    box,_,_=heading
    left,right=min(p[0] for p in box),max(p[0] for p in box)
    center=(min(p[1] for p in box)+max(p[1] for p in box))/2
    unit=height*scale
    for details,caption,_ in readings:
        if re.sub(r'[^A-Z]','',caption.upper())!='VIEWADVANCEDDETAILS':
            continue
        edge=max(p[0] for p in details)
        row=(min(p[1] for p in details)+max(p[1] for p in details))/2
        if min(p[0] for p in details)<=right or abs(row-center)>unit*.025:
            continue
        for button,label,_ in readings:
            if re.sub(r'[^A-Z]','',label.upper()) not in ('CONTINUE','PLAYAGAIN'):
                continue
            x=(min(p[0] for p in button)+max(p[0] for p in button))/2
            y=(min(p[1] for p in button)+max(p[1] for p in button))/2
            if left<x<edge and unit*.2<y-center<unit*.8:
                return True
    return False


def include_top_client_heading(readings, top_readings, *, top_left, details_left,
                               height=720, top_scale=1.25, details_scale=1.5):
    """Join the fixed top crop to client controls in one coordinate system.

    Moving-banner crops have unrelated origins and must not be passed here.
    Existing result headings take precedence, including ambiguous history rows.
    """
    if any(result_words(caption) or masked_result_words(caption) for _,caption,_ in readings):
        return readings
    headings=[]
    for box,caption,score in top_readings:
        if not (result_words(caption) or masked_result_words(caption)):
            continue
        mapped=[[(x/top_scale+top_left-details_left)*details_scale,
                 y/top_scale*details_scale] for x,y in box]
        heading=(mapped,caption,score)
        if _current_client_panel(readings,heading,height,details_scale):
            headings.append(heading)
    return [*readings,*headings]


def result_outcome(readings, text, *, desktop=False, top_text='', continued=False,
                   height=720, scale=1.5):
    """Accept a game banner or a current client result, not arbitrary desktop text."""
    repaired=[]
    for box,caption,score in readings:
        masked=masked_result_word(caption)
        if (masked and not result_word(caption) and
                _current_client_panel(readings,(box,caption,score),height,scale)):
            caption=masked.upper()
            text+=' '+caption
        repaired.append((box,caption,score))
    readings=repaired
    header=re.sub(r'[^A-Z0-9]','',top_text.upper())
    browser=any(marker in header for marker in
                ('REDDIT','TWITCHTV','YOUTUBECOM','GOOGLECHROME','MICROSOFTEDGE','HTTP'))
    banners=set()
    labels=[]
    for box,label,_ in readings:
        word=result_word(label)
        if word is None:
            continue
        labels.append(word)
        if (max(point[1] for point in box)-min(point[1] for point in box))/scale>=height*.04:
            banners.add(word)
    if len(banners)>1:
        return None
    word=next(iter(banners)) if banners else result_word(text)
    if word is None:
        return None
    matching=[row for row in readings if result_word(row[1])==word]
    heading=max(matching,key=lambda row:max(p[1] for p in row[0])-min(p[1] for p in row[0])) if matching else None
    # A native result client can cover a browser while its chrome stays visible.
    # The queue subtitle is sometimes cropped; the header and panel controls
    # provide independent local evidence. A result word alone remains neutral.
    client=len(labels)==1 and heading is not None and _current_client_panel(readings,heading,height,scale)
    if browser:
        return word if client else None
    if client:
        return word
    if not desktop or continued:
        return word if banners or continued or len(labels)<=1 else None
    # A client queue label sits under its result heading. A persistent OBS rank
    # overlay elsewhere cannot validate a result word in another desktop app.
    if not banners and len(labels)!=1:
        return None
    if heading is None:
        return None
    box,label,_=heading
    if _queue_type(label):
        return word
    left,right=min(p[0] for p in box),max(p[0] for p in box)
    bottom=max(p[1] for p in box)
    nearby=[]
    for other,caption,_ in readings:
        gap=min(p[1] for p in other)-bottom
        if (0<=gap<=height*scale*.06 and
                max(left,min(p[0] for p in other))<min(right,max(p[0] for p in other))):
            nearby.append(caption)
    return word if _queue_type(' '.join(nearby)) else None
