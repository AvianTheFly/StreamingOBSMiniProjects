"""Download the curated demo animations; never overwrite event settings here."""
import concurrent.futures
import html
import json
from pathlib import Path
import re
import subprocess
import requests

ROOT = Path(__file__).resolve().parents[1] / 'mini projects' / 'league_api'
# Source-page links are retained so each selection can be reviewed or replaced.
PICKS = [
 ('toph-armor', 'Toph · metal armor', 'Earthbender armor for Mountain Dragon.', '/view/toph-earth-gif-19798404', ['dragon_earth']),
 ('katara-water', 'Katara · waterbending', 'Ocean Dragon comes with a waterbending lesson.', '/view/waterbending-katara-avatar-the-last-airbender-launching-an-attack-avatar-the-last-airbender-gif-6056691136052577982', ['dragon_water','large_heal']),
 ('zuko-fire', 'Zuko · firebending', 'Infernal Dragon: Fire Nation privileges.', '/view/avatar-zuko-agni-kai-gif-25749112', ['dragon_fire']),
 ('mcqueen-speed', 'Lightning McQueen · I am speed', 'Cloud Dragon means speed. Also a roaming joke.', '/view/speed-i-am-speed-lightning-mcqueen-cars-meme-gif-14031708', ['dragon_air','possible_roam']),
 ('palpatine-power', 'Palpatine · unlimited power', 'Lightning for Hextech; absurd power for Elder.', '/view/unlimited-power-palpatine-star-wars-gif-17950416', ['dragon_hextech','dragon_elder','ultimate_learned']),
 ('jesse-science', 'Jesse Pinkman · science', 'Chemtech is a chemistry experiment.', '/view/breakingbad-science-yeah-science-gif-5954775', ['dragon_chemtech','possible_item_upgrade']),
 ('thanos-snap', 'Thanos · snap', 'The enemy team has left the chat.', '/view/thanos-thanos-snap-gif-8045987460909459081', ['ace','pentakill']),
 ('tobey-dance', 'Tobey Maguire · victory dance', 'A little victory lap after a win or a multikill.', '/view/spiderman-tobey-maguire-dance-dancing-swag-gif-4628441', ['victory','double_kill','triple_kill','quadra_kill']),
 ('michael-no', 'Michael Scott · no!', 'An appropriately dramatic reaction to dying or losing.', '/view/no-god-please-no-no-please-no-no-god-no-yelling-gif-26334008', ['death','defeat']),
 ('swiper-steal', 'Swiper · stealing', 'The objective was borrowed without permission.', '/view/stealing-sneaky-dora-swiper-got-em-gif-18068456', ['objective_steal']),
 ('goku-power', 'Goku · Super Saiyan', 'Level-ups, power spikes, and unlikely low-health wins.', '/view/dragon-ball-super-saiyan-goku-gif-5009523', ['level_up','ability_rank_up','possible_power_spike','low_hp_kill','low_hp_multikill']),
 ('fry-money', 'Fry · take my money', 'Shopping trip detected. Financial decisions were made.', '/view/shut-up-and-take-my-money-gif-13250127', ['possible_purchase','inventory_added','inventory_removed']),
 ('elmo-fire', 'Elmo · chaos', 'A teamfight, or several unrelated disasters close together.', '/view/excited-fuego-gif-26833875', ['possible_teamfight','possible_objective_fight','possible_combat']),
 ('emotional-damage', 'Steven He · emotional damage', 'A large chunk of your health just disappeared.', '/view/steven-he-emotional-damage-steven-he-emotional-damage-gif-23428142', ['heavy_health_loss']),
 ('baymax-bump', 'Baymax · fist bump', 'Support-player appreciation.', '/view/fist-bump-big-hero-six-baymax-balalalala-bye-gif-16204318', ['assist']),
 ('minions-dance', 'Minions · reporting for duty', 'Literal minions arriving for their shift.', '/view/dancing-minion-gif-24225602', ['game_start','minions_spawning']),
 ('ralph-wreck', 'Ralph · wreck it', 'Tower demolition and Herald doing Herald things.', '/view/wreckitralph-wreck-ralph-imgonnawreckit-gif-4788892', ['turret_destroyed','first_turret','inhibitor_destroyed','herald']),
 ('simba-grub', 'Simba · slimy yet satisfying', 'Void Grubs: the forbidden snack.', '/view/simba-thelionking-slimy-satisfying-gif-5416128', ['void_grub','possible_jungle_activity']),
 ('terminator-back', 'Terminator · I will be back', 'Respawns and structures returning from the dead.', '/view/ill-be-back-sunglasses-terminator-arnold-schwarzenegger-gif-15916083', ['respawn','inhibitor_respawning_soon','inhibitor_respawned']),
 ('stonks', 'Stonks', 'Farming milestones and numerical advantages.', '/view/stonks-up-stongs-meme-stocks-gif-15715298', ['cs_milestone','manpower_advantage']),
 ('rock-eyebrow', 'The Rock · eyebrow', 'Vision detected. Someone is being watched.', '/view/rock-one-eyebrow-raised-rock-staring-the-rock-gif-22113367', ['vision_activity']),
 ('homer-bush', 'Homer · disappearing into the hedge', 'Survived on a sliver of health. Quietly leave.', '/view/the-s-impsons-bush-homer-simpsons-homer-hiding-gif-4325800', ['possible_low_hp_escape','possible_base_visit']),
 ('this-is-fine', 'This is fine', 'Low health, no resources, and impeccable composure.', '/view/this-is-fine-gif-24177057', ['low_health','resource_spent','possible_consumable_use']),
 ('squidward-dab', 'Squidward · dab', 'A short, undeservedly confident celebration.', '/view/squidward-dab-dabbing-gif-13749351', ['kill','first_blood']),
 ('avengers', 'Avengers · assemble', 'Big-monster objectives require the whole squad.', '/view/captain-america-avengers-assemble-gif-22306281', ['baron','dragon','atakhan_legacy','game_end']),
]


def download(pick):
    slug, title, joke, page, events = pick
    source = 'https://tenor.com' + page
    response = requests.get(source, timeout=30)
    response.raise_for_status()
    match = re.search(r'property="og:video" content="([^"]+\.mp4)"', response.text)
    if not match:
        raise ValueError('No MP4 found: ' + source)
    url = html.unescape(match[1])
    destination = ROOT / 'media' / ('meme-' + slug + '.mp4')
    if not destination.exists():
        media = requests.get(url, timeout=40)
        media.raise_for_status()
        if len(media.content) > 20 * 1024 * 1024:
            raise ValueError('Animation is unexpectedly large: ' + source)
        destination.write_bytes(media.content)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
                            '-of', 'json', str(destination)], capture_output=True, text=True, check=True)
    data = json.loads(probe.stdout)
    duration = float(data['format']['duration'])
    if any(s['codec_type'] == 'audio' for s in data['streams']):
        raise ValueError('Expected a silent animation: ' + source)
    start = 1.3 if slug == 'toph-armor' else 0
    thumbnail = ROOT / 'meme_thumbnails' / (slug + '.jpg')
    thumbnail.parent.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start + min(1, duration/2)),
                    '-i',str(destination),'-frames:v','1','-vf','scale=400:-2',
                    str(thumbnail)],capture_output=True,check=True)
    return dict(id=slug, title=title, joke=joke, source=source, download=url,
                media='media/' + destination.name, duration=duration, start_time=start,
                display_seconds=round(max(1.5, min(3.5, duration-start)), 2), events=events,
                bytes=destination.stat().st_size)


def main():
    (ROOT / 'media').mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        assets = list(pool.map(download, PICKS))
    manifest = dict(name='League meme starter pack', silent=True, assets=assets)
    (ROOT / 'meme_pack.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    for asset in assets:
        print(f"{asset['id']}: {asset['duration']:.2f}s, {asset['bytes']//1024}KB")
    print(f'{len(assets)} animations prepared; event settings untouched.')


if __name__ == '__main__':
    main()
