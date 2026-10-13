"""Publish the complete original-media/animation review from finite native QA."""
import json
import re
from hashlib import sha256
from pathlib import Path
import build_joke_quality_audit as editorial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/border-lineup-audit'
UPDATED = {
 'approval': 'Stamp contact moves from 0.706 s to the 0.163 s attack. Its bottom now meets the paper exactly; release and flag unfold follow within the audible tail.',
 'lizard': 'Button contact lands at 0.113 s. Rings, wave and popcorn start afterward. A single photographic pose replaces the ghosted double-eye blend.',
 'bonk': 'The mallet lands at the first loud PCM-energy hit, 0.060 s; the later ringing peak is aftermath. There is one contact and no repeated swing.',
 'quack': 'Pointer reaches the actual X at 0.173 s, window closes afterward, and three ducks are born at 0.173/0.203/0.233 s. Escape precedes its footprint report.',
 'gary': 'Mouth opens at 0.030 s and closes at 0.360 s around the original meow. Pose cuts avoid two pairs of eyes; the biscuit remains the small supporting act.',
 'sparkles': 'Jaw grows from the 0.180 s audible onset to the strong 1.013 s vocal attack, instead of starting at 1.8 s. The star bows after the reaction.',
 'isolation': 'The reliable spoken phrase ends at 0.720 s. Cursor clicks mute at 0.760 s; notifications vanish afterward, then relief settles. A later final ping folds at the mute mark.',
 'oops': 'The anxious pose builds through the later phrase. The NO caption answers the reliable 7.560 s repetition; the final acorn tips from 8.820 s and holds. Earlier weak word timestamps are not treated as exact sync points.',
}
SOUND_TIME = {
 'tantrum':'Sprint/hurdle precede braking and slump; the click ticket is a later consequence. Continuous strides use the supplied rhythm rather than a repeated reset.',
 'kitchen':'Coffee denial precedes toaster pop, then crumbs and the level teacup response. The extra homage is described as an added joke, not as original footage.',
 'meltdown':'Three handset-answer windows escalate into unplugging and a held disconnected ending. These are visual response phrases, not claimed syllable-perfect transcription.',
 'rewind':'Shoe reaches the peel before the pivot; glasses leave after the slip, and the clue is bagged afterward. The tilted figure does not slide away from its planted pivot.',
 'violin':'Solo, string break and surrender follow in order; the tear lands before rippling the tiny boat. Bow motion accompanies the violin rather than chasing every spectral peak.',
 'spill':'Mug reaches the floor before puddle growth; the failed undo follows the spill and the discarded paper lands inside the bin.',
 'heartbreak':'The tissue/bandage action precedes the tiny hopeful sprout. The exaggerated music-video grief stays gentle and peripheral.',
 'prowler':'Hidden figure notices the ward before hiding; the footprint report is a consequence of discovery. The dark subject has eyes and a distinct silhouette, not a screen-sized shadow.',
 'arcade':'The four-step climb spans the chime; feet land on the top step before the crown. The crown is one earned reward, not a looping jump.',
 'disco':'Continuous horizontal turn leaves the shoes planted. Beat-grid error is already below one display frame; retain the approved pulse and later lace bow.',
 'coffin':'Foot/body pulses use the refined original grid. The hat completes one throw and lands back on its wearer; tea remains level while its tray wobbles.',
 'mash':'Dance motion uses the refined pulse; the snack-sized weight bite follows the flex. The missing pastry is visible in the weight geometry.',
 'crabs':'The beach ball reaches each dancer before its hop; the final dancer lands upside down before the sandcastle remembers it on its flag. Existing beat error is already small.',
 'muffins':'Keep the approved final DIE at 6.240 s, all eight deaths together, fall completed by the held ending. Neither an early lyric nor the late vowel-energy peak selects the collapse.',
 'balloons':'Refined beat grid drives the dancing Toothless. Fish remains visible through mouth contact; fishbone trophy follows the gulp.',
 'arena':'Entrance performance precedes the face-passing palm and disappearing subject. Autofocus hunts an empty portrait afterward; the abandoned belt supplies the evidence.',
 'rats':'Retain the pulse already within one frame. Recovered boot presses the ticket before its shoeprint appears, then lifts and lets the dance continue.',
 'raccoon':'Refined pulse accompanies the Pedro cameo. Record theft/bite precede the genuinely torn sleeve; the sleeve retains the damage rather than restarting the act.',
 'shades':'Retain the close original pulse. Mock-serious strut earns an overlong curling receipt, which rates itself afterward.',
 'racing':'Preserve the accelerating full-perimeter car, track and gears. Spare wheel reaches its rack before the crew raises its flag; the track never crosses gameplay.',
 'equalizer':'Refined breakfast-dance pulse accompanies oven/mitten catch. Three later slices land before the butter caps their stack.',
 'nyan':'Refined pulse supports rainbow flight and a single barrel roll. Pixel crumbs become the constellation afterward; no broad body reset or center-crossing flight.',
 'piuw':'One edge zap/flight resolves into the failed catch during the short sting; its battery is a picture-sized echo. A delayed flight is a deliberate travel phase, not a claimed second sound.',
 'hooray':'Sparse paper anticipates the audible cheer by a small prelude; smiling poppers and lifted arms develop during the sound, then paper clears. No new flood of confetti.',
 'romance':'Rose drops, rotated stem reaches the hand, then catch/lift and blush follow. The supporting response stays after the grasp.',
 'rizz':'Rose offer and sunglasses charm lead into an unfolding heart receipt and stamp. No reliable speech witness exists, so keep the finite musical-sting interpretation.',
 'weeknd':'Serenade precedes the moon blush; microphone and record settle afterward. Transparent crescent geometry supplies the moon, with no opaque masking disk.',
 'love':'Ice-cream microphone belongs to the local Super Idol-themed clip; the flower claps once as audience response. No inferred exact foreign-language lyric timing.',
 'catlove':'Horizontal turn remains planted on its banana floor, with a moon/cat partner duet. The musical loop supplies the tone without a whole-body tumble.',
 'falling':'One arrow follows the perimeter route back into Cupid; its tip reaches the face before heart eyes, and the trail fades afterward.',
 'mom-frog':'Original frog photograph and microphone carry the dry croak; two spectators wake after onset. No caption-dependent dialogue is added to the half-second cue.',
 'intro':'Return lever causes battery refill and BACK flag, then the uplift holds. Failed speech recognition does not invent a lyric or replace the original welcome cue.',
}
LEAGUE_TIME = {
 'kill':'Sword action earns a star before the target surrenders.',
 'assist':'Hands meet before their shared vine blossoms.',
 'first_blood':'Single soda burst precedes first-crown opening; droplet births do not repeat.',
 'low_hp_kill':'Reward/cape celebrate the clutch while the meter remains low.',
 'low_hp_multikill':'Three rewards precede the cape; the one-HP meter stays low.',
 'ace':'Five rewards remain five; a late speck arrives before the broom returns for its second sweep.',
 'double_kill':'Two medals and paired pennants lead to actual fist contact, then a held pair.',
 'triple_kill':'Three actual five-point stars hop once into the rack and settle on its surface.',
 'quadra_kill':'Four petals unfold through one quarter-turn into a stable distinct crest.',
 'pentakill':'One five-string strum sequences five lights and crown bloom, then holds.',
 'manpower_advantage':'Newcomer joins the marching group; no invented team-size number is displayed.',
 'dragon':'Wing opening develops with the living mountain; sustained ambience breathes without replaying the finite entrance.',
 'dragon_earth':'Crooked peaks grow before leaves; quiet stone/sprout ambience continues independently.',
 'dragon_fire':'Tail flame is established before the marshmallow toasts; sparks have a single finite birth window.',
 'dragon_water':'Rain establishes ripples and prompts the duck umbrella before it ends.',
 'dragon_air':'Plane glides through the cloud habitat once during the event; sustained wind remains gentle.',
 'dragon_hextech':'Approved artwork remains pixel-identical to HEAD at entrance, middle and exit.',
 'dragon_chemtech':'Botanical bubbles precede the flask flower; finite bubbles do not recycle after their window.',
 'dragon_elder':'Sleepy wisps rise gently through the moon gate; the finite phrase settles.',
 'baron':'Empowered friend tries large horns, wobbles and balances after the monster performance.',
 'herald':'Shell creature completes one upright hop before the monocle meets its one eye.',
 'void_grub':'Three staggered hops include the late waking third grub; all end on the ground.',
 'objective_steal':'One star follows a continuous perimeter route into the hand before escape; empty box produces its IOU afterward.',
 'atakhan_legacy':'One quiet thorn-rose bloom; the saved optional legacy event is preserved.',
 'turret_destroyed':'Growth completes before crushing; rubble settles without regrowing. Safety cone responds to dust.',
 'first_turret':'Same grow/crush order; first reward coins follow collapse, and the cone shelters from dust.',
 'inhibitor_destroyed':'Crystal growth, crushing and settled fragments occur in order.',
 'inhibitor_respawning_soon':'Separate waiting orbit signals anticipation; it does not depict restoration early.',
 'inhibitor_respawned':'Fragments join once into a restored crystal, with zero remaining spread at the end.',
 'death':'Four sleeping spirits use the sustained elapsed clock; no wake/respawn sequence replays during death.',
 'respawn':'Requested turtle, phoenix, ram and bear wake in their four sections, rise once and finish with thin thematic contours.',
 'low_health':'Worried heart remains in a low state; the act does not suggest healing.',
 'heavy_health_loss':'Heart recoils from loss and settles; character reaction stays distinct from the healing bloom.',
 'large_heal':'Restoration develops through the sprout and heart recovery, then settles once.',
 'resource_spent':'Energy decreases monotonically to empty; one final drop follows depletion, with no refill.',
 'level_up':'Feet reach the stair before the reward star; the climb finishes on its platform.',
 'ultimate_learned':'Shackle opens once without a duplicate closed ring; the earned star follows.',
 'ability_rank_up':'Ability notches fill in sequence before the lane friend celebrates the new rung; the earned ending holds without repeating the upgrade.',
 'inventory_added':'New gem fits its satchel slot before the happy backpack waves.',
 'inventory_removed':'Gem leaves its slot before the backpack gives its goodbye wave.',
 'cs_milestone':'Harvested heads fall before coins; scarecrow tips its hat after the crop reward.',
 'vision_activity':'Fog clears before the leaf-disguised friend gives its sheepish wave; illustrative friend is not an asserted enemy detection.',
 'game_start':'Gates open to admit the small parade, then the sunrise star settles.',
 'minions_spawning':'Two lane parades and waving flags make one spawning procession.',
 'victory':'Cup, star and friend celebrate in sequence; finite paper clears without a repeating burst.',
 'defeat':'Rain waters the sprout before its leaves thank the smiling cloud; the storybook offers a quiet next page.',
 'game_end':'Bookmark enters before cover folds and book width closes into its held silhouette.',
 'possible_purchase':'Coin approaches a bag under a persistent question; no completed transaction is asserted.',
 'possible_item_upgrade':'Larger gem outline is a tentative try-on with its question, not a confirmed upgrade.',
 'possible_consumable_use':'Single fizz window and question preserve uncertainty; no character confirms consumption.',
 'possible_base_visit':'Small door opens tentatively with a question; no arrival is asserted.',
 'possible_combat':'Blades approach without confirmed contact and retain the question.',
 'possible_low_hp_escape':'Worried heart approaches outlined safety with a question; no triumphant confirmed escape.',
 'possible_teamfight':'Friends form a partial circle around the question, without a confirmed fight.',
 'possible_objective_fight':'Two friends approach the same questioned star; neither wins or steals it.',
 'possible_power_spike':'Rocket sprout lifts tentatively under a question; no earned reward confirms the inference.',
 'possible_roam':'Plane position follows its winding route and tangent with the question overhead.',
 'possible_jungle_activity':'Firefly peeks hesitantly from sprouts; the question remains visible.',
 'custom_e8bf37104ae1':'Generic rune constellation is preserved; disabled personal rule remains disabled and receives no invented subject.',
}


def build():
    qa = json.loads((ROOT/'output/thematic-borders/checks.json').read_text())
    contact = json.loads((OUT/'contact-checks.json').read_text())
    study = json.loads((OUT/'original-timing-study.json').read_text())
    assert qa['passed'] and qa['live'] and not qa['livePlaybackReused']
    assert contact['passed'] and contact['frames'] == 48
    for proof in (qa, contact):
        for name, digest in proof['fingerprints'].items():
            assert sha256((ROOT/name).read_bytes()).hexdigest() == digest, name
    assert set(UPDATED)|set(SOUND_TIME) == {r['key'] for r in qa['sounds']}
    assert set(LEAGUE_TIME) == {r['key'] for r in qa['league']}
    assert len(study) == 40
    studies = {r['key']:r for r in study}
    changed = set(UPDATED)|{'coffin','mash','balloons','raccoon','equalizer','nyan'}
    lines = ['# Sound and border lineup audit — October 9, 2026', '',
        'All 40 selected original clips and all 58 built-in League event borders plus the existing disabled custom rule were reviewed individually. '
        '14 sound performances received timing or visual corrections; 26 sounds and 59 League entries were deliberately retained after checking their context, causal actions and held endings. '
        'This builds on the prior complete redesign and joke-quality pass, not a replacement of personalized settings.', '',
        '## Timing corrections', '',
        'Measured contacts use original clip seconds through the existing audio clock. Approval stamps at 0.163 s; the button presses at 0.113 s; '
        'Bonk meets the first loud impact at 0.060 s; QUACK.EXE closes after the pointer reaches its X at 0.173 s. '
        'Gary’s mouth follows the meow; the anime jaw responds during the voice; the mute click promptly answers the completed phrase; '
        'the worried acorn sequence responds to later NO repetitions. Photographic button poses no longer blend doubled eyes.', '',
        '## Dance grids', '',
        'A 10 ms PCM study compares positive spectral flux with an independent low-frequency witness. '
        'Only stable nearby attacks refine the already authored tempo family; this is a local phase/cadence fit, not a claim about the song’s official BPM. '
        'The old grids remain reproducible in the review context. Profile BPM, original media and playback speed are unchanged.', '',
        '| Cue | Before RMS | After RMS | Matched attacks | Visual BPM / offset |',
        '| --- | --- | --- | --- | --- |']
    for key in ['coffin','mash','balloons','raccoon','equalizer','nyan']:
        s=studies[key]; f=s['beat_fit']
        assert f['supported'] and f['new_rms_ms']<f['old_rms_ms']
        lines.append(f"| {s['name']} | {f['old_rms_ms']:.2f} ms | {f['new_rms_ms']:.2f} ms | {f['matched']}/{f['ticks']} | {f['bpm']:.5f} / {f['offset']:.5f} s |")
    lines += ['', 'The other measured dance grids were already close and are retained, including the approved accelerating car. '
              'Muffin keeps the approved final 6.240 s DIE and simultaneous eight-character collapse; Hextech is unchanged.', '',
              '## Evidence limits and event clocks', '',
              'Speech witnesses come from a cached local recognizer, not a new playback listener. Only the reliable completed “Leave me alone” phrase and '
              'late NO repetitions support precise word-linked changes. Low-confidence “now” for Hooray and “Oh” for the John Cena entrance are rejected. '
              'Anime-wow timing uses the PCM onset and attack rather than an uncertain recognizer onset. Intro and Rizz do not yield reliable words. '
              'Bonk’s first energy peak lies near the spectral-analysis boundary; the later ringing peak must not be mistaken for its initial impact.', '',
              'League production borders consume their existing event elapsed/duration clocks. Their saved production event options specify no attached audio; '
              'optional alert videos, audio and media pools are separately owned. This review checks event meaning and action order, without asserting a fixed beat/lyric alignment '
              'to arbitrary optional pool assets. Inferred events retain visible questions and tentative actions. All saved preferences and disabled rules remain preserved.', '',
              '## Every sound', '', '| Cue | Decision | Timing / visual accuracy | Context and joke relevance |', '| --- | --- | --- | --- |']
    decisions=[]
    for family, temporal, relevance in [('sounds',{**SOUND_TIME,**UPDATED},editorial.SOUNDS),('league',LEAGUE_TIME,editorial.LEAGUE)]:
        if family=='league':
            lines += ['', '## Every League border', '', '| Event | Decision | Timing / visual accuracy | Context and joke relevance |', '| --- | --- | --- | --- |']
        for r in qa[family]:
            key=r['key']; decision='Corrected' if family=='sounds' and key in changed else 'Reviewed; retained'
            notes=temporal[key]
            if family=='sounds':
                s=studies[key]
                assert s['sha256']==qa['originalMedia'][r['name']]
                notes+=f" Original: {s['container_duration']:.3f} s; audible window {s['first_audible']:.2f}–{s['last_audible']:.2f} s."
            result=relevance[key][2]
            lines.append(f"| {r['name']} | {decision} | {notes} | {result} |")
            decisions.append(dict(family=family,key=key,name=r['name'],decision=decision,timing=notes,context=result,performance=r['story']))
    offline=(ROOT/'output/thematic-borders/audit-offline-tests.log').read_text(encoding='utf-8',errors='replace')
    suite=re.search(r'Ran (\d+) tests in ([\d.]+)s',offline)
    assert suite and re.search(r'^OK\s*$',offline,re.M)
    arch=(ROOT/'output/thematic-borders/audit-architecture.log').read_text(encoding='utf-8',errors='replace')
    assert '0 violations' in arch
    painted=max(f['painted'] for r in qa['league'] for f in r['frames'])/20736
    solid=max(f['solid'] for r in qa['league'] for f in r['frames'])/20736
    assert len(decisions)==99
    lines += ['', '## Final native verification', '',
        f'All 40 originals played through their own ended events with the final compiled renderer; all 99 performances supplied nine story samples, '
        f'exact reverse seeks, entrance/end cleanup and transparent gameplay-center checks. '
        f'48 additional native frames bracket the eight corrected cue contacts; the tests cover the real stamp plane, cursor/X contact before closing, '
        f'staggered duck births and phrase-before-mute order. The photographed button pose correction was checked in its enlarged native strip. '
        f'Maximum sampled League coverage is {painted:.2f}% painted and {solid:.2f}% solid. '
        f'Existing rose/Cupid/hat/fish/stair/energy/throw/tea/boot/broom/grub checks and the 210-frame reaction review pass. '
        f'{int(suite.group(1)):,} offline tests pass; {arch.strip()}.', '',
        'Finite preview and pixel comparisons use a consistent CPU readback backend for exact seek checks; equality was not weakened. '
        'No OBS or Hub was launched or controlled. Original media, mappings, volumes, phrases, filters, layouts and replay paths are preserved. '
        'Changes are static artwork and compile into the existing delivery route.', '',
        'Interactive original-audio preview: [preview.html](../output/thematic-borders/preview.html). '
        'Individual enlarged attack frames and raw timing/speech witnesses are in `output/border-lineup-audit/`.', '']
    report=dict(passed=True,cues=99,correctedSounds=14,retainedSounds=26,retainedLeague=59,decisions=decisions,
                fingerprints=qa['fingerprints'],criticalFrames=48,offlineTests=int(suite.group(1)),coverage=dict(leaguePaintedPercent=painted,leagueSolidPercent=solid))
    (ROOT/'docs/BORDER-LINEUP-AUDIT-20261009.md').write_text('\n'.join(lines),encoding='utf-8')
    (OUT/'individual-decisions.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Published full lineup audit: 99 individual reviews, 14 corrected sounds, 26 retained sounds, 59 reviewed League entries.')


if __name__=='__main__':
    build()
