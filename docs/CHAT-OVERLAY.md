# Custom desktop chat

Open **Hub → Chat Overlay** or <http://127.0.0.1:7420/chat/>. The supported
`Run Hub.bat` / `hub.py` serves this chat; keep the Hub running.

**Launch desktop chat when the Hub starts** is enabled for your setup. Next time
you open `Run Hub.bat`, the Hub waits for its own chat page to be ready, then opens
your saved desktop overlay automatically. An existing host is reused without a
duplicate launch. The finite startup worker stops waiting on Hub shutdown; it
leaves the separately owned desktop host open. Disable the checkbox in Chat
Studio and save to return to manual launch. A different active host configuration
is preserved and the Hub logs that automatic launch was skipped.

The local renderer runs in your already-installed Transparent Twitch Chat.
**Use on my desktop** selects its custom-URL mode and launches one host in
click-through mode. If the host is running with another chat page, close it
first so its latest preferences are saved. Original host settings and window
geometry are copied before changes to
`%LOCALAPPDATA%/StreamingHub/desktop-chat-backups/<timestamp>/`.
To restore the original host setup, close the host and copy both JSON files
from the first backup into `%APPDATA%/TransparentTwitchChatWPF/`.

Your saved shortcuts are **Ctrl+Alt+F9** (borders), **Ctrl+Alt+F7**
(interaction), and **Ctrl+Alt+F8** (bring to top). Use the border to move
the overlay and its resize grip to change the window dimensions. New host
shortcuts set in its settings take precedence over these documented values.
Windowed/borderless games support desktop overlays; exclusive fullscreen
can cover them. Empty chat is transparent; live messages fade after 60 seconds.

Chat Studio provides Glass, Minimal and Neon styles, font/size, emote size, message/line spacing,
card opacity, message limit, fading, accent, motion, badge visibility, header,
hidden accounts and word/phrase-to-image replacement rules. Changes are previewed
locally and saved explicitly; the desktop renderer updates within 3 seconds.
`chat_overlay_settings.json` is independent of media settings and is included
in the existing settings history. Settings never change replay paths, audio
volumes, module profiles, filters or transforms.

Native Twitch emotes use message-tag offsets and the CDN's animated/default
format. Native Twitch GIF tags are also rendered. Channel/global 7TV, BTTV
and FFZ catalogs refresh every five minutes; provider outages don't interrupt
text chat. 7TV zero-width layering is supported. Twitch badges use existing
authorization if available, with role symbols as fallback. Read-only chat
requires no new Twitch authorization. Custom rules accept HTTPS images,
including animated GIF/WebP, or existing `/viewer_assets/` images. Channel
7TV aliases load automatically. Extension-only effects and 7TV cosmetics are
separate features and aren't replicated.

Your gameplay preset shows six messages, 17px semibold text, 28px emotes and 22% card
opacity inside a 420 × 467 host window, fading after 35 seconds. Message spacing
is 4px and line spacing 130%; both have sliders in Chat Studio. Resting text is
78% opaque, and older messages retain at least 85% of that strength for scanning.
Cards fit their message width, older messages dim, and the newest has a small
accent marker. Animation is limited to a 3px arrival; there is no continuous
background animation. Real chat contains no
sample messages. The Studio preview contains local sample messages.

## Sticker rules

The installed gaming pack has 184 aliases across 38 verified channel stickers,
including “gg wp,” “clutch,” “let him cook,” “skill issue,” “copium,” “bonk,”
“big brain,” “bot diff,” and “o7.” It uses existing channel assets and preserves
personal replacements; it does not add emotes or change your Twitch account.

The Studio's **Sticker library · Rave & Chaos** groups codes and phrases by image,
supports search and style filters, and previews a test message locally without
posting to Twitch. Natural
matching accepts casing and edge punctuation, chooses the longest matching
phrase, and leaves links, mentions, commands and substrings intact. Native tagged
Twitch emotes take precedence over replacements. A configurable limit defaults
to six custom stickers per message; excess aliases remain text. Turn natural
matching off to keep exact case-sensitive replacements. Existing personal aliases
win when installing the authored gaming pack from the channel's emote catalog.
Unsaved preview settings stay in place until you save or reload the Studio.

## Pointer readability

In gameplay, text, badges and emotes rest at 78% opacity and rise to 94%
under the pointer. Card opacity, borders, dimensions and animations do not
change on hover. Pointer detection reads Windows cursor coordinates; it does
not install a mouse hook or disable click-through behavior. Only the card under
the pointer brightens. Outside gameplay, content reaches 100% opacity while
cards stay translucent.

**Readability mode** can force gameplay or desktop behavior. Automatic mode
recognizes common game executables and desktop apps; unknown apps covering
most of the screen are conservatively treated as games. It uses the foreground
app, so alt-tabbing to a recognized desktop app makes chat clearer. Browser
games require **Always gameplay translucency**. Preview hover uses ordinary
pointer events; the live desktop host uses the Hub's local pointer endpoint.

If viewers should see chat too, add
`http://127.0.0.1:7420/chat/overlay.html` as an OBS browser source.
Game capture normally doesn't include desktop overlays.

## JCyan fallback

Generated through [JCyan's setup page](https://chat.johnnycyan.com/) for your
channel, with medium Segoe UI text, medium shadow, animation, bots hidden
and a 60-second fade:

<https://chat.johnnycyan.com/v2/?channel=udyrisabotlaner&size=2&emoteScale=1&font=1&height=3&voice=Brian&shadow=2&animate=true&fade=60&readable=true>

Paste this into the host's **Custom URL** setting to use JCyan instead of
the local renderer. Its appearance is controlled by JCyan's generator;
the Hub's Chat Studio controls the local renderer.

Design references: [DougDoug's chat-focused stream layout](https://www.twitch.tv/dougdoug/clip/CreativePluckySquidFailFish-ACfhcLVr9giK3TDO),
[Ironmouse's themed floating chat](https://www.twitch.tv/ironmouse/clip/EncouragingFuriousDeerKlappa-AwYuaDxyuQM7RPXM),
and the host's [custom widget documentation](https://github.com/baffler/Transparent-Twitch-Chat-Overlay/wiki).

Validation: `py -3.11 -X utf8 tools/run_offline_tests.py tools.test_chat_overlay`; browser tests:
`node tools/test_chat_overlay.cjs` with Playwright available in `NODE_PATH`.

## Rave & Chaos library

The installed pack contains **1,017 unique animated 7TV stickers**, exposed through
1,092 codes, plus 63 natural energy phrases. It includes 555 animated stickers
from [KeshaEuw's current 7TV set](https://7tv.app/emote-sets/01GK750W3800038S12A0X2H74E)
and 462 additional rave, dance, jam, EDM, party, spin, headbang, hyper, wiggle and
disco discoveries. All 75 requested examples are included, using their actual
animated assets: RaveTime, ADHD, HYPERCATJAM, catRAVE, chunguswaga, SALAMIhand,
BabyRave, PartyKirby, zyzzRave, borpaSpin and the rest.

Type the exact code in chat or use phrases such as “rave time,” “drop the bass,”
“zoomies,” “hardstyle,” “headbanging,” “crab rave” and “dance party.” Numbered
variants (for example RAVE_02) expose different animations with the same original
7TV name. Search and hover the library to find them. Every requested sticker also
has a Kesha_ spelling, such as Kesha_haha, to bypass a personal word replacement
with the same name. Your 184 existing replacements take precedence and are kept.

Visible library thumbnails animate automatically; scrolling them out of view,
closing the panel or hiding the page pauses them. Hover or keyboard focus shows
a larger local preview. The library renders 60 rows at a time, with Show 60 more.
Only the visible few animate, not the entire collection. The live overlay retains
its four-message, 30px-emote footprint and text-only hover clarity.

The pack is local overlay data in `chat_sticker_pack.json`, included in settings
history. It survives provider catalog outages and loads automatically with the Hub
on future stream sessions. It doesn't modify your Twitch or 7TV account; emotes
shown directly in viewers' Twitch chat still depend on your channel's 7TV set.

Finite reinstall from public metadata:
`py -3.11 -X utf8 tools/build_chat_chaos_pack.py --kesha tmp_obs_debug/kesha-7tv-source.json --discovery tmp_obs_debug/chaos-search-sources.json`.
Personal entries and unknown metadata are preserved on reinstall. Real-CDN
animation and live-library verification: `node tools/verify_chat_chaos.cjs`.
