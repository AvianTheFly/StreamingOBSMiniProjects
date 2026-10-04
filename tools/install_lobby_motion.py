"""Add only a reviewed world's transparent layer; never select program."""
from pathlib import Path
import hashlib
import json
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths,load_project_env
from lib.settings_backups import SettingsBackups
ensure_import_paths()
from scene_voice_switcher import settings
from scene_voice_switcher.motion import layer,WORLDS
from scene_voice_switcher.presentation import plan,transform


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()


def install(client,name='ReefLobby'):
    spec=layer(name,settings.location(name))
    if not spec:raise ValueError('This world has no reviewed motion layer.')
    source=spec['source'];rows=client.get_scene_item_list(name).scene_items
    before_inputs={i['inputName']:digest(client.get_input_settings(i['inputName']).input_settings)
                   for i in client.get_input_list().inputs if i['inputName']!=source}
    before_filters={n:digest(client.get_source_filter_list(n).filters) for n in before_inputs}
    program=client.get_current_program_scene().current_program_scene_name
    SettingsBackups().snapshot()
    existing=next((r for r in rows if r['sourceName']==source),None)
    if existing:
        identifier=existing['sceneItemId']
        current=client.get_input_settings(source).input_settings
        updates={k:v for k,v in spec['settings'].items() if current.get(k)!=v}
        if updates:client.set_input_settings(source,updates,True)
    else:
        available={i['inputName'] for i in client.get_input_list().inputs}
        identifier=(client.create_scene_item(name,source,True).scene_item_id if source in available else
                    client.create_input(name,source,'browser_source',spec['settings'],True).scene_item_id)
        client.set_scene_item_transform(name,identifier,transform((0,0,1920,1080),stretch=True))
        client.set_scene_item_locked(name,identifier,True)
        layers=plan(name)['layers']
        position=next(i for i,item in enumerate(layers) if item['source']==source)
        predecessor=layers[position-1]['source']
        anchor=next(r for r in rows if r['sourceName']==predecessor)
        client.set_scene_item_index(name,identifier,anchor['sceneItemIndex']+1)
    after={r['sceneItemId']:r for r in client.get_scene_item_list(name).scene_items}
    for old in rows:
        # Adding one layer moves indices but cannot alter existing personal items.
        for key in ['sourceName','sceneItemEnabled','sceneItemLocked','sceneItemBlendMode','sceneItemTransform']:
            assert after[old['sceneItemId']][key]==old[key],(old['sourceName'],key)
    for n,value in before_inputs.items():
        assert digest(client.get_input_settings(n).input_settings)==value,(n,'settings')
        assert digest(client.get_source_filter_list(n).filters)==before_filters[n],(n,'filters')
    assert client.get_current_program_scene().current_program_scene_name==program
    return {'world':name,'source':source,'settings':client.get_input_settings(source).input_settings,
            'existing_items_preserved':len(rows),'existing_input_settings_and_filters_preserved':len(before_inputs),
            'program_preserved':program,'new_layer_id':identifier}


def main(name='ReefLobby'):
    load_project_env()
    import obs
    client=obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Install the prototype while streaming and recording are stopped.')
    result=install(client,name)
    output=Path('C:/StreamingMedia/LivingLobbies')/name.removesuffix('Lobby')/'review';output.mkdir(parents=True,exist_ok=True)
    (output/'installation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--world',choices=tuple(WORLDS),default='ReefLobby')
    main(parser.parse_args().world)
