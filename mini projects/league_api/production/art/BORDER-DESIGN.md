# Authored League border review — 2026-10-13

The actual detector is the authority for what happened. Each finite event has
its own composition, spatial blocking, buildup and consequence. Shared geometry
and materials supply no default four-corner frame. The main event title is the
only decorative text; sustained death retains its functional return timer.

## Research and interpretation

- [Riot game guide](https://www.leagueoflegends.com/en-us/how-to-play/): Nexus,
  structures, experience, inventory and Baron's empowered-minion role.
- [Patch 26.1](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-26-1-notes/):
  individual Grub rewards and Herald's turret-charge role. One HordeKill means
  one Grub, not the entire camp.
- [2026 season preview](https://www.leagueoflegends.com/en-ph/news/dev/dev-2026-season-one-gameplay-preview/):
  Atakhan removal and first-blood/first-turret gold. Atakhan stays an optional
  legacy trigger with thorn/rose imagery.
- [Elemental update](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-23-notes/):
  Infernal power, Mountain defenses, Ocean recovery and Elder execution themes.
- [Hextech/Cloud update](https://www.leagueoflegends.com/en-us/news/game-updates/patch-11-23-notes/):
  haste/attack-speed circuitry and Cloud mobility.
- [Chemtech return](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-22-notes/):
  resilience, healing and shielding; obsolete zombie imagery is excluded.
- [Live Client API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api):
  event/snapshot interface. Local `editor.py` and the production catalog establish
  the exact trigger boundaries below.

The drake scenes are buff metaphors, never assertions of soul, terrain change,
current numerical stats, cast, heal or execute. Global first-blood, ace, structure
and objective events do not claim the local player caused them. Optional signals
retain unresolved paths and questions, without inventing positions, camps,
purchases, ward placements or casts. No personal enabled choice, duration, media,
volume, filter, transform, profile or path is rewritten.

## Event-by-event review

| Event | Detector evidence / boundary | Visual process |
| --- | --- | --- |
| `kill` | KillerName matches your local Riot ID or summoner alias. | A decisive sword strike sends one reward up the opposite edge; long cuts and a lower attack trail connect the frame. |
| `assist` | Your name is in Assisters, and you are neither the killer nor victim. | Two differently colored paths converge into a connected high five, and their shared path blossoms. |
| `first_blood` | Recipient identifies who earned first blood. Global event, including the other team. | A ceremonial first ribbon is cut; a wax crown and a cascade of gold mark the opening takedown. |
| `low_hp_kill` | A ChampionKill credits you while the current snapshot shows you alive at 20% health or less. Health is sampled, not measured at the exact kill instant. | A fragile lifeline holds while a wounded heart earns its cape; the health meter remains low. |
| `low_hp_multikill` | A Multikill credits you while the current snapshot shows you alive at 20% health or less. | A low-health heart balances on a thread as several incoming blades are deflected around it. |
| `ace` | AcingTeam identifies the team that scored the ace. Global event. | One wide broom sweeps five defeated helmets off the lane; a standing squad and crown complete the clear. |
| `dragon` | Fallback DragonKill for an unrecognized or missing DragonType. Killer identifies the team when resolvable. | An elemental-neutral dragon opens its wings; scale fragments flow into a neutral captured-drake emblem. |
| `baron` | Killer resolves team when possible. | A many-eyed horned Baron empowers a minion siege line; void horns and a recall spiral occupy the other margins. |
| `herald` | Killer resolves team when possible. | A captured eye cues a horned shell to charge down the lower siege lane into a tower. |
| `void_grub` | One event per individual Void Grub, not the entire group. Killer resolves team when possible. | One grub sends a burrowing tendril into masonry; a bitten brick and one captured crest finish the act. |
| `objective_steal` | Dragon, Grub, Herald, Baron or legacy Atakhan with Stolen equal to true (boolean or string). Replaces its generic objective alert. | A visible hand snatches a trophy into a fleeing sack; an empty smoky decoy remains behind. |
| `atakhan_legacy` | Legacy trigger, disabled by default. Only fires if the client actually emits it. | Thornbound eyes emerge between asymmetric briars, then blood-rose blooms open below; the trigger remains legacy. |
| `turret_destroyed` | The destroyed turret identifier is shown without guessing its lane from an outdated ID format. | A tower crumbles into a traveling rubble field; an open lane and advancing minions replace the blockade. |
| `first_turret` | The first turret of the match. Replaces a generic turret alert in the same slot. | A first-tower ribbon breaks into a gold cascade, which banks in a waiting collection basket. |
| `inhibitor_destroyed` | The inhibitor identifier comes directly from the event. | A crystal shatters and its broken lane admits an oversized armored minion and a smaller follow-up wave. |
| `inhibitor_respawning_soon` | Riot reports the warning; no estimated respawn timer is used. | Loose crystal pieces align around an incomplete blueprint; the foundation remains unfinished. |
| `inhibitor_respawned` | Riot reports the respawn directly. | Crystal pieces reunite and seal; the lane gate closes while an oversized minion silhouette retires. |
| `death` | VictimName matches you, or your local isDead changes from false to true. | A turtle rests, a bear sleeps, a folded phoenix wing and ram horn frame a floating soul in its hammock. |
| `respawn` | Your isDead changes from true to false. | Fountain rings fill, a soul returns and homeward boots launch as four personalized spirit signatures wake. |
| `low_health` | While alive, your health crosses from above 20% to 20% or lower. | An uneven pulse tightens into a thin lifeline; a concerned heart and a nearly empty side gauge hold steady. |
| `heavy_health_loss` | While alive in both samples, net health falls by more than 20% of current maximum health in one poll interval. Damage source is unknown. | An unattributed pressure wave hits the heart; fragments fall, the gauge drops and a bandage braces the damage. |
| `large_heal` | While alive in both samples, net health rises by more than 20% of current maximum health in one poll interval. Healing source is unknown. | A spring replenishes a heart; a recovery current raises flowers and fills a side gauge. |
| `resource_spent` | Your resourceValue drops by more than 30 in one poll interval. This cannot identify an ability cast. | A reservoir visibly decreases but retains resource; departing motes travel to an unresolved energy mechanism. |
| `level_up` | Your player level increases between snapshots. | Experience gems arrive along the lower edge and lift a small champion to the next stair tier. |
| `ultimate_learned` | Your R abilityLevel changes from 0 to a positive rank. This detects learning R, not casting it. | A padlock opens and a ready sigil unfolds; the newly learned ability stays available rather than firing. |
| `ability_rank_up` | Your Q/W/E/R or other supplied ability rank increases; learning R for the first time uses Ultimate Learned instead. | A gear routes power to an existing ability rack; one new gem seats in one new notch. |
| `inventory_added` | The total count for an itemID increases. Inventory slot reordering is ignored. This does not prove a purchase. | An item leaves a pack and visibly seats in an inventory slot without claiming a purchase. |
| `inventory_removed` | The total count for an itemID decreases. Could be a sale, consumption, upgrade or other inventory effect. | An item leaves an occupied slot and departs through an open contour; no sale or consumption is assumed. |
| `cs_milestone` | Your creepScore crosses a multiple of 50 (50, 100, 150…). | Minion progress becomes a gold procession, tally bundle and a collection sack; no farming field metaphor. |
| `vision_activity` | Your wardScore increases by at least 1 in one poll interval. It does not identify ward placements. | A lens scans and gains clarity; unresolved dots become observations without claiming a ward placement or enemy reveal. |
| `manpower_advantage` | Your team has at least two more living players than the enemy team, after previously having an advantage below two. | Additional standing silhouettes tip a balance, with an advancing route and a protective side crest. |
| `game_start` | Game start from the event feed. A fresh connection only displays it in the first five game seconds. | A Nexus opens three different lane routes through parting gates and waiting role emblems. |
| `minions_spawning` | The initial minion spawn event; this is not every wave. | The first wave departs: melee, caster and cannon silhouettes parade below, with flags and bootprints on the other lanes. |
| `victory` | Result is Win, relative to the local game context. | A Nexus fractures, laurels unfurl, a trophy rises and a delayed confetti celebration follows. |
| `defeat` | Result is Lose, relative to the local game context. | A Nexus falls and a pennant lowers; rain gives way to a modest new sprout. |
| `game_end` | Fallback only when Result is neither Win nor Lose. | A neutral match archive gathers observations and closes its pages without inventing a win or loss. |
| `dragon_earth` | DragonKill with DragonType Earth. Killer identifies the team when resolvable. | Unequal stone strata rise into a buttress, a pebble hits armor and layered defensive arcs hold. |
| `dragon_fire` | DragonKill with DragonType Fire. Killer identifies the team when resolvable. | Dragon breath reaches a lower-edge forge; a heated blade, flame bed and ember chimney complete the Infernal border. |
| `dragon_water` | DragonKill with DragonType Water. Killer identifies the team when resolvable. | Rain feeds an aqueduct, waterfall and returning pools; recovering roots and a floating leaf follow the flow. |
| `dragon_air` | DragonKill with DragonType Air. Killer identifies the team when resolvable. | A vortex launches speed boots along air ribbons; a windsock snaps taut and a feather takes the high road. |
| `dragon_hextech` | DragonKill with DragonType Hextech. Killer identifies the team when resolvable. | An open circuit closes before paired crystals power haste gears and attack blades. |
| `dragon_chemtech` | DragonKill with DragonType Chemtech. Killer identifies the team when resolvable. | An alchemical pressure vessel feeds a tempering bath; bubbles travel into a shield whose fracture closes. |
| `dragon_elder` | DragonKill with DragonType Elder. Killer identifies the team when resolvable. | An ancient dragon opens pale wings and an eclipse; silver breath reaches a threshold seal in one decisive pass. |
| `double_kill` | Multikill credits your local player and KillStreak equals 2. Upgrades the local kill alert in its reusable slot. | Two opposed blades feed a paired helmet crest; the second contact completes two joined gems. |
| `triple_kill` | Multikill credits your local player and KillStreak equals 3. Upgrades the local kill alert in its reusable slot. | Three hits travel through a bottom mirror, a side shield and an upper medal, changing color at each contact. |
| `quadra_kill` | Multikill credits your local player and KillStreak equals 4. Upgrades the local kill alert in its reusable slot. | Four locks turn around the perimeter; a fifth unclaimed plinth waits at the end of the chase. |
| `pentakill` | Multikill credits your local player and KillStreak equals 5. Upgrades the local kill alert in its reusable slot. | Five takedown marks lead into a concert downbeat: drums, guitars, keyboard, light rig and a sustained amplifier chord. |
| `possible_purchase` | Inventory gains an item and your currentGold falls by more than 50 in the same interval. Other inventory/gold effects can resemble shopping. | Coins approach a tentative bag while an item remains on the opposite side; the exchange stays unresolved. |
| `possible_item_upgrade` | At least one item count increases and another decreases in the same interval. Recipes are not checked, so completion is not confirmed. | Two components approach a question while a larger item outline stays incomplete. |
| `possible_consumable_use` | A consumable item count decreases, nothing is added, and gold rises by no more than 5. Consumption is not confirmed. | A bottle tilts slightly, bubbles trace the border and a heart remains only a possible association. |
| `possible_base_visit` | Inventory gains an item, gold drops by more than 50, and health increases by more than 15% of max health while alive. This does not confirm a recall or fountain location. | A dotted route leads toward a proposed home, with inventory and recovery symbols kept tentative. |
| `possible_combat` | While alive, net health falls by more than 5% of max health in one poll interval. Could be minions, monsters, towers or other health costs. | A blade and shield approach along separate routes that stop around an unresolved question. |
| `possible_low_hp_escape` | You were at 20% health or less, then remained alive for eight seconds after the last low-health sample, with no health loss greater than 5% of max HP during the last eight seconds. No position or combat-end signal is available. | A wounded heart and boot trail lead toward an incomplete safe arch. |
| `possible_teamfight` | At least three champion deaths occur within 20 game seconds, with the newest no more than two seconds old. Separate fights may be grouped because positions are unavailable. | Three death observations are grouped by time brackets; their locations remain unspecified. |
| `possible_objective_fight` | A champion death and an objective event are within 12 seconds of one another; both remain in the 20-second window. Their physical locations are unknown. | An objective and a death observation approach the same unresolved temporal bracket. |
| `possible_power_spike` | Your level increases in the same interval that inventory both adds and removes items. No champion-specific power model is used. | An item gear and rising energy indicator suggest potential power without confirming a champion-specific spike. |
| `possible_roam` | A champion kill involves killer/assisters with three or more different assigned roles. Roles do not reveal where the fight happened. | Different role symbols converge around a compass and dotted route, without claiming actual positions. |
| `possible_jungle_activity` | Your assigned role is JUNGLE and CS rises by at least four in one interval. No specific camp can be identified. | Tentative jungle growth, fireflies and an observation lens frame progress without identifying a camp. |
