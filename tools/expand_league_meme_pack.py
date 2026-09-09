"""Fetch reviewed variety assets; --assign seeds untouched demo event pools once."""
import argparse
import concurrent.futures
import json
import sys
from pathlib import Path

from prepare_league_meme_pack import ROOT, download

PICKS = [
 ('krabs-money','Mr Krabs · money','Shopping priorities.', '/view/money-mr-krabs-gif-18326632',['inventory_added','possible_purchase']),
 ('cena-invisible','John Cena · invisible','Vision and escaping detection.', '/view/john-cena-you-cant-see-me-youre-blind-wrestler-gif-14537197',['vision_activity','possible_low_hp_escape']),
 ('thanos-myself','Thanos · do it myself','Taking matters into your own hands.', '/view/thanos-fine-ill-do-it-myself-ill-do-it-myself-gif-22181201',['manpower_advantage','low_hp_kill']),
 ('strange-bargain','Doctor Strange · bargain','Returning for another attempt.', '/view/dormammu-ive-come-to-bargain-dormammu-dr-strange1-dr-strange-gif-25069074',['respawn']),
 ('spongebob-ready','SpongeBob · ready','Ready for the next round.', '/view/spongebob-im-ready-square-pants-squarebob-gif-10364707',['game_start','minions_spawning']),
 ('gandalf-pass','Gandalf · shall not pass','A little defensive magic.', '/view/you-shall-not-pass-gandalf-gif-8224531',['dragon_earth','inhibitor_respawned']),
 ('gru-answer','Gru · the answer is clear','An extremely confident plan.', '/view/despicable-me-gru-the-answer-is-clear-gif-9091697056505454906',['assist','possible_power_spike']),
 ('patrick-money','Patrick · throwing money','Money comes and goes.', '/view/patrick-spongebob-squarepants-spongebob-mr-krabs-money-gif-24719413',['inventory_removed','cs_milestone']),
]

# The current primary remains one choice; alternatives are themed to the event.
EXTRAS = {
 'game_start':['spongebob-ready','avengers'], 'minions_spawning':['minions-dance','simba-grub'],
 'first_blood':['thanos-myself','tobey-dance'], 'kill':['squidward-dab','tobey-dance','thanos-myself'],
 'death':['emotional-damage','michael-no'], 'assist':['gru-answer','baymax-bump'],
 'double_kill':['squidward-dab','goku-power'], 'triple_kill':['tobey-dance','palpatine-power'],
 'quadra_kill':['thanos-myself','avengers'], 'pentakill':['thanos-snap','palpatine-power'],
 'ace':['avengers','thanos-snap'], 'turret_destroyed':['ralph-wreck','elmo-fire'],
 'first_turret':['thanos-myself','ralph-wreck'], 'inhibitor_destroyed':['elmo-fire','thanos-snap'],
 'inhibitor_respawning_soon':['terminator-back','strange-bargain'],
 'inhibitor_respawned':['gandalf-pass','spongebob-ready'],
 'void_grub':['simba-grub','minions-dance'], 'herald':['ralph-wreck','thanos-myself'],
 'baron':['avengers','goku-power'], 'atakhan_legacy':['thanos-snap','palpatine-power'],
 'dragon':['avengers','goku-power'], 'dragon_earth':['gandalf-pass','ralph-wreck'],
 'dragon_fire':['elmo-fire','this-is-fine'], 'dragon_water':['baymax-bump','strange-bargain'],
 'dragon_air':['cena-invisible','homer-bush'], 'dragon_hextech':['jesse-science','goku-power'],
 'dragon_chemtech':['gru-answer','this-is-fine'], 'dragon_elder':['thanos-snap','palpatine-power'],
 'victory':['tobey-dance','minions-dance'], 'defeat':['michael-no','emotional-damage'],
 'game_end':['spongebob-ready','terminator-back'], 'objective_steal':['swiper-steal','cena-invisible','thanos-myself'],
 'level_up':['spongebob-ready','gru-answer'], 'ultimate_learned':['goku-power','palpatine-power'],
 'ability_rank_up':['jesse-science','gru-answer'], 'respawn':['strange-bargain','terminator-back','spongebob-ready'],
 'inventory_added':['krabs-money','fry-money'], 'inventory_removed':['patrick-money','michael-no'],
 'possible_purchase':['krabs-money','patrick-money'], 'possible_item_upgrade':['jesse-science','goku-power'],
 'possible_consumable_use':['baymax-bump','simba-grub'], 'possible_base_visit':['strange-bargain','homer-bush'],
 'low_health':['this-is-fine','michael-no'], 'heavy_health_loss':['emotional-damage','michael-no'],
 'large_heal':['baymax-bump','katara-water'], 'resource_spent':['patrick-money','this-is-fine'],
 'possible_combat':['elmo-fire','thanos-myself'], 'low_hp_kill':['thanos-myself','squidward-dab'],
 'low_hp_multikill':['goku-power','thanos-snap'], 'possible_low_hp_escape':['cena-invisible','homer-bush'],
 'possible_teamfight':['avengers','elmo-fire'], 'possible_objective_fight':['gandalf-pass','ralph-wreck'],
 'possible_power_spike':['gru-answer','goku-power'], 'cs_milestone':['patrick-money','stonks'],
 'vision_activity':['cena-invisible','rock-eyebrow'], 'manpower_advantage':['thanos-myself','avengers'],
 'possible_roam':['mcqueen-speed','cena-invisible'], 'possible_jungle_activity':['simba-grub','homer-bush'],
}
PRIMARY = {'game_start':'spongebob-ready','assist':'gru-answer','inventory_added':'krabs-money',
           'inventory_removed':'patrick-money','vision_activity':'cena-invisible','respawn':'strange-bargain',
           'manpower_advantage':'thanos-myself','inhibitor_respawned':'gandalf-pass'}


def seed(config, assets):
    if config.get('variety_pack_version') == 1:
        return 0
    lookup={a['id']:a for a in assets}
    count=0
    for key, extra in EXTRAS.items():
        rule=config['events'].get(key)
        if not rule or not rule.get('media','').startswith('media/meme-') or rule.get('media_pool'):
            continue
        # Give longer beats to high-impact events, shorter beats to routine ones.
        base=2.5 if rule['priority']>=90 else 2.2 if rule['priority']>=65 else 1.8 if rule['priority']>=35 else 1.4
        primary=PRIMARY.get(key,rule['media'][11:-4])
        ids=list(dict.fromkeys([primary,rule['media'][11:-4],*extra]))
        entries=[]
        for index,slug in enumerate(ids):
            a=lookup[slug]
            duration=round(max(1,min(2.5,base-(index%3)*.2,a['duration']-a['start_time'])),1)
            entries.append({'media':a['media'],'duration':duration,'start_time':a['start_time'],'loop':False})
        rule.update(entries[0]);rule['media_pool']=entries[1:];rule['pool_enabled']=True
        count+=1
    config['variety_pack_version']=1
    return count


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--assign',action='store_true');args=parser.parse_args()
    manifest_path=ROOT/'meme_pack.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        additions=list(pool.map(download,PICKS))
    assets={a['id']:a for a in manifest['assets']}
    assets.update({a['id']:a for a in additions});manifest['assets']=list(assets.values())
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Prepared',len(additions),'new animations;',len(assets),'total.')
    if args.assign:
        sys.path.insert(0,str(ROOT.parents[1]));sys.path.insert(0,str(ROOT.parent))
        from lib.settings_backups import SettingsBackups
        from league_api.main import load_config
        from league_api.editor import SettingsStore,validate_rule
        from league_api.presentation import capture
        config=load_config()
        if config.get('presentation')!='memes': raise ValueError('Switch to Meme pack before seeding demo pools')
        count=seed(config,manifest['assets'])
        if count:
            for key,rule in config['events'].items():config['events'][key]=validate_rule(rule,custom=key.startswith('custom_'))
            config['presentations']['memes']=capture(config)
            SettingsBackups().snapshot()
            SettingsStore(ROOT/'alerts.json').save(config)
        print('Seeded',count,'event pools. Existing custom pools/settings retained.')


if __name__=='__main__':main()
