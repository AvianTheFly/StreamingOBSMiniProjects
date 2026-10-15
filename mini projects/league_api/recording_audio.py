"""Read-only preflight for the configured clean/mixed game recording tracks."""


def verify_audio(client, excluded_sources):
    def parameter(category, name):
        return client.send('GetProfileParameter', {'parameterCategory': category,
                           'parameterName': name}, raw=True)['parameterValue']
    mode = parameter('Output', 'Mode')
    category = 'SimpleOutput' if mode == 'Simple' else 'AdvOut'
    tracks = int(parameter(category, 'RecTracks'))
    if tracks != 6:
        raise ValueError('Game recordings need OBS tracks 2 (clean) and 3 (with music); audio settings changed')
    if mode == 'Simple' and parameter(category, 'RecQuality') == 'Stream':
        raise ValueError('Recording quality must use separate recording tracks, not Same as stream')
    for item in client.get_input_list().inputs:
        name, kind = item['inputName'], item['inputKind']
        excluded = name in excluded_sources or kind == 'wasapi_output_capture'
        if kind == 'wasapi_process_output_capture':
            settings = client.get_input_settings(name).input_settings
            executable = str(settings.get('window', '')).rsplit(':', 1)[-1].lower()
            excluded = excluded or executable in {'chrome.exe', 'spotify.exe'}
        if excluded:
            routing = client.send('GetInputAudioTracks', {'inputName': name}, raw=True)['inputAudioTracks']
            if routing.get('2'):
                raise ValueError(f'Clean recording blocked: {name} is routed to OBS track 2')
    return [{'stream': 0, 'obs_track': 2, 'label': 'Clean game + microphone'},
            {'stream': 1, 'obs_track': 3, 'label': 'Full mix with music'}]
