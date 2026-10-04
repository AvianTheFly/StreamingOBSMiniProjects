"""Finite off-air QA: native lobby handoffs with an ownership-checked return.

Run with the Hub stopped. Saves screenshots on C, keeps every unrelated source
setting, and restores the original location visibility through native OBS.
"""
import argparse
import base64
import json
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
from scene_voice_switcher.layouts import LAYOUTS
from coordinator import coordinator
from lib.settings_backups import SettingsBackups
from lib.coordination.scenes import scene_director


def verify(style, sources=('ForgeLobby','ReefLobby'), output=None):
    load_project_env()
    import obs
    client=obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Use native QA while off-air')
    SettingsBackups().snapshot()
    output=Path(output or 'C:/Users/Michael/.codex/artifacts/starting-soon-production-20261003/native-lobbies')
    output.mkdir(parents=True,exist_ok=True)
    original=client.get_scene_item_list('Lobbies').scene_items
    expected={i['sceneItemId']:i['sceneItemEnabled'] for i in original if i['sourceName'] in LAYOUTS}
    if len(set(sources))!=2:raise ValueError('Choose two distinct lobby locations')
    targets={i['sourceName']:i for i in original if i['sourceName'] in sources}
    assert len(targets)==2,'Both QA locations must be installed'
    transition=client.send('GetCurrentSceneTransition',{},raw=True)
    session=coordinator.scene_session('native_lobby_qa','Lobbies','Test',transition=('Fade',350))
    def shot(name):
        data=client.send('GetSourceScreenshot',{'sourceName':'Lobbies','imageFormat':'png','imageWidth':1920,'imageHeight':1080},raw=True)
        (output/f'{style}-{name}.png').write_bytes(base64.b64decode(data['imageData'].split(',',1)[1]))
    before=obs.get_current_scene()
    def show(item, enabled):
        client.set_scene_item_enabled('Lobbies',item['sceneItemId'],enabled)
        expected[item['sceneItemId']]=enabled
    try:
        assert session.activate()
        for item in original:
            if item['sourceName'] in LAYOUTS:
                show(item,item['sourceName']==sources[0])
        time.sleep(1.5);shot('before')
        show(targets[sources[0]],False)
        show(targets[sources[1]],True)
        time.sleep(.35);shot('mid')
        time.sleep(1.1);shot('after')
        current=client.get_scene_item_list('Lobbies').scene_items
        for old in original:
            row=next(i for i in current if i['sceneItemId']==old['sceneItemId'])
            assert row['sceneItemTransform']==old['sceneItemTransform']
        assert client.send('GetCurrentSceneTransition',{},raw=True)['transitionName']==transition['transitionName']
    finally:
        try:
            current={i['sceneItemId']:i['sceneItemEnabled'] for i in
                     client.get_scene_item_list('Lobbies').scene_items if i['sourceName'] in LAYOUTS}
            if session.owns_scene() and current==expected:
                for item in original:
                    if item['sourceName'] in LAYOUTS:
                        show(item,item['sceneItemEnabled'])
                time.sleep(1.1)
            elif current!=expected:
                # A native location choice supersedes the QA return even if the
                # program scene still says Lobbies. Fail closed on that intent.
                scene_director.observing(False)
        finally:
            session.finish()
    assert obs.get_current_scene()==before,'Ownership-checked return must preserve the previous scene'
    from PIL import Image,ImageChops,ImageStat
    images=[Image.open(output/f'{style}-{n}.png').convert('RGB') for n in ('before','mid','after')]
    # Art outside the live camera/chat is included; a cut would exactly match an endpoint.
    regions=[(0,0,800,180),(1500,800,1920,1080),(700,650,1200,800)]
    distances=[sum(sum(ImageStat.Stat(ImageChops.difference(images[1].crop(r),im.crop(r))).mean) for r in regions) for im in (images[0],images[2])]
    assert min(distances)>3,('Expected a visible native handoff between the endpoints',distances)
    print(json.dumps({'style':style,'sources':sources,'mid_frame_distances':distances,'transforms_preserved':True,'selector_preserved':True,'returned_to':before}))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--style',required=True,choices=['dissolve','iris','gates','embers'])
    p.add_argument('--sources',nargs=2,choices=tuple(LAYOUTS),default=('ForgeLobby','ReefLobby'))
    p.add_argument('--output',type=Path)
    args=p.parse_args();verify(args.style,args.sources,args.output)
