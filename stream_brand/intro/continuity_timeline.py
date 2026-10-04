"""Authored v3 edit: opening spirit reveal, then one consequential fight."""
from pathlib import Path
import json


def make_continuity_plan():
    plan = json.loads(Path(__file__).with_name('plan.json').read_text(encoding='utf-8'))
    plan.update(
        title='Rift Stand — Storm and Stone',
        export_stem='udyr-sion-continuity-intro',
        output_dir='C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-continuity-v3',
        technique=('26 new cinematic keyframes, matching physical/spirit animal designs, '
                   'continuous recovery poses, depth camera motion, moving weather, '
                   'hit stops and procedural impact effects'),
    )
    # Introductions end at the first energy lift in the supplied remix (7.53s).
    # After the faceoff, each new pose advances the same physical encounter.
    cuts = [
        ('01-rift', 2, 'approach', 'fade', 1.04, 1.09),
        ('02-awakening', 4, 'hero introduced', 'cut', 1.07, 1.14),
        ('80-bear-physical', 5, 'lightning bear', 'cut', 1.025, 1.055),
        ('81-bear-spirit', 6, 'storm transformation', 'cut', 1.055, 1.085),
        ('82-turtle-physical', 7, 'armored guardian', 'cut', 1.025, 1.055),
        ('83-turtle-spirit', 8, 'jade transformation', 'cut', 1.055, 1.085),
        ('05-ram', 10, 'ram introduced', 'cut', 1.08, 1.14),
        ('06-phoenix', 12, 'phoenix introduced', 'cut', 1.06, 1.12),
        ('84-four-spirits', 14, 'four spirits united', 'cut', 1.035, 1.06),
        ('11-sion-reveal', 16, 'villain introduced', 'cut', 1.04, 1.10),
        ('60-faceoff', 20, 'fighters close the distance', 'cut', 1.025, 1.065),
        ('85-bear-windup', 22, 'punch anticipation', 'cut', 1.035, 1.065),
        ('86-bear-release', 22.75, 'punch release', 'cut', 1.035, 1.065),
        ('87-bear-contact', 23, 'punch contact', 'cut', 1.05, 1.06),
        ('24-bear-impact-insert', 23.25, 'electric impact', 'impact', 1.06, 1.075),
        ('87-bear-contact', 25, 'punch follow through', 'cut', 1.06, 1.035),
        ('88-bear-recovery', 27, 'Sion recoils', 'cut', 1.035, 1.055),
        ('61-sion-retaliation', 28, 'Sion retaliates', 'cut', 1.035, 1.055),
        ('89-shield-brace', 29.5, 'shield brace', 'cut', 1.035, 1.06),
        ('90-shield-contact', 30, 'shield contact lead', 'cut', 1.06, 1.07),
        ('90-shield-contact', 32, 'shield collision', 'impact', 1.075, 1.035),
        ('91-shield-pushback', 36, 'shield drives Udyr to his knee', 'cut', 1.035, 1.06),
        ('63-ram-kneeling', 38, 'ram ignites from the knee', 'cut', 1.035, 1.05),
        ('64-ram-rise-half', 40, 'ram lifts Udyr', 'cut', 1.035, 1.05),
        ('65-ram-rise-loaded', 42, 'Udyr loads the charge', 'cut', 1.035, 1.05),
        ('66-ram-charge', 44.5, 'charge release', 'cut', 1.035, 1.07),
        ('42-ram-contact', 44.75, 'ram impact', 'impact', 1.045, 1.06),
        ('42-ram-contact', 46, 'ram follow through', 'cut', 1.06, 1.035),
        ('67-sion-fall-back', 48, 'Sion falls onto his back', 'cut', 1.035, 1.05),
        ('68-sion-grounded', 50, 'Sion remains down', 'cut', 1.035, 1.05),
        ('69-phoenix-summon-grounded', 54, 'phoenix forms over fallen Sion', 'cut', 1.035, 1.065),
        ('70-phoenix-rise-grounded', 56, 'finisher rises', 'cut', 1.035, 1.05),
        ('71-phoenix-dive-grounded', 56.5, 'finisher dives', 'cut', 1.035, 1.065),
        ('72-phoenix-finish-grounded', 56.75, 'frost impact', 'impact', 1.045, 1.06),
        ('72-phoenix-finish-grounded', 60, 'frost expands across the ground', 'cut', 1.06, 1.035),
        ('73-phoenix-touchdown', 64, 'Udyr holds the landing', 'cut', 1.035, 1.05),
        ('74-victory-rise', 68, 'Udyr rises from the landing', 'cut', 1.035, 1.05),
        ('53-aftermath', 76, 'victory settles', 'breath', 1.035, 1.085),
        ('84-four-spirits', None, 'channel reveal', 'finale', 1.08, 1.025),
    ]
    shots = []
    prior = 0
    for i, (asset, end, label, transition, z0, z1) in enumerate(cuts):
        last = (round(plan['duration_seconds'] * plan['fps']) if end is None
                else round((plan['beat_phase'] + end * 60 / plan['bpm']) * plan['fps']))
        shot = dict(
            id=f'{i + 1:02d}-{label.replace(" ", "-")}', asset=asset,
            start_frame=prior, end_frame=last, zoom=[z0, z1], focus=[.5, .5],
            orbit=.003, hero=asset == '01-rift', transition=transition,
            story_beat=label, ending_smear=False,
        )
        if asset == '02-awakening':
            shot['focus'] = [.55, .48]
        if 'release' in label or 'dives' in label:
            shot.update(travel=[.025, .018 if 'dives' in label else 0], smear=True)
        if transition == 'impact':
            point = {
                '24-bear-impact-insert': [.59, .50],
                '90-shield-contact': [.40, .49],
                '42-ram-contact': [.60, .51],
                '72-phoenix-finish-grounded': [.44, .74],
            }[asset]
            shot.update(impact_point=point, impact_frames=3, hit_stop_frames=3, shockwave=True)
        shots.append(shot)
        prior = last
    plan['shots'] = shots
    plan['review_frames'] = [
        s['start_frame'] + min(14, (s['end_frame'] - s['start_frame']) // 2)
        for s in shots
    ]
    styles = {
        '01-rift': ['60-faceoff'],
        '03-bear': ['80-bear-physical', '81-bear-spirit', '85-bear-windup',
                    '86-bear-release', '87-bear-contact', '88-bear-recovery',
                    '24-bear-impact-insert'],
        '04-turtle': ['82-turtle-physical', '83-turtle-spirit', '89-shield-brace',
                      '90-shield-contact', '91-shield-pushback'],
        '05-ram': ['11-sion-reveal', '61-sion-retaliation', '63-ram-kneeling',
                   '64-ram-rise-half', '65-ram-rise-loaded', '66-ram-charge',
                   '42-ram-contact', '67-sion-fall-back', '68-sion-grounded'],
        '06-phoenix': ['69-phoenix-summon-grounded', '70-phoenix-rise-grounded',
                       '71-phoenix-dive-grounded', '72-phoenix-finish-grounded',
                       '73-phoenix-touchdown', '74-victory-rise', '53-aftermath'],
        '07-convergence': ['84-four-spirits'],
    }
    plan['assets'] = {}
    for style, assets in styles.items():
        for asset in assets:
            plan['assets'][asset] = dict(
                style=style, lightning=False, ward=False,
                depth=[[.30, .53, .20, .43, .82], [.72, .49, .22, .44, .77]],
            )
    for asset in ('80-bear-physical', '81-bear-spirit', '82-turtle-physical', '83-turtle-spirit'):
        plan['assets'][asset]['depth'] = [[.49, .52, .40, .40, .82]]
    plan['assets']['24-bear-impact-insert']['depth'] = [[.48, .54, .46, .48, .86]]
    plan['pose_groups'] = {
        'spirit-designs': ['80-bear-physical', '81-bear-spirit', '82-turtle-physical', '83-turtle-spirit'],
        'bear': ['85-bear-windup', '86-bear-release', '87-bear-contact', '88-bear-recovery'],
        'shield': ['61-sion-retaliation', '89-shield-brace', '90-shield-contact', '91-shield-pushback'],
        'ram-recovery': ['63-ram-kneeling', '64-ram-rise-half', '65-ram-rise-loaded', '66-ram-charge'],
        'ram-knockdown': ['42-ram-contact', '67-sion-fall-back', '68-sion-grounded'],
        'phoenix': ['69-phoenix-summon-grounded', '70-phoenix-rise-grounded',
                    '71-phoenix-dive-grounded', '72-phoenix-finish-grounded'],
        'victory': ['73-phoenix-touchdown', '74-victory-rise', '53-aftermath'],
    }
    return plan


if __name__ == '__main__':
    Path(__file__).with_name('continuity-plan.json').write_text(
        json.dumps(make_continuity_plan(), indent=2), encoding='utf-8')
