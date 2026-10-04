"""Native Lua timing/shuffle contracts plus read-only Hub asset routing."""
import ctypes
import http.client
import http.server
import json
from pathlib import Path
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SpiritTests(unittest.TestCase):
    def test_ram_three_landings_and_final_smash_have_bounded_audio(self):
        import tempfile
        import wave
        import numpy as np
        from lib.scene_transitions.ram_sound import synthesize, LANDINGS, IMPACT
        with tempfile.TemporaryDirectory(prefix='ram-sound-') as directory:
            for variant in (0, 1):
                file = Path(directory)/f'ram-{variant}.wav'
                synthesize(file, variant=variant)
                with wave.open(str(file)) as wav:
                    self.assertEqual((wav.getnchannels(),wav.getframerate(),wav.getnframes()),(2,48000,316800))
                    samples = np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').reshape(-1,2)/32768
                self.assertTrue(np.isfinite(samples).all())
                self.assertLessEqual(float(np.abs(samples).max()),.30)
                for at in (*LANDINGS, IMPACT):
                    attack = samples[round((at+.01)*48000):round((at+.09)*48000)]
                    self.assertGreater(float(np.sqrt(np.mean(attack*attack))),.015)

    def test_turtle_three_impacts_have_audible_bounded_audio(self):
        import tempfile
        import wave
        import numpy as np
        from lib.scene_transitions.turtle_sound import synthesize, HITS, FOOTFALLS
        with tempfile.TemporaryDirectory(prefix='turtle-sound-') as directory:
            file = Path(directory)/'turtle.wav'
            synthesize(file)
            with wave.open(str(file)) as wav:
                self.assertEqual((wav.getnchannels(),wav.getframerate(),wav.getnframes()),(2,48000,316800))
                samples = np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').reshape(-1,2)/32768
            self.assertLessEqual(float(np.abs(samples).max()),.30)
            self.assertTrue(np.isfinite(samples).all())
            for at in HITS:
                attack = samples[round((at+.01)*48000):round((at+.09)*48000)]
                self.assertGreater(float(np.sqrt(np.mean(attack*attack))),.025)
            for at in FOOTFALLS:
                step = samples[round((at+.01)*48000):round((at+.09)*48000)]
                self.assertGreater(float(np.sqrt(np.mean(step*step))),.003)

    def test_install_waits_for_queued_obs_selector_and_bounds_failure(self):
        from unittest.mock import Mock, patch
        from tools.install_spirit_transitions import wait_for_transition
        client = Mock()
        client.send.side_effect = [{'transitionName': 'Move'},
                                   {'transitionName': 'Hub Spirit Transitions', 'transitionKind': 'hub_spirit_transition'}]
        with patch('tools.install_spirit_transitions.time.sleep') as sleep:
            result = wait_for_transition(client, 'Hub Spirit Transitions')
        self.assertEqual(result['transitionKind'], 'hub_spirit_transition')
        sleep.assert_called_once_with(.05)
        client.send.side_effect = None
        client.send.return_value = {'transitionName': 'Move'}
        with self.assertRaisesRegex(RuntimeError, 'did not confirm'):
            wait_for_transition(client, 'Hub Spirit Transitions', timeout=0)

    def test_active_collection_filename_disambiguates_personal_copies(self):
        from lib.scene_transitions.installation import select_collection_file
        files={'active.json':'Personal', 'copy.json':'Personal', 'other.json':'Other'}
        self.assertEqual(select_collection_file(files,'Personal','active.json'),'active.json')
        self.assertEqual(select_collection_file(files,'Personal','active'),'active.json')
        self.assertEqual(select_collection_file(files,'Other'),'other.json')
        for configured in (None,'other.json','missing.json','../active.json'):
            with self.subTest(configured=configured), self.assertRaises(ValueError):
                select_collection_file(files,'Personal',configured)
        self.assertEqual(len(files),3)

    def test_collection_patch_preserves_personal_data_and_safe_cuts(self):
        from lib.scene_transitions.installation import NAME, CLIPS, patch_collection
        timing=json.loads((ROOT/'lib/scene_transitions/web/timing.json').read_text())
        manifest={**timing,'cut_ms':4000,'spirits':list(timing['animations']),'clips':sorted(CLIPS)}
        current={'name':'Personal','current_scene':'Test','current_transition':'Cut','unknown':{'future':[1,2]},
                 'sources':[{'volume':.31,'filters':[{'private':'data'}],'transforms':{'x':143}}],
                 'transitions':[{'name':NAME,'id':'hub_spirit_transition','volume':.27,'private_settings':{'keep':True},
                                 'settings':{'bear_cut_ms':4190,'turtle_cut_ms':2000,'future_setting':'keep'}},
                                {'name':'Cut','id':'cut_transition','settings':{'preserve':1}}],
                 'modules':{'future-module':{'a':1},'scripts-tool':[{'path':'other.lua','settings':{'enabled':True}}]}}
        unchanged=json.loads(json.dumps(current))
        result=patch_collection(current,Path('C:/media'),manifest,Path('C:/random.lua'),select=False,require_existing=True)
        self.assertEqual(current,unchanged)
        for key in ('name','current_scene','current_transition','unknown','sources'):
            self.assertEqual(result[key],current[key])
        self.assertEqual(result['transitions'][1],current['transitions'][1])
        self.assertEqual(result['transitions'][0]['volume'],.27)
        self.assertEqual(result['transitions'][0]['private_settings'],{'keep':True})
        settings=result['transitions'][0]['settings']
        self.assertEqual(settings['bear_cut_ms'],4190)
        self.assertEqual(settings['turtle_cut_ms'],3900)
        self.assertEqual(settings['future_setting'],'keep')
        self.assertEqual(result['modules']['scripts-tool'][0],current['modules']['scripts-tool'][0])
        self.assertEqual(result['modules']['future-module'],current['modules']['future-module'])
        bad={**manifest,'clips':['bear']}
        with self.assertRaises(ValueError):patch_collection(current,Path('C:/media'),bad,Path('C:/random.lua'))
        self.assertEqual(current,unchanged)

    def test_preview_route_and_path_containment(self):
        from hub_ui.server import _Handler
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), _Handler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                for path, status, media in [('/transitions',302,None),
                    ('/transitions/',200,'text/html'),
                    ('/transitions/renderer.js',200,'javascript'),
                    ('/transitions/assets/bear.png',200,'image/png'),
                    ('/transitions/assets/turtle-intact-v14.png',200,'image/png'),
                    ('/transitions/assets/turtle-material-v14.png',200,'image/png'),
                    ('/transitions/audio/turtle.wav',200,'audio/wav'),
                    ('/transitions/../../.env',404,None),
                    ('/transitions/%2e%2e/%2e%2e/.env',404,None),
                    ('/transitions/missing.js',404,None)]:
                    with self.subTest(path=path):
                        connection = http.client.HTTPConnection('127.0.0.1',server.server_port)
                        connection.request('GET',path)
                        response=connection.getresponse()
                        self.assertEqual(response.status,status)
                        if media:self.assertIn(media,response.getheader('Content-Type'))
                        response.read();connection.close()
            finally:
                server.shutdown();worker.join(2)

    def test_native_lua_rotation_and_video_tail_guard(self):
        dll=Path('C:/Program Files/obs-studio/bin/64bit/lua51.dll')
        if not dll.is_file():self.skipTest('OBS LuaJIT runtime unavailable')
        lua=ctypes.CDLL(str(dll))
        lua.luaL_newstate.restype=ctypes.c_void_p
        lua.luaL_openlibs.argtypes=[ctypes.c_void_p]
        lua.luaL_loadstring.argtypes=[ctypes.c_void_p,ctypes.c_char_p]
        lua.lua_pcall.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int]
        lua.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p]
        lua.lua_tolstring.restype=ctypes.c_char_p
        lua.lua_close.argtypes=[ctypes.c_void_p]
        state=lua.luaL_newstate();lua.luaL_openlibs(state)
        script=(ROOT/'lib/scene_transitions/random_spirits.lua').read_text()
        harness=r'''
clock=0; updates={}; source={name='Hub Spirit Transitions',kind='obs_stinger_transition',time=0}
current=source; missing=false; timer=false
io.open=function() if missing then return nil end return {close=function() end,read=function()return '{}' end} end
obslua={LOG_INFO=1,LOG_WARNING=2,OBS_FRONTEND_EVENT_TRANSITION_STARTED=1,
 OBS_FRONTEND_EVENT_TRANSITION_STOPPED=2,OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGING=3,
 OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED=4,OBS_FRONTEND_EVENT_FINISHED_LOADING=5}
local o=obslua
o.os_gettime_ns=function() return clock*1e9 end
o.obs_frontend_get_transitions=function() return {source} end
o.source_list_release=function() end
o.obs_source_get_name=function(s)return s.name end
o.obs_source_get_id=function(s)return s.kind end
o.obs_frontend_get_current_transition=function() return current end
o.obs_source_release=function() end
o.obs_source_get_ref=function(s)return s end
o.obs_source_get_signal_handler=function(s)return s end
o.signal_handler_connect=function(s,name,fn)s[name]=fn end
o.signal_handler_disconnect=function(s,name,fn)s[name]=nil end
o.obs_transition_get_time=function(s)return s.time end
o.obs_data_create=function() return {} end
o.obs_data_create_from_json=function()return {} end
o.obs_data_get_int=function(s,k)return s[k] or 0 end
o.obs_data_get_double=o.obs_data_get_int
o.obs_data_set_string=function(s,k,v)s[k]=v end
o.obs_data_set_int=o.obs_data_set_string;o.obs_data_set_bool=o.obs_data_set_string
o.obs_data_get_string=function(s,k)return s[k] or '' end
o.obs_data_get_bool=function(s,k)return s[k] end
o.obs_data_release=function()end
o.obs_source_update=function(s,d) table.insert(updates,d.path);s.settings=d end
o.script_log=function()end
o.timer_add=function()timer=true end;o.timer_remove=function()timer=false end
o.obs_frontend_add_event_callback=function()end;o.obs_frontend_remove_event_callback=function()end
'''
        checks=r'''
script_load({directory='C:/fixtures',transition_name='Hub Spirit Transitions',enabled=true})
assert(#updates==1 and source.settings.transition_point==4000)
for cycle=1,4 do
 local seen={}
 for i=1,4 do
  local path=updates[#updates];assert(not seen[path],'repeat within shuffle cycle');seen[path]=true
  if #updates>1 then assert(path~=updates[#updates-1],'immediate repeat') end
  source.time=.4;source['transition_start']()
  local count=#updates
  clock=clock+4.0;spirit_event(obslua.OBS_FRONTEND_EVENT_TRANSITION_STOPPED);source.time=1;spirit_tick()
  assert(#updates==count,'cut event must not replace still-playing video')
  clock=clock+2.6;spirit_tick();assert(#updates==count,'tail guard must outlast video')
  clock=clock+.3;spirit_tick();assert(#updates==count+1,'next video not queued')
 end
end
source.time=.3;source['transition_start']()
local count=#updates;current={name='Move'};source.time=1;clock=clock+7;spirit_tick()
assert(#updates==count and not timer,'respect user selecting another transition')
current=source;missing=true;script_update({directory='C:/missing',transition_name='Hub Spirit Transitions',enabled=true})
assert(#updates==count,'missing files must retain last working playback')
script_unload();assert(not timer)
'''
        try:
            code=(harness+'\n'+script+'\n'+checks).encode()
            status=lua.luaL_loadstring(state,code)
            if not status:status=lua.lua_pcall(state,0,0,0)
            error=lua.lua_tolstring(state,-1,None) if status else None
            self.assertEqual(status,0,error.decode() if error else 'Lua failed')
        finally:lua.lua_close(state)


if __name__=='__main__':unittest.main()
