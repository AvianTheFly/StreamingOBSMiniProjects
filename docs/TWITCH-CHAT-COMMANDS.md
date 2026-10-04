# Personal Twitch commands

Installed and live-verified October 3, 2026: 52 enabled groups, 149 command
names including aliases, and 20 disabled groups awaiting personal details.
The connected sender replies as `@udyrisabotlaner`; a real `!discord` message
received the supplied Discord link. The Hub must keep running for replies.

Open **Library & tools → Chat commands** in this checkout's Hub. The feature
owns `mini projects/twitch_commands/commands.json`; it includes your researched
League/community pack, aliases, cooldowns and disabled entries awaiting details.
The settings-history service backs it up outside the repository.

The bot replies as the connected broadcaster using the existing Hub chat
reader, shared bounded Helix sender, and Twitch Celebrations authorization.
Use **Connect Twitch** to open Celebrations, then its Connect button if the chat
status asks you to reconnect. Authorize `user:write:chat` on Twitch. No separate
bot account is required and no credentials are copied into command settings.

Choose a command to edit its reply, aliases, cooldown (5–3600 seconds), permission
and enabled switch. Aliases use the same reply and global cooldown, with an
additional 60-second per-viewer cooldown. A conflicting edit from another editor
is rejected until you reload. Unknown saved fields survive edits. Malformed
personal JSON is preserved and reported; it is never reset to examples.

The global switch stops new replies and revokes queued replies. Editing any
command also revokes queued work from the previous catalog generation. Incoming
message IDs are deduplicated in a bounded cache and stale/other-channel messages
are ignored. The shared sender checks the current channel, authorization,
lifetime, queue limit and message expiry before posting; uncertain writes are
not retried. Private preview uses the same matcher/renderer and never posts.

`!commands` / `!help` generates eight commands per page; use `!commands 2`.
`!time` / `!clock` reports current Eastern time. `!8ball` / `!askspirits` generates
an original four-spirit answer. The rest are your editable plain text replies.
`!rank`, `!lp` and `!winrate` link to your OP.GG profile rather than announcing
stale numbers. The guide links remain your existing published guide, which may
describe an older patch. `!clips` opens your clip library. `!court` is conversation
copy; it does not start a poll or manipulate OBS.

League Stats owns `!stats`, `!count`, `!cannon` and the other manual stat helpers.
The command editor reserves those names, and this feature does not import or
change Stats' private state. It does not control playback, scenes or microphone
resources. Chat does not expose add/edit/delete administration commands: changes
are made through the local Hub editor.

Keep Nightbot and StreamElements responses for these same names disabled if you
later enable an external bot, to avoid duplicate replies. Unknown schedule,
hardware, queue/coaching policy and donation destinations remain disabled until
you supply their correct responses.

The original research and portable installation files remain in
`output/twitch-command-pack/`; they are reference exports, not live bot settings.
Research used [Sneaky's historical command usage](https://stats.streamelements.com/c/sneakylol)
and [Elite500's public command list](https://streamelements.com/elite500/commands).
Responses were authored for this channel; other streamers' personal details were
not copied. The custom sender follows
[Twitch's Send Chat Message API](https://dev.twitch.tv/docs/api/reference/#send-chat-message).

Validation: architecture check has zero violations; 27 focused Python tests,
the disposable command-editor browser fixture, and its read-only `--live`
full-Hub check pass. The full offline run completed 813 tests with one unrelated
failure in `league_api.test_border_catalog` (duration 2 versus expected 0.8).
That border failure reproduced independently; its behavior was not changed.
