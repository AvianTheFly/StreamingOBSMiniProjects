"""Voice/lifecycle scene policy; visibility is prepared by the shared director."""
from lib.coordination.lobbies import prepare_lobby
from lib.coordination.scenes import scene_director
from .config import GAME_SCENE, LOBBIES_SCENE
from .layouts import legacy_exclusions
from .settings import rotation

EXCLUDED_PRESENTATIONS = ('LOL champ select',)


def show_lobby(lobbies, *, selected=None, automatic=False, expected_revision=None,
               expected_manual_revision=None, screen_visible=None):
    prepared = []
    def prepare(client):
        candidates = tuple(lobbies) if selected is not None else tuple(rotation(lobbies))
        exclusions = (*EXCLUDED_PRESENTATIONS, *legacy_exclusions(lobbies),
                      *(name for name in lobbies if name not in candidates))
        prepared.append(prepare_lobby(client, LOBBIES_SCENE, candidates,
                                     selected=selected, exclusions=exclusions,
                                     hide_screen=automatic))
        if screen_visible is not None:
            from lib.display_capture import set_visible
            set_visible(screen_visible,client=client)
    applied = scene_director.request(LOBBIES_SCENE, owner='scene_voice_switcher',
        reason='Game ended' if automatic else 'Lobby command', automatic=automatic,
        expected_revision=expected_revision, expected_manual_revision=expected_manual_revision,
        prepare=prepare, defer=automatic)
    return applied, prepared[-1] if prepared else None


def show_game(*, automatic=False, expected_revision=None, expected_manual_revision=None):
    return scene_director.request(GAME_SCENE, owner='scene_voice_switcher',
        reason='Game started' if automatic else 'Game command', automatic=automatic,
        expected_revision=expected_revision, expected_manual_revision=expected_manual_revision,
        defer=automatic)
