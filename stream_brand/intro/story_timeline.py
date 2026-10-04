"""Story policy: connected combat poses and musical edit for the v2 intro."""
from pathlib import Path
import json


def make_story_plan():
    plan=json.loads(Path(__file__).with_name('plan.json').read_text(encoding='utf-8'))
    plan.update(title='Rift Stand — Udyr vs Sion',
        export_stem='udyr-sion-story-intro',
        output_dir='C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-story-v2',
        technique='23 new connected action keyframes plus reused spirit artwork; pose cuts, impact inserts, hit stops, depth camera motion, moving weather and procedural effects')
    # End beats are authored on a 128 BPM grid; quarter beats provide contact inserts.
    # Each action retains anticipation -> release -> contact -> recovery screen direction.
    cuts=[
        ('01-rift',4,'approach','fade',1.04,1.12,.50,.50),
        ('10-footfall',6,'footfall','cut',1.06,1.17,.47,.58),
        ('11-sion-reveal',10,'threat revealed','cut',1.04,1.11,.57,.49),
        ('02-awakening',12,'hero sees threat','snap',1.08,1.18,.55,.48),
        ('12-axe-windup',16,'axe anticipation','cut',1.025,1.06,.50,.49),
        ('14-axe-swing',16.5,'axe release','cut',1.05,1.075,.50,.52),
        ('13-axe-dodge',18,'dodge and stone hit','impact',1.09,1.035,.48,.55),
        ('03-bear',20,'storm spirit awakens','snap',1.17,1.29,.53,.49),
        ('20-bear-windup',23,'punch anticipation','cut',1.045,1.09,.49,.51),
        ('21-bear-release',23.75,'punch release','cut',1.04,1.085,.51,.52),
        ('22-bear-contact',24,'punch contact','cut',1.065,1.075,.55,.48),
        ('24-bear-impact-insert',24.25,'electric impact insert','impact',1.06,1.10,.55,.49),
        ('22-bear-contact',26,'punch follow through','cut',1.09,1.04,.52,.49),
        ('23-bear-recovery',28,'enemy recoil','cut',1.045,1.085,.52,.51),
        ('04-turtle',30,'guardian spirit','snap',1.15,1.28,.50,.50),
        ('30-turtle-brace',31.5,'shield anticipation','cut',1.04,1.075,.49,.51),
        ('31-turtle-contact',32,'shield contact lead','cut',1.07,1.08,.49,.51),
        ('31-turtle-contact',34,'shield collision','impact',1.10,1.04,.49,.51),
        ('32-shield-pushback',36,'hero pushed back','cut',1.04,1.085,.47,.55),
        ('33-udyr-down',40,'setback','breath',1.04,1.12,.44,.51),
        ('34-resolve',44,'resolve','cut',1.04,1.13,.49,.48),
        ('05-ram',46,'ram spirit','snap',1.20,1.30,.45,.48),
        ('40-ram-coil',47.5,'charge anticipation','cut',1.04,1.08,.49,.54),
        ('41-ram-release',48,'charge release','cut',1.04,1.085,.50,.54),
        ('42-ram-contact',48.25,'ram contact accent','impact',1.055,1.065,.54,.51),
        ('42-ram-contact',50,'ram follow through','cut',1.07,1.035,.52,.51),
        ('43-ram-fall',52,'enemy lands','cut',1.04,1.075,.51,.52),
        ('06-phoenix',54,'phoenix spirit','snap',1.14,1.25,.51,.43),
        ('50-phoenix-rise',55.5,'final attack rises','cut',1.035,1.06,.50,.48),
        ('51-phoenix-dive',56,'final attack dives','cut',1.045,1.07,.51,.49),
        ('52-phoenix-contact',56.25,'frost contact accent','impact',1.055,1.06,.54,.55),
        ('52-phoenix-contact',60,'frost wave expands','cut',1.07,1.025,.51,.52),
        ('53-aftermath',64,'victory wide','breath',1.035,1.075,.50,.51),
        ('53-aftermath',68,'hero victory portrait','cut',1.53,1.65,.31,.43),
        ('22-bear-contact',70,'storm recall','snap',1.20,1.32,.57,.48),
        ('31-turtle-contact',72,'guardian recall','cut',1.17,1.28,.46,.49),
        ('42-ram-contact',74,'ram recall','snap',1.15,1.29,.55,.52),
        ('52-phoenix-contact',76,'phoenix recall','cut',1.15,1.27,.52,.54),
        ('34-resolve',77,'resolve recall','snap',1.17,1.27,.48,.48),
        ('24-bear-impact-insert',78,'storm insert','cut',1.12,1.23,.54,.49),
        ('05-ram',79,'ram insert','cut',1.36,1.43,.43,.40),
        ('06-phoenix',80,'phoenix insert','snap',1.32,1.40,.51,.37),
        ('07-convergence',None,'channel reveal','finale',1.14,1.03,.50,.50),
    ]
    shots=[]
    prior=0
    for i,(asset,end,label,transition,z0,z1,x,y) in enumerate(cuts):
        last=2400 if end is None else round((plan['beat_phase']+end*60/plan['bpm'])*60)
        shot=dict(id=f'{i+1:02d}-{label.replace(" ","-")}',asset=asset,
            start_frame=prior,end_frame=last,zoom=[z0,z1],focus=[x,y],
            orbit=(-1 if i%2 else 1)*(.008 if last-prior>30 else .002),
            hero=asset=='01-rift',transition=transition,story_beat=label)
        if 'release' in label or 'dives' in label:
            shot.update(travel=[.035,.008 if 'dives' in label else 0],smear=True)
        if transition=='impact':
            point={'13-axe-dodge':[.48,.76],'24-bear-impact-insert':[.59,.50],
                '31-turtle-contact':[.40,.49],'42-ram-contact':[.60,.51],
                '52-phoenix-contact':[.46,.76]}[asset]
            shot.update(impact_point=point,impact_frames=3,hit_stop_frames=3,shockwave=True)
        shots.append(shot)
        prior=last
    plan['shots']=shots
    plan['review_frames']=[s['start_frame']+min(14,(s['end_frame']-s['start_frame'])//2) for s in shots]
    style_groups={
        '01-rift':['10-footfall','12-axe-windup','14-axe-swing','13-axe-dodge'],
        '05-ram':['11-sion-reveal','34-resolve','40-ram-coil','41-ram-release','42-ram-contact','43-ram-fall'],
        '03-bear':['20-bear-windup','21-bear-release','22-bear-contact','23-bear-recovery','24-bear-impact-insert'],
        '04-turtle':['30-turtle-brace','31-turtle-contact','32-shield-pushback','33-udyr-down'],
        '06-phoenix':['50-phoenix-rise','51-phoenix-dive','52-phoenix-contact','53-aftermath'],
    }
    plan['assets']={}
    for style,assets in style_groups.items():
        for asset in assets:
            plan['assets'][asset]=dict(style=style,lightning=False,
                depth=[[.30,.53,.20,.43,.82],[.72,.49,.22,.44,.77]])
    for asset in ('10-footfall','24-bear-impact-insert','34-resolve'):
        plan['assets'][asset]['depth']=[[.48,.54,.46,.48,.86]]
    for asset in ('32-shield-pushback','33-udyr-down'):
        plan['assets'][asset]['ward']=False
    plan['pose_groups']={
        'axe':['12-axe-windup','14-axe-swing','13-axe-dodge'],
        'bear':['20-bear-windup','21-bear-release','22-bear-contact','23-bear-recovery'],
        'shield':['30-turtle-brace','31-turtle-contact','32-shield-pushback','33-udyr-down'],
        'ram':['40-ram-coil','41-ram-release','42-ram-contact','43-ram-fall'],
        'phoenix':['50-phoenix-rise','51-phoenix-dive','52-phoenix-contact','53-aftermath'],
    }
    return plan


if __name__=='__main__':
    Path(__file__).with_name('story-plan.json').write_text(
        json.dumps(make_story_plan(),indent=2),encoding='utf-8')

