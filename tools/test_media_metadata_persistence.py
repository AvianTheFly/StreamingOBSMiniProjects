"""Cross-start reuse, stale file rejection and nonblocking bounded persistence."""
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from lib import media_metadata as metadata
from lib.media_metadata_store import MetadataStore, MAX_BYTES

VALUE = metadata.MediaMetadata('h264',640,360,30)


class PersistentMetadataTests(unittest.TestCase):
    def setUp(self):
        metadata.configure_metadata_cache(None)
        metadata.clear_metadata_cache()
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.addCleanup(metadata.configure_metadata_cache, None)
        self.file = Path(self.folder.name)/'original.mp4'
        self.file.write_bytes(b'original media')
        self.cache = Path(self.folder.name)/'cache.json'
        metadata.configure_metadata_cache(self.cache)

    def restart(self):
        metadata.configure_metadata_cache(None)
        metadata.clear_metadata_cache()
        metadata.configure_metadata_cache(self.cache)

    def test_unchanged_media_survives_restart_without_another_probe(self):
        with patch.object(metadata,'_read_metadata',return_value=VALUE) as probe:
            self.assertEqual(metadata.probe_media(self.file), VALUE)
            metadata.flush_metadata_cache(force=True)
            self.restart()
            self.assertEqual(metadata.probe_media(self.file), VALUE)
            probe.assert_called_once()
        self.assertEqual(self.file.read_bytes(), b'original media')

    def test_file_change_and_explicit_clear_force_fresh_probes(self):
        with patch.object(metadata,'_read_metadata',return_value=VALUE) as probe:
            metadata.probe_media(self.file)
            self.restart()
            self.file.write_bytes(b'edited original media')
            metadata.probe_media(self.file)
            self.assertEqual(probe.call_count,2)
            metadata.clear_metadata_cache()
            self.restart()
            metadata.probe_media(self.file)
            self.assertEqual(probe.call_count,3)

    def test_invalid_or_oversized_cache_falls_back_without_resetting_media(self):
        for content in ('broken json', '{"version":2,"entries":[]}', ' '* (MAX_BYTES+1),
                        json.dumps({'version':1,'entries':[{'path':str(self.file),'mtime_ns':0,'size':13,'metadata':None}]})):
            self.cache.write_text(content)
            self.restart()
            with patch.object(metadata,'_read_metadata',return_value=VALUE) as probe:
                self.assertEqual(metadata.probe_media(self.file),VALUE)
                probe.assert_called_once()

    def test_cache_hits_and_idle_flushes_do_not_write_unchanged_snapshots(self):
        with patch.object(metadata,'_read_metadata',return_value=VALUE), \
             patch('lib.media_metadata_store.write_json', wraps=__import__('lib.json_store',fromlist=['write_json']).write_json) as write:
            metadata.probe_media(self.file)
            for _ in range(5):
                metadata.probe_media(self.file)
                metadata.flush_metadata_cache(force=True)
            write.assert_called_once()

    def test_read_only_cache_directory_cannot_break_playback(self):
        with patch.object(metadata,'_read_metadata',return_value=VALUE), \
             patch('lib.media_metadata_store.write_json',side_effect=PermissionError):
            self.assertEqual(metadata.probe_media(self.file),VALUE)
            self.assertEqual(metadata.probe_media(self.file),VALUE)

    def test_cached_reads_do_not_wait_for_slow_disk_publication(self):
        entered,release,read = threading.Event(),threading.Event(),threading.Event()
        def save(*args,**kwargs):
            entered.set()
            if not release.wait(3): raise TimeoutError('fixture missing release')
        with patch.object(metadata,'_read_metadata',return_value=VALUE), \
             patch('lib.media_metadata_store.write_json',side_effect=save):
            writer=threading.Thread(target=metadata.probe_media,args=(self.file,))
            reader=threading.Thread(target=lambda:(metadata.probe_media(self.file),read.set()))
            writer.start()
            try:
                self.assertTrue(entered.wait(1))
                reader.start()
                self.assertTrue(read.wait(1))
            finally:
                release.set();writer.join(2)
                if reader.ident:reader.join(2)

    def test_saved_inventory_is_bounded(self):
        with patch.object(metadata,'_CACHE_LIMIT',2),patch.object(metadata,'_read_metadata',return_value=VALUE):
            for index in range(5):
                file=Path(self.folder.name)/f'{index}.mp4';file.touch();metadata.probe_media(file)
            metadata.flush_metadata_cache(force=True)
        self.assertEqual(len(MetadataStore(self.cache).load()),2)


if __name__=='__main__':
    unittest.main()
