"""Authored mood directions and cue sheets; no settings or runtime side effects."""
from copy import deepcopy
from .score import SIGNAL_WORDS

_PRESETS = [
    dict(id='signal_found', name='Signal found', hotkey='986', style='signal',
         feeling='Longing → recognition → release', spirit='ram',
         description='35 emotional film and TV stills start changing immediately on the musical hit, without repeating. Rapid cuts slow slightly through HAVE YOU BEEN while imagery fades by 15s. Larger worn lettering cycles 23 typefaces.',
         reference='Rihanna — Where Have You Been (orchestral edit)',
         reference_url='https://www.youtube.com/watch?v=43xPFw4dzLk&t=45s',
         audio_hint='Your remix: no words before 10s; WHERE 10–12s; HAVE YOU BEEN 12–15s; ALL MY LIFE 15–18s. Word boundaries use original-file seconds and stay editable. Trim and speed preserve file-time alignment; replacement edits need their own word cue sheet.',
         bpm=96, duration=16, anchor=6,
         cuts=[0,1.5,3,4.5,6,6.55,7.1,7.65,8.2,8.75,9.3,9.85,10.4,10.95,11.5,12.05,12.6,13.15,13.7,14.5,15.2],
         words=['WHERE HAVE YOU BEEN?', 'A LIGHT IN THE DARK', 'THERE YOU ARE'],
         palette=['#84e5ec','#bdabff','#fff6dc']),
    dict(id='heart_on_sleeve', name='Heart on sleeve', hotkey='985', style='heart',
         feeling='Playful affection / dramatic devotion', spirit='bear',
         description='A little bear, a beating glass heart and floating love notes. A transparent companion to the original Love Me sequence.',
         reference='The Cardigans — Lovefool (chorus edit)',
         reference_url='https://www.capcut.com/template-detail/Song-lovefool/7481867930292997381',
         audio_hint='Use a chorus excerpt; trim start to its first vocal and put the strongest chorus accent at the cue anchor. Sped-up edits need a new BPM.',
         bpm=112, duration=12, anchor=4, cuts=[0,2,4,6,8,10],
         words=['HEART ON SLEEVE', 'A LITTLE TOO INVESTED', 'STILL HERE FOR YOU'],
         palette=['#ff9dbf','#dda7ff','#fff0df']),
    dict(id='golden', name='Golden', hotkey='984', style='golden',
         feeling='Warmth / awe / a deserved win', spirit='phoenix',
         description='A gilded phoenix rises through a sun arch, petals and miniature painted horizons. Slow, warm and spacious.',
         reference='JVKE — golden hour (piano-to-chorus edit)',
         reference_url='https://www.capcut.com/template-detail/golden-hour/7161788228884778241',
         audio_hint='Start with the piano build and align the full chorus/piano bloom to the cue anchor. The timings are an authored template, not a universal song timestamp.',
         bpm=94, duration=18, anchor=7, cuts=[0,3,5,7,9,11,13,15],
         words=['A LITTLE GOLDEN', 'LET THIS MOMENT STAY', 'YOU EARNED THIS'],
         palette=['#ffd594','#ff9978','#fff6cf']),
    dict(id='afterglow', name='Afterglow', hotkey='983', style='afterglow',
         feeling='Bittersweet / nostalgic / softly surreal', spirit='turtle',
         description='A moonlit turtle carries a tiny night garden past violet moons and drifting memory windows. Gentle dissolves, no flashing.',
         reference='Beach House — Space Song (instrumental / slowed edit)',
         reference_url='https://www.musicradar.com/artists/this-song-sounds-like-a-group-of-friends-going-their-separate-ways-forever-the-story-behind-the-2015-dream-pop-gem-that-tiktok-cant-get-enough-of',
         audio_hint='Start at the chosen synth phrase; align the emotional chord change to the cue anchor. Slowed versions require adjusting BPM and excerpt length.',
         bpm=74, duration=20, anchor=8, cuts=[0,4,8,11,14,17],
         words=['IN THE AFTERGLOW', 'SOME MOMENTS STAY', 'SOFTLY, WE GO ON'],
         palette=['#bcb0ff','#82d8d4','#ffe5d5']),
]


def presets():
    return [dict(deepcopy(item), mode='once', repeats=2, opacity=.72, scale=.85,
                 position='top', reduced_motion=False, audio_file='', audio_start=0,
                 audio_anchor=item['anchor'], audio_rate=1, volume_db=0,
                 record_audio=False, timeline_duration=item['duration'],
                 lyric_cues=deepcopy(SIGNAL_WORDS) if item['style']=='signal' else [],
                 image_onset=None, lyric_offset=0, font_interval=.12, hold_fade=.75) for item in _PRESETS]
