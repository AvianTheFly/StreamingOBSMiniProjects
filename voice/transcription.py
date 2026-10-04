"""Consume word timing from an already-owned model; no model or resource lifetime."""


def timed_words(model, audio, language):
    # Singing uploads need vocal boundaries kept; speech VAD can discard music.
    segments, _ = model.transcribe(audio, language=language, beam_size=5,
                                  vad_filter=False, word_timestamps=True,
                                  condition_on_previous_text=False)
    phrases, words = [], []
    for segment in segments:
        phrases.append(dict(start=float(segment.start), end=float(segment.end),
                            text=segment.text.strip()))
        for word in segment.words or []:
            words.append(dict(start=float(word.start), end=float(word.end),
                              text=word.word.strip(), probability=float(word.probability)))
    return dict(text=' '.join(row['text'] for row in phrases).strip(),
                segments=phrases, words=words)
