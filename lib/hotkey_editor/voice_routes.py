"""Editor voice endpoints; transport owns request parsing."""
from __future__ import annotations

from .settings import _phrases_file
from .matching import _score_phrase, _transcribe_audio


class _VoiceRoutes:

    def _handle_voice_transcribe(self, body: bytes):
        if not body:
            return self._json_err('No audio data received')
        content_type = self.headers.get('Content-Type', 'audio/webm')
        try:
            if self.headers.get('X-Transcript-Mode') == 'words':
                result = _transcribe_audio(body, content_type, word_timestamps=True)
                self._json_ok({'ok': True, **result})
            else:
                text = _transcribe_audio(body, content_type)
                self._json_ok({'ok': True, 'text': text})
        except Exception as exc:
            self._json_err(str(exc))

    def _handle_voice_score(self, data):
        phrase = str(data.get('phrase', '')).strip()
        stems = data.get('stems', [])
        if not isinstance(stems, list):
            stems = []
        proj = self.context.current['proj']
        phrases_file = _phrases_file(proj)
        strategy = (proj.get('config_defaults') or {}).get('phrase_scorer')
        try:
            results = _score_phrase(phrase, stems, phrases_file, strategy=strategy)
            self._json_ok({'ok': True, 'results': results})
        except Exception as exc:
            self._json_err(str(exc))
