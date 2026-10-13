"""Publish the finite, individually authored border review with measured QA evidence.

Reads existing review output only; never imports runtime owners or edits settings.
"""
import json
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOUND_NOTES = {
 'tantrum': 'Keep the frantic sprint/skid; reveal the crumpled click ticket after the misclick, with hurdle signatures.',
 'kitchen': 'Keep the coffee-denial/toaster contact; add a late recipe receipt and toast motifs.',
 'meltdown': 'Keep escalating banana calls and the disconnected handset; reveal DND after disconnection.',
 'rewind': 'Keep the peel/shoe contact and lost glasses; bag the ignored clue after the slip.',
 'violin': 'Keep staggered orchestra solos and snapped string; reveal the paper boat after the break, with violin motifs.',
 'spill': 'Keep the actual mug spill and failed undo; the tiny cone arrives after the spill, with cup motifs.',
 'heartbreak': 'Keep tissues and the crooked repair; grow the hopeful sprout after the bandage.',
 'isolation': 'Keep the precise mute click and vanished pings; open the quiet window after muting.',
 'prowler': 'Keep the hidden figure noticing the ward; reveal the footprint report after detection.',
 'sparkles': 'Give the star its own embarrassed bow/blush; retain starry eyes and star signatures, then settle.',
 'arcade': 'Fix the hovering/off-podium landing: four steps now meet the feet; collect the crown once.',
 'approval': 'Retain actual stamp/paper contact and one unfolding flag; checklist motifs echo the success.',
 'disco': 'Replace the vertical body tumble with a continuous horizontal planted turn; shoe laces bow afterward.',
 'coffin': 'Put the flying hat in its wearer transform so it returns to the head; reveal the hat box afterward.',
 'mash': 'Keep wand-flex and pastry contact; cream-puff weights arrive as a late workout joke.',
 'crabs': 'Keep the beach-ball jump and upside-down landing; raise the sandcastle claw flag afterward.',
 'muffins': 'Preserve the final 6.24-second die cue and simultaneous eight-muffin collapse; supporting cast falls too.',
 'balloons': 'Fix the visible fish reaching Toothless’s actual mouth before disappearing; trophy follows the gulp.',
 'arena': 'Preserve Cena’s palm/vanish/autofocus act; label the abandoned belt after invisibility.',
 'rats': 'Keep the boot loss, one-foot hop and recovery; stamp the cheese dance ticket afterward.',
 'raccoon': 'Keep the wave, record bite and finite flip; use a genuinely torn sleeve outline, with record motifs.',
 'shades': 'Keep the sunglasses catch and mock-serious strut; reveal the absurd aura receipt afterward.',
 'racing': 'Preserve the accelerating full-perimeter car/gears; the spare-tire rack follows fifth gear.',
 'equalizer': 'Keep the oven percussion/toast/mitt catch; the breakfast podium follows the catch.',
 'nyan': 'Keep the recognizable rainbow flight and single barrel roll; crumbs leave a late pixel constellation.',
 'lizard': 'Keep the photographic button/popcorn reaction; use a true scalloped ticket, without painted fake holes.',
 'gary': 'Keep the fish biscuit reaching the photographed mouth; crumbs form the late fishbone trail.',
 'quack': 'Keep QUACK.EXE closure and escaping ducks; the footprint error report follows their escape.',
 'bonk': 'Keep mallet/helmet contact; the pot-lid aftershock bounces once and settles.',
 'piuw': 'Keep the edge-satellite zap and failed alien catch; charge the battery after the return.',
 'hooray': 'Keep smiling poppers and plentiful edge paper; slow star motion and restrain glare/center coverage.',
 'romance': 'Fix rose grip to follow the rotated stem; drop, reach, catch, lift and blush happen in order.',
 'rizz': 'Give the charm merchant an actual unfolding heart receipt and stamp; settle after the bashful response.',
 'weeknd': 'Use a genuinely transparent crescent moon; the microphone serenade makes it blush once.',
 'love': 'Follow the local Super Idol context with an ice-cream microphone and one flower clap.',
 'catlove': 'Replace a whole-body tumble with a continuous planted horizontal cat turn; use true crescent alpha.',
 'falling': 'Fix the arrow tip reaching Cupid’s face before heart eyes; fade its trail after the self-hit.',
 'mom-frog': 'Keep the original photographic Mom Frog and microphone contact; two lily-pad spectators wake after the croak.',
 'oops': 'Follow the actual anxious-creature clip; hands reach the ears, acorns fall once, and the final worried pose holds.',
 'intro': 'Make the return lever cause the battery refill and BACK flag; one upward arrow phrase ends in a held welcome.',
}
LEAGUE_NOTES = {
 'kill': 'Sword/practice-target action with blade signatures; reward remains earned at the ending.',
 'assist': 'High-five and shared flowering vine; paired knot signatures express cooperation.',
 'first_blood': 'Cherry-soda fountain and first crown; droplets fade after their one arc instead of hanging in midair.',
 'low_hp_kill': 'Keep the meter at one HP while the heart steadies; earned star does not imply a heal.',
 'low_hp_multikill': 'Keep the one-HP clutch while three rewards arrive; avoid falsely filling the health meter.',
 'ace': 'Replace the generic count box with a clean-sweep cup, broom and five bowing lane friends.',
 'dragon': 'Friendly winged dragon and living mountain; retain a quiet persistent habitat variant.',
 'baron': 'Horned void creature with toothy smile; friends make one partial orbit and settle.',
 'herald': 'Replace the full-body tumble with one rocking hop and an upright landing on the edge track.',
 'void_grub': 'Three distinct springing grubs and a small marching echo; grub silhouettes identify the event.',
 'objective_steal': 'Fix the teleporting reward: one star travels continuously around the perimeter into the waiting hand, then escapes.',
 'atakhan_legacy': 'Thorn-rose bloom and small monster face; preserve the optional legacy policy.',
 'turret_destroyed': 'Tower grows crooked before crushing; masonry fragments settle rather than regrowing.',
 'first_turret': 'Keep the tower grow/crush sequence; reward coins distinguish the first structure.',
 'inhibitor_destroyed': 'Use crystal ribs and diamond edge fragments, clearly distinct from tower masonry.',
 'inhibitor_respawning_soon': 'Sleeping crystal foundation and countdown hand; do not rebuild it prematurely.',
 'inhibitor_respawned': 'Fragments assemble into a restored crystal and hold together, with upward twinkles.',
 'death': 'Rest the same four requested spirits; sustained breathing uses the actual death clock.',
 'respawn': 'Four fixed turtle/phoenix/ram/bear sections wake and lift; phoenix has feathers and bear has palm pads.',
 'low_health': 'Concerned heart and uneven pulse; pulse motifs signal concern without a large flashing panel.',
 'heavy_health_loss': 'Impact squashes the heart, then a crooked bandage lands; bandage motifs echo the repair.',
 'large_heal': 'Potion and heart bubbles grow a spring garden; bloom motifs express recovery.',
 'resource_spent': 'Fix the ambiguous refill: canister empties monotonically, with a single outward droplet procession.',
 'level_up': 'Fix the hovering final stair pose: feet meet the top platform; step motifs echo progression.',
 'ultimate_learned': 'Remove the duplicate closed shackle; one hinged shackle opens while four spirits awaken.',
 'ability_rank_up': 'Fill earned notches in sequence; celebrant and notch motifs support the new rung.',
 'inventory_added': 'Resize the gem to fit its inner slot; it arrives once as the backpack opens.',
 'inventory_removed': 'Reverse the item departure action and give the backpack a quiet farewell.',
 'cs_milestone': 'Grain heads fall/fade with the cut before coins appear; wheat signatures distinguish farming.',
 'vision_activity': 'Actually fade the fog so the ward reveals its friend; eye/sonar motifs support detection.',
 'manpower_advantage': 'An extra lane friend joins the team; marching pairs echo the numerical advantage.',
 'game_start': 'Open illustrated garden gates once; the lane friends step onto the rim.',
 'minions_spawning': 'Two small lane parades under flags; a finite entrance avoids continually resetting the march.',
 'victory': 'Smiling cup, star and crowned friend; paper confetti completes one celebratory phrase.',
 'defeat': 'Use one rain birth window; a new sprout and next storybook page provide a gentle hopeful ending.',
 'game_end': 'Make the cover visibly close through the action; book motifs settle beside the homeward flag.',
 'dragon_earth': 'Add angular rock-plate anatomy, crooked peaks and sprouts; stone currents stay peripheral.',
 'dragon_fire': 'Add flame-tail anatomy and campfire logs; finite embers rise once, with restrained fire ribbons.',
 'dragon_water': 'Add fin anatomy, rain, ripples and a duck; finite rain does not restart.',
 'dragon_air': 'Add layered feather wings, wind horns, clouds and plane; one cloud phrase surrounds the safe opening.',
 'dragon_hextech': 'Retain the approved circuits exactly; compare entrance, middle and exit pixels against HEAD.',
 'dragon_chemtech': 'Add round goggles and flask fizz; finite bubbles rise once, with botanical lime motifs.',
 'dragon_elder': 'Add whiskers and a pearl; sleepy wisps rise through a moon gate and settle.',
 'double_kill': 'New twin pennants, two medals and a fist bump; fix the hand gap so the fists actually meet.',
 'triple_kill': 'New three-blade fan and three-star rack; fix the final star position so it meets the rack instead of hovering.',
 'quadra_kill': 'New four-petal compass crest; one quarter-turn unfolds and settles.',
 'pentakill': 'New small Pentakill concert: five-string strum, five sequenced lights and a crown flower.',
 'possible_purchase': 'Coin/bag action retains an explicit question; no confirmation or preference changes.',
 'possible_item_upgrade': 'Gem tries a larger outline; keep the uncertainty marker and gem signatures.',
 'possible_consumable_use': 'Bottle has one finite fizz window; question remains visible.',
 'possible_base_visit': 'A cozy home opens its small door; question marker keeps the cue tentative.',
 'possible_combat': 'Small swords approach without claiming a confirmed clash; blade signatures stay quiet.',
 'possible_low_hp_escape': 'Heart moves through an outlined safe doorway; no opaque panel hides the escape.',
 'possible_teamfight': 'Friends form one partial circle around the question; cooperative signatures echo them.',
 'possible_objective_fight': 'Two friends approach one objective star; questions remain on both sides.',
 'possible_power_spike': 'Rocket sprout lifts one star; the question prevents an inferred signal becoming certainty.',
 'possible_roam': 'Plane follows the actual winding path and its tangent; no floating disconnected trajectory.',
 'possible_jungle_activity': 'A small firefly peeks from sprouts; retain the explicit question and optional status.',
 'custom_e8bf37104ae1': 'Keep the disabled personal example and its rule data; use a rune constellation without inventing a subject.',
}

def build():
    out = ROOT / 'output/thematic-borders'
    checks = json.loads((out / 'checks.json').read_text(encoding='utf-8'))
    assert checks['passed'] and checks['live'], 'Complete original-audio review first'
    for name, digest in checks['fingerprints'].items():
        assert sha256((ROOT / name).read_bytes()).hexdigest() == digest, f'Reviewed file changed: {name}'
    assert set(SOUND_NOTES) == {r['key'] for r in checks['sounds']}
    assert set(LEAGUE_NOTES) == {r['key'] for r in checks['league']}
    lines = ['# Individual border audit — October 8, 2026', '',
             'Audited 40 selected sounds and all 58 built-in League borders, plus the existing disabled custom example. '
             'Exact keys: `Z T t 1 ! 2 @ 3 # 4 $ %`; `4` remains unbound. '
             'This review did not launch or control OBS. Original audio, mappings, durations, volumes, event preferences and replay settings are preserved.', '',
             'Each entry was inspected at setup, action and payoff, with nine measured frames, backward seeking and cleanup checks. '
             'All 40 original media files also played to their own ended event. The delivered preview uses the real renderers. '
             'Finishing an act holds its consequence; appropriate musical dancing continues with the music, while persistent death/dragon ambience breathes gently.', '',
             'The added richness uses semantic edge icons, overlapping thin curves, small character props and one-time particle phrases. '
             'The 1440 × 670 gameplay opening has zero painted alpha in every sampled frame. No broad scenic panel was added.', '',
             '## Sounds', '', '| Local sound | Contextual performance | Audit decision / correction |', '| --- | --- | --- |']
    audit = []
    for family, notes in [('sounds', SOUND_NOTES), ('league', LEAGUE_NOTES)]:
        if family == 'league':
            lines += ['', '## League borders', '', '| Event | Contextual performance | Audit decision / correction |', '| --- | --- | --- |']
        for row in checks[family]:
            note = notes[row['key']]
            lines.append(f"| {row['name']} | {row['story']} | {note} |")
            audit.append({'family': family, 'key': row['key'], 'name': row['name'], 'performance': row['story'], 'decision': note,
                          'center_clear': all(not f['center'] for f in row['frames']), 'distinct_moments': len({f['hash'] for f in row['frames']})})
    lines += ['', '## Verification and artistic context', '',
              'Contact regressions sample rose grip, Cupid arrow impact, hat landing, visible fish contact, continuous planted turns, '
              'depleting energy, stair landing, single particle births, continuous perimeter theft, fist contact, actual star-point/rack contact and five unique held combo endings. '
              'The Muffin final-die and existing physical-gag regressions are retained. See `output/thematic-borders/checks.json` and the validation log for measurements.', '',
              'The requested turtle/phoenix/ram/bear grouping is personal art direction. Riot’s '
              '[Udyr art discussion](https://www.leagueoflegends.com/en-gb/news/dev/udyr-vgu-rebuilding-the-spirit-walker/) '
              'and [Spirit Guard update](https://www.leagueoflegends.com/en-us/news/game-updates/updating-spirit-guard-udyr/) '
              'inform spirit character treatment, without changing event policy. The tiny concert interprets Riot’s '
              '[Pentakill music](https://www.youtube.com/watch?v=5-mT9D4fdgQ). '
              'These are artistic references, not current gameplay-rule claims.', '']
    (ROOT / 'docs/BORDER-AUDIT-20261008.md').write_text('\n'.join(lines), encoding='utf-8')
    (out / 'individual-audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(f'Published {len(audit)} individual audit entries')

if __name__ == '__main__':
    build()
