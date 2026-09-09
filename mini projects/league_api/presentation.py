"""Switch presentation banks without rolling back event logic or mixer levels."""
import copy

FIELDS = {'media':'', 'audio':'', 'duration':6, 'start_time':0, 'loop':False,
          'media_pool':[], 'pool_enabled':True}
LAYOUT = {'x':1305, 'y':86, 'width':557, 'height':248}


def capture(config):
    return {'events':{key:{f:copy.deepcopy(rule.get(f,default)) for f,default in FIELDS.items()}
                      for key,rule in config['events'].items()},
            'layout':copy.deepcopy(config.get('layout', LAYOUT))}


def initialize(config, personal):
    config.setdefault('presentation', 'memes')
    config.setdefault('overlay_enabled', True)
    config.setdefault('layout', copy.deepcopy(LAYOUT))
    config.setdefault('presentations', {'memes':capture(config), 'personal':copy.deepcopy(personal)})


def switch(config, target):
    if target not in {'personal', 'memes'}:
        raise ValueError('Choose My setup or Meme pack')
    current=config['presentation']
    if target == current:
        return
    config['presentations'][current]=capture(config)
    saved=config['presentations'][target]
    for key, event in config['events'].items():
        # Rules added in one setup should not carry its media into another.
        rule=saved['events'].get(key,{})
        event.update({f:copy.deepcopy(rule.get(f,d)) for f,d in FIELDS.items()})
    config['layout']=copy.deepcopy(saved.get('layout', LAYOUT))
    config['presentation']=target
