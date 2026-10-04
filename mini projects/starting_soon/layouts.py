"""Pure clip placement policy shared by native source and browser presentation."""
import math

PRESETS = {
    'right': dict(label='Right stage', box=[690, 320, 1144, 643.5]),
    'left': dict(label='Left stage', box=[86, 320, 1144, 643.5]),
    'cinema': dict(label='Cinema', box=[280, 230, 1360, 765]),
    'corner': dict(label='Scenery + corner clip', box=[1020, 530, 800, 450]),
}
LAYOUT_NAMES = {'preserve', 'custom', *PRESETS}


def custom_box(value):
    if not isinstance(value, dict):
        raise ValueError('Custom placement needs x, y and width.')
    x, y, width = (value.get(k) for k in ('x', 'y', 'width'))
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
           for v in (x, y, width)):
        raise ValueError('Placement values must be finite numbers.')
    height = width * 9 / 16
    if width < 480 or x < 24 or y < 190 or x + width > 1896 or y + height > 1004:
        raise ValueError('Keep the 16:9 clip inside the stage (24–1896 horizontally, 190–1004 vertically).')
    return [x, y, width, height]


def validate_choice(choice):
    if not isinstance(choice, dict) or choice.get('layout') not in LAYOUT_NAMES:
        raise ValueError('Choose a supported clip placement.')
    if choice['layout'] == 'custom':
        custom_box(choice.get('custom_box'))


def selection(config, path=''):
    # Exact asset overrides take precedence over the global placement.
    return config.get('clip_layouts', {}).get(path, config)


def box(config, path=''):
    choice = selection(config, path)
    layout = choice.get('layout', 'preserve')
    if layout == 'preserve':
        return None
    if layout == 'custom':
        return custom_box(choice.get('custom_box'))
    return list(PRESETS[layout]['box'])
