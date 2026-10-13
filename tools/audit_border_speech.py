"""Read selected original speech cues using one cached model; no downloads or runtime."""
import json
from pathlib import Path
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output/border-lineup-audit'

def main():
    rows = json.loads((ROOT/'output/thematic-borders/media-context.json').read_text())
    wanted = {'anime-wow-sound-effect','hooray','hub-intro-sound','rizz-sound-effect','leave me alone','oh no','JOHN CENA'}
    model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)
    results = []
    for row in rows:
        if row['name'] not in wanted:
            continue
        segments, info = model.transcribe(row['path'], beam_size=3, word_timestamps=True, condition_on_previous_text=False)
        result = {'name':row['name'], 'sha256':row['sha256'], 'segments':[{
            'start':s.start,'end':s.end,'text':s.text,'no_speech_prob':s.no_speech_prob,'avg_logprob':s.avg_logprob,
            'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for w in (s.words or [])]
        } for s in segments]}
        results.append(result)
        print(json.dumps(result), flush=True)
    assert {r['name'] for r in results} == wanted
    (OUT/'speech-witnesses.json').write_text(json.dumps(results, indent=2),encoding='utf-8')

if __name__ == '__main__':
    main()
