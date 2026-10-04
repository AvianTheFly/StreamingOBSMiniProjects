"""Authored artwork names and composition guidance; no runtime resources."""
from .config import ART

ARTWORK = {
    'fjord.png': ('Fjord Sanctuary', 'Storm coast · warrior', 'right'),
    'forest.png': ('The Spirit Grove', 'Moonlit forest · warrior', 'right'),
    'mountain.png': ('Forge Above the Clouds', 'Snow & aurora · warrior', 'right'),
    'lantern-tide.png': ('The Lantern Tide', 'Moonlit harbor · turtle', 'left'),
    'ember-caravan.png': ('The Ember Caravan', 'Desert sunset · ram', 'right'),
    'jade-refuge.png': ('The Jade Refuge', 'Waterfall jungle · bear', 'right'),
    'starfall.png': ('Starfall Observatory', 'Celestial islands · phoenix', 'left'),
    'drowned-cathedral.png': ('The Drowned Cathedral', 'Underwater basilica · turtle', 'left'),
    'stormglass.png': ('Stormglass Citadel', 'Thundercloud fortress · bear', 'right'),
    'cinder-express.png': ('The Cinder Express', 'Volcanic railway · phoenix', 'right'),
}


def catalog():
    return [dict(file=p.name, title=ARTWORK.get(p.name, (p.stem, '', 'right'))[0],
                 mood=ARTWORK.get(p.name, ('', 'Custom artwork', 'right'))[1],
                 recommended_layout=ARTWORK.get(p.name, ('', '', 'right'))[2])
            for p in sorted(ART.glob('*.png'))]
