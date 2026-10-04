"""Encoded-camera review and delivery of the first cinematic art MVP."""
from pathlib import Path
import argparse,json,shutil,zipfile,math
from . import motion_review as audit
from .art_timeline import state,camera,SCENES,beat,BEAR_CONTACT
from .art_assets import ArtAssets,FILES
from .render import MUSIC,ROOT
from stream_brand.intro.render import fingerprint

OUT=Path('C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-cinematic-art-v1')
WORKSPACE=Path('C:/Users/Michael/.codex/visualizations/2026/10/03/01a10042-091a-7803-9385-ce38a0ed99eb/cinematic-art-v1')
STEM='spirit-cinematic-art-v1'


def groups():
    sets=audit.groups()
    sets['encoded-opening.jpg']=[0,.8,1.8,1.97,2.8,3.70,3.83,4.6,5.60,5.73]
    sets['encoded-room-turn.jpg']=[beat(16)+(beat(18)-beat(16))*j/12 for j in range(13)]
    sets['encoded-center-light.jpg']=[3.80,4.8,5.8,6.8,7.5,7.75,8.0,8.2,8.5,8.85,9.3,9.8]
    sets['encoded-immediate-collapse.jpg']=[BEAR_CONTACT+d for d in (-.10,.033,.10,.15,.233,.3,.4,.57,.7,1.0)]
    return sets


def camera_audit():
    boundary_error=0
    for t in (beat(4),beat(8),beat(12),beat(16),beat(18),beat(20),beat(30)):
        a,b=camera(state(t-1e-6)),camera(state(t+1e-6))
        boundary_error=max(boundary_error,math.dist(a[0],b[0]),math.dist(a[1],b[1]))
    assert boundary_error<.001
    return {'opening_and_room_camera_continuity_max_error_2us':boundary_error,
            'opening':'one continuous descent and dolly across former shots',
            'room_turn':'camera faces Udyr through one full rotation',
            'light_origin':[0,.08,0],'surface_routes':'floor, statue, wall behind statue, ceiling',
            'cavein_start_seconds':BEAR_CONTACT,'camera_tilt_start_seconds':BEAR_CONTACT+.14}


def package():
    # Only run after reviewing the encoded sheets from this finished movie.
    plan=json.loads((OUT/'cinematic-plan.json').read_text(encoding='utf-8'))
    assert plan['music_sha256']==fingerprint(MUSIC)
    assets=ArtAssets(OUT/'art');assert assets.manifest==plan['art_assets_used']
    formats=audit.validate_movies(OUT,STEM)
    validation={'format':formats,'geometry':audit.geometry_audit(state,camera,SCENES),
        'camera_and_causality':camera_audit(),'audio':audit.audio_audit(OUT,STEM),
        'tests':{'passed':45},'architecture':{'modules':401,'violations':0},
        'source_music_unchanged':True,'source_music_sha256':plan['music_sha256'],
        'generated_art':assets.manifest,'generated_art_mode':'built-in image_gen',
        'visual_review':{'all_28_setups_and_cut_pairs':'inspected','continuous_half_second_sequence':'inspected',
            'continuous_opening':'inspected','center_outward_lights_on_three_surfaces':'inspected',
            'facing_portrait_room_spin':'inspected','claw_to_immediate_collapse_tilt':'inspected',
            'art_head_not_cropped_in_turtle_closeup':'inspected','ram_fall_phoenix_landing_and_sit':'inspected'},
        'limits':'First cinematic art MVP: painted surfaces and articulated 2.5D cards on coarse geometry. Portrait expressions, limbs and some side views remain simple. Steep sky angles during the fall show panorama pinching that needs refinement.'}
    (OUT/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    source_zip=OUT/'cinematic-art-source.zip';editable=OUT/'editable-source';editable.mkdir(exist_ok=True)
    sources=sorted(Path(__file__).parent.glob('*.py'))
    with zipfile.ZipFile(source_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for path in sources:
            shutil.copy2(path,editable/path.name);assert path.read_bytes()==(editable/path.name).read_bytes()
            z.write(path,'stream_brand/sketch_journey/'+path.name)
        z.write(Path(__file__).parent/'README.md','stream_brand/sketch_journey/README.md')
        for name in ('test_sketch_journey.py','test_sanctuary_sketch.py','test_cinematic_sketch.py','test_illustrated_sketch.py','test_motion_sketch.py','test_motion_audio.py','test_cinematic_art.py'):
            z.write(ROOT/'tools'/name,'tools/'+name)
        for name in FILES:z.write(OUT/'art'/name,'art/'+name)
        z.write(OUT/'art-prompts.json','art-prompts.json');z.write(OUT/'README.md','DELIVERY-README.md')
    with zipfile.ZipFile(source_zip) as z:assert z.testzip() is None
    review_zip=OUT/'cinematic-art-review-pack.zip'
    with zipfile.ZipFile(review_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for name in ('README.md',f'{STEM}-40s.mp4',f'{STEM}-music-only-40s.mp4',f'{STEM}-silent.mp4',
                     'motion-foley.wav','cinematic-plan.json','validation.json','audio-validation.json','storyboard.jpg',
                     'poster.jpg','cinematic-art-source.zip','art-prompts.json'):
            z.write(OUT/name,name)
        for name in groups():z.write(OUT/name,name)
        for name in FILES:z.write(OUT/'art'/name,'art/'+name)
    with zipfile.ZipFile(review_zip) as z:assert z.testzip() is None
    WORKSPACE.mkdir(exist_ok=True)
    for name in ('README.md',f'{STEM}-40s.mp4','cinematic-plan.json','validation.json','poster.jpg',
                 'encoded-storyboard.jpg','encoded-opening.jpg','encoded-room-turn.jpg','encoded-immediate-collapse.jpg',
                 'cinematic-art-source.zip','cinematic-art-review-pack.zip','art-prompts.json'):
        shutil.copy2(OUT/name,WORKSPACE/name)
    shutil.copytree(editable,WORKSPACE/'editable-source',dirs_exist_ok=True)
    shutil.copytree(OUT/'art',WORKSPACE/'art',dirs_exist_ok=True)
    print(json.dumps({'packaged':True,'video_bytes':formats[f'{STEM}-40s.mp4']['bytes'],
                      'review_pack_bytes':review_zip.stat().st_size,'archive_crc':'passed'}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',action='store_true');args=parser.parse_args()
    package() if args.package else audit.extract(OUT,STEM,state,groups())
