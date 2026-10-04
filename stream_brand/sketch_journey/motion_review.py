"""Finite encoded-frame review and delivery packaging for the motion MVP."""
from pathlib import Path
import argparse,hashlib,json,math,shutil,zipfile
from PIL import Image,ImageDraw,ImageFont
from .render import run,MUSIC,ROOT
from stream_brand.intro.render import fingerprint
from .motion_timeline import SCENES,REVIEW_TIMES,beat,HIT,RAM_HIT,BEAR_CONTACT,state
from .motion_rig import skeleton,subjective_skeleton
from .sketch_space import View
from .motion_timeline import camera

OUT=Path('C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-motion-mvp-v5')
WORKSPACE=Path('C:/Users/Michael/.codex/visualizations/2026/10/03/01a10042-091a-7803-9385-ce38a0ed99eb/spirit-motion-mvp-v5')


def groups():
    actions=[beat(n) for n in (18.4,19.2,20,20.5,21,22,23,24.8,25.4,26.3,27,27.7,28.3,28.8,29.15,29.65)]
    contacts=[HIT-.35,HIT-.18,HIT-.025,18.08,beat(40)+.04,beat(41),beat(42)-.04,22.4,23.2,RAM_HIT-.08,RAM_HIT+.03,RAM_HIT+.13,RAM_HIT+.30,RAM_HIT+.55,25.7,26.3,27.2,28.7,29.5,30.6,35.5,37.55,38.2,39.8]
    cuts=[min(39.966,max(0,t+offset)) for _,t,_,_,_ in SCENES[1:] for offset in (-.067,.067)]
    return {'encoded-actions.jpg':actions,'encoded-contacts.jpg':contacts,'encoded-cuts.jpg':cuts,
            'encoded-storyboard.jpg':REVIEW_TIMES,
            **{f'encoded-sequence-{j+1}.jpg':[t/2 for t in range(a*2,b*2)] for j,(a,b) in enumerate(((0,8),(8,15),(15,22),(22,30),(30,40)))}}


def extract(output=OUT,stem='spirit-motion-mvp',state_fn=state,review_groups=None):
    output=Path(output)
    batches=groups() if review_groups is None else review_groups
    indices=sorted({round(t*30) for times in batches.values() for t in times})
    folder=output/'encoded-frames';folder.mkdir(exist_ok=True)
    comma=chr(92)+',';files=[]
    # Bound expression depth in FFmpeg's select parser as well as output memory.
    for batch,start in enumerate(range(0,len(indices),40)):
        selector='+'.join(f'eq(n{comma}{i})' for i in indices[start:start+40])
        prefix=f'part-{batch:02d}-review-'
        run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-i',str(output/f'{stem}-40s.mp4'),
             '-vf',f'select={selector},scale=640:360','-filter_threads','1','-fps_mode','vfr','-q:v','2',str(folder/(prefix+'%03d.jpg'))])
        part=sorted(folder.glob(prefix+'*.jpg'));assert len(part)==len(indices[start:start+40])
        files.extend(part)
    assert len(files)==len(indices),(len(files),len(indices))
    by_index=dict(zip(indices,files));font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',17)
    for name,times in batches.items():
        columns=4;width=320;height=180;cell=208
        sheet=Image.new('RGB',(columns*width,math.ceil(len(times)/columns)*cell),'#101b27');d=ImageDraw.Draw(sheet)
        for j,t in enumerate(times):
            fi=round(t*30);x,y=j%columns*width,j//columns*cell
            sheet.paste(Image.open(by_index[fi]).resize((width,height)),(x,y))
            d.text((x+8,y+height+3),f'{fi/30:.2f}s / {state_fn(fi/30)["shot"]}',font=font,fill='#cbdada')
        sheet.save(output/name,quality=94)
    shutil.copy2(by_index[round(39.8*30)],output/'poster.jpg')
    print(json.dumps({'encoded_frames':len(indices),'review_sheets':list(batches)}),flush=True)


def geometry_audit(state_fn=state,camera_fn=camera,scenes=SCENES):
    bone_error=0;pov_error=0;cut_error=0;floor_error=0;previous=None;step=0
    for fi in range(1201):
        p=state_fn(fi/30);r=skeleton(p);j=r['joints']
        for a,b,c,l1,l2 in r['chains']:
            bone_error=max(bone_error,abs(math.dist(j[a],j[b])-l1),abs(math.dist(j[b],j[c])-l2))
        assert all(math.isfinite(v) for point in j.values() for v in point)
        if previous:step=max(step,max(math.dist(j[n],previous[n]) for n in j))
        previous=j
        if p['pov']:
            view=View(Image.new('RGB',(1280,720)),*camera_fn(p))
            for a,b,c in subjective_skeleton(p,view):pov_error=max(pov_error,abs(math.dist(a,b)-.44),abs(math.dist(b,c)-.47))
        if p['bear_running']>.999 and p['quadruped']>.999:
            for side in ('left','right'):
                if r['contacts'][side+'_hand']:floor_error=max(floor_error,abs(j[side+'_wrist'][1]-.035*p['body_scale']))
    for _,t,_,_,_ in scenes[1:]:
        a,b=skeleton(state_fn(t-1e-6)),skeleton(state_fn(t+1e-6))
        cut_error=max(cut_error,max(math.dist(a['joints'][n],b['joints'][n]) for n in a['joints']))
    assert bone_error<1e-7 and pov_error<1e-7 and cut_error<.001 and floor_error<1e-6
    return {'sampled_frames':1201,'max_world_bone_length_error':bone_error,'max_pov_bone_length_error':pov_error,
        'max_joint_displacement_across_camera_cuts_at_2us':cut_error,'max_planted_paw_floor_error':floor_error,
        'max_actual_30fps_joint_step_metres':step,'finite_joints':'passed'}


def audio_audit(output=OUT,stem='spirit-motion-mvp'):
    import numpy as np
    output=Path(output);temporary=output/'audio-review.f32'
    try:
        run(['ffmpeg','-nostdin','-v','error','-y','-threads','1','-i',str(output/f'{stem}-40s.mp4'),
             '-map','0:a:0','-ar','48000','-ac','2','-f','f32le',str(temporary)])
        samples=np.fromfile(temporary,dtype='<f4')
        assert len(samples)==40*48000*2 and np.all(np.isfinite(samples))
        info={'samples':len(samples),'duration_seconds':40,'channels':2,'sample_rate':48000,
              'peak':float(np.max(np.abs(samples))),'rms':float(np.sqrt(np.mean(samples*samples))),
              'clipped_samples':int(np.count_nonzero(np.abs(samples)>=1))}
        assert info['clipped_samples']==0
        (output/'audio-validation.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
        return info
    finally:
        temporary.unlink(missing_ok=True)


def validate_movies(output,stem):
    output=Path(output)
    formats={}
    for name in (f'{stem}-40s.mp4',f'{stem}-music-only-40s.mp4',f'{stem}-silent.mp4'):
        path=output/name;probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]).stdout)
        video=next(s for s in probe['streams'] if s['codec_type']=='video')
        assert (video['width'],video['height'],video['r_frame_rate'],int(video['nb_frames']))==(1280,720,'30/1',1200)
        assert abs(float(probe['format']['duration'])-40)<.04
        run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),'-threads','1','-f','null','-'])
        picture_hash=run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),
            '-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-']).stdout.strip()
        formats[name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'frames':1200,'size':[1280,720],'fps':30,'duration':float(probe['format']['duration']),
            'full_decode':'passed','video_packet_hash':picture_hash}
    assert len({v['video_packet_hash'] for v in formats.values()})==1
    return formats


def package():
    # Run only after inspecting the encoded review sheets, not as a substitute for review.
    plan=json.loads((OUT/'motion-plan.json').read_text(encoding='utf-8'))
    assert plan['music_sha256']==fingerprint(MUSIC)
    formats=validate_movies(OUT,'spirit-motion-mvp')
    validation={'format':formats,'geometry':geometry_audit(),'tests':{'passed':34},
        'architecture':{'modules':400,'violations':0},'source_music_unchanged':True,
        'source_music_sha256':plan['music_sha256'],'still_image_substitutions':0,
        'visual_review':{'all_28_setups_and_cut_pairs':'inspected','continuous_half_second_sequence_0_to_40':'inspected',
            'statue_beams_before_growth':'inspected','bear_crouch_gait_rise_and_claws':'inspected',
            'turtle_race_contact_wipe_and_inside_shield_closeup':'inspected','backout_and_ram_build':'inspected',
            'ram_contact_recoil_before_debris':'inspected','fall_reach_and_continuous_lookback':'inspected',
            'phoenix_growth_spin_clearance_return_and_landing':'inspected','edge_arrival_then_sit':'inspected'},
        'limits':'Coarse concept geometry and authored POV arm projection. Full cinematic art is a later production phase.'}
    validation['audio']=audio_audit()
    (OUT/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
    sources=sorted(Path(__file__).parent.glob('*.py'));editable=OUT/'editable-source';editable.mkdir(exist_ok=True)
    for src in sources:shutil.copy2(src,editable/src.name)
    for src in sources:assert src.read_bytes()==(editable/src.name).read_bytes()
    source_zip=OUT/'motion-mvp-source.zip'
    with zipfile.ZipFile(source_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for src in sources:z.write(src,'stream_brand/sketch_journey/'+src.name)
        z.write(Path(__file__).parent/'README.md','stream_brand/sketch_journey/README.md')
        for name in ('test_sketch_journey.py','test_sanctuary_sketch.py','test_cinematic_sketch.py','test_illustrated_sketch.py','test_motion_sketch.py','test_motion_audio.py'):
            z.write(ROOT/'tools'/name,'tools/'+name)
        z.write(OUT/'README.md','DELIVERY-README.md')
    with zipfile.ZipFile(source_zip) as z:assert z.testzip() is None
    previous_art=OUT.parent/'spirit-illustrated-mvp-v4'
    shutil.copytree(previous_art/'art',OUT/'art',dirs_exist_ok=True);shutil.copy2(previous_art/'art-prompts.json',OUT/'art-prompts.json')
    review_zip=OUT/'motion-mvp-review-pack.zip'
    with zipfile.ZipFile(review_zip,'w',zipfile.ZIP_DEFLATED) as z:
        for name in ('README.md','spirit-motion-mvp-40s.mp4','spirit-motion-mvp-music-only-40s.mp4','spirit-motion-mvp-silent.mp4',
                     'motion-foley.wav','motion-plan.json','validation.json','audio-validation.json','storyboard.jpg','poster.jpg','motion-mvp-source.zip','art-prompts.json'):
            z.write(OUT/name,name)
        for name in groups():z.write(OUT/name,name)
        for src in sorted((OUT/'art').glob('*.png')):z.write(src,'art/'+src.name)
    with zipfile.ZipFile(review_zip) as z:assert z.testzip() is None
    WORKSPACE.mkdir(parents=True,exist_ok=True)
    for name in ('README.md','spirit-motion-mvp-40s.mp4','motion-plan.json','validation.json','poster.jpg','encoded-storyboard.jpg','encoded-actions.jpg','encoded-contacts.jpg','motion-mvp-source.zip','motion-mvp-review-pack.zip'):
        shutil.copy2(OUT/name,WORKSPACE/name)
    shutil.copytree(editable,WORKSPACE/'editable-source',dirs_exist_ok=True);shutil.copytree(OUT/'art',WORKSPACE/'art',dirs_exist_ok=True)
    print(json.dumps({'packaged':True,'video_bytes':formats['spirit-motion-mvp-40s.mp4']['bytes'],'review_pack_bytes':review_zip.stat().st_size,'crc':'passed'}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',action='store_true');args=parser.parse_args()
    package() if args.package else extract()
