import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import library, cleanup
from instant_replay.main import _parse_command
from hub_ui.replay_media import serve_file


class ReplayLibrary(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patch = patch.object(library, "STATE_FILE", self.root / "library.json")
        self.patch.start(); self.addCleanup(self.patch.stop)
        self.a = self.root / "Replay 2026-09-07 01-02-03_ir_trimmed.mkv"
        self.b = self.root / "b.mp4"
        self.a.write_bytes(b"clip-a"); self.b.write_bytes(b"clip-b")

    def group(self, name="Stream intro", paths=None, **kwargs):
        return library.mutate(dict(action="group", revision=library.read()["revision"],
                                   name=name, paths=paths or [str(self.a), str(self.b)], **kwargs), self.root)

    def test_multiple_groups_order_and_reload(self):
        first = self.group()["groups"][0]
        self.group("Wins", [str(self.b)])
        self.group(paths=[str(self.b), str(self.a), str(self.b)], id=first["id"])
        self.assertEqual(len(library.read()["groups"]), 2)
        self.assertEqual(library.group_paths("STREAM INTRO", self.root, by_name=True),
                         [str(self.b), str(self.a), str(self.b)])

    def test_stale_editor_cannot_overwrite_newer_change(self):
        self.group()
        with self.assertRaises(library.Conflict):
            library.mutate(dict(action="delete_group", revision=0), self.root)
        self.assertEqual(len(library.read()["groups"]), 1)

    def test_cleanup_keeps_curated_clip_and_does_not_remerge(self):
        self.group()
        self.assertFalse(cleanup._safe_unlink(self.a))
        self.assertTrue(self.a.exists())
        with patch.object(cleanup, "REPLAY_DIR", str(self.root)):
            self.assertEqual(cleanup._find_trimmed(), [])
        raw = self.root / "raw.mkv"; raw.write_bytes(b"raw")
        self.assertTrue(cleanup._safe_unlink(raw))

    def test_delete_group_preserves_recordings_and_labels(self):
        library.mutate(dict(action="clip", revision=0, path=str(self.a), title="Great escape", notes="final fight", favorite=True), self.root)
        group = self.group()["groups"][0]
        library.mutate(dict(action="delete_group", revision=2, id=group["id"]), self.root)
        self.assertTrue(self.a.exists())
        self.assertEqual(library.read()["clips"][library.clip_id(self.a)]["title"], "Great escape")

    def test_invalid_paths_and_empty_files_rejected(self):
        for path in [self.root.parent / "outside.mp4", self.root / "library.json", self.root / "missing.mp4"]:
            with self.assertRaises(ValueError): library.resolve(path, self.root)
        self.b.write_bytes(b"")
        with self.assertRaises(ValueError): library.resolve(self.b, self.root)

    def test_missing_group_clip_blocks_whole_sequence_but_can_be_removed(self):
        group = self.group()["groups"][0]
        self.b.unlink()
        with self.assertRaises(ValueError): library.group_paths(group["id"], self.root)
        self.group(paths=[str(self.a)], id=group["id"])
        self.assertEqual(library.group_paths(group["id"], self.root), [str(self.a)])

    def test_invalid_json_is_not_replaced_with_defaults(self):
        library.STATE_FILE.write_text("{")
        with self.assertRaises(ValueError): self.group()
        self.assertEqual(library.STATE_FILE.read_text(), "{")

    def test_archived_capture_keeps_tag_and_game_association(self):
        library.remember_capture(self.a, tag="win", saved_at=10)
        archived = self.root / "clips" / "Game 7 2026-09-13" / self.a.name
        archived.parent.mkdir(parents=True)
        self.a.rename(archived)
        library.archive_capture(self.a, archived, game="Game 7 2026-09-13")
        self.assertEqual(library.tagged_paths("win", self.root), [str(archived)])
        self.assertEqual(library.game_paths(7, self.root), [str(archived)])

    def test_voice_group_name_can_contain_other_command_words(self):
        self.assertEqual(_parse_command("Play intro save the day."), ("play", "intro save the day", 0, False))
        self.assertEqual(_parse_command("Play group highlights"), ("play", "group highlights", 0, False))

    def test_preview_byte_ranges_allow_seeking(self):
        class Handler:
            def __init__(self, value): self.headers = {"Range": value}; self.wfile = io.BytesIO(); self.sent = {}
            def send_response(self, code): self.code = code
            def send_header(self, key, value): self.sent[key] = value
            def end_headers(self): pass
        for value, expected in [("bytes=1-3", b"lip"), ("bytes=-2", b"-b"), ("bytes=4-", b"-b")]:
            handler = Handler(value); serve_file(handler, self.b)
            self.assertEqual(handler.code, 206)
            self.assertEqual(handler.wfile.getvalue(), expected)
        handler = Handler("bytes=99-"); serve_file(handler, self.b)
        self.assertEqual(handler.code, 416)


if __name__ == "__main__": unittest.main()
