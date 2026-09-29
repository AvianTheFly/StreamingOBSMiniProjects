import copy
import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from .engine import Engine, defaults
from .editor import describe, validate_rule, SettingsStore
from .main import Service
from .test_engine import snapshot, event

class EditorTests(unittest.TestCase):
    def test_every_builtin_explained(self):
        for key,rule in defaults()['events'].items():
            self.assertTrue(describe(key,rule)['description'],key)

    def test_custom_rules_baseline_scope_and_threshold(self):
        c=defaults(); c['events']['custom_health']=validate_rule(dict(enabled=True,priority=80,duration=5,cooldown=0,volume=.5,trigger={'type':'snapshot','field':'health_percent','operator':'crosses_below','value':15}),True)
        c['events']['custom_elder']=validate_rule(dict(enabled=True,priority=80,duration=5,cooldown=0,volume=.5,trigger={'type':'event','event_name':'DragonKill','scope':'local_team','field':'DragonType','equals':'Elder'}),True)
        e=Engine(c); e.ingest(snapshot())
        s=snapshot(101,[event(1,'DragonKill',101,KillerName='Enemy#NA1',DragonType='Elder')]); s['activePlayer']['championStats']['currentHealth']=140
        keys={a['key'] for a in e.ingest(s)}; self.assertIn('custom_health',keys); self.assertNotIn('custom_elder',keys)
        s['gameData']['gameTime']=102
        self.assertNotIn('custom_health',{a['key'] for a in e.ingest(s)})
        s['gameData']['gameTime']=103; s['events']['Events'].append(event(2,'DragonKill',103,KillerName='OldName',DragonType='Elder'))
        self.assertIn('custom_elder',{a['key'] for a in e.ingest(s)})

    def test_validation_and_atomic_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=SettingsStore(Path(tmp)/'alerts.json'); c=store.load(); c['events']['kill']['title']='My kill'
            saved=store.save(c); self.assertEqual(saved['revision'],1); self.assertEqual(store.load()['events']['kill']['title'],'My kill')
        for bad in [float('nan'),float('inf'),-1,101,True]:
            with self.assertRaises(ValueError): validate_rule({**defaults()['events']['kill'],'priority':bad})
        with self.assertRaises(ValueError): validate_rule({**defaults()['events']['kill'],'trigger':{'type':'script'}})

    def test_pause_and_preview(self):
        c=defaults(); c['paused']=True; e=Engine(c)
        e.submit([{'key':'kill'}]); self.assertFalse(e.active())
        e.submit([{'key':'kill','confidence':'preview'}]); self.assertEqual(len(e.active()),1)

    def test_missing_snapshot_field_and_slot_reduction(self):
        c=defaults(); c['events']['custom_health']=validate_rule(dict(enabled=True,priority=80,duration=5,cooldown=0,volume=.5,trigger={'type':'snapshot','field':'health_percent','operator':'crosses_below','value':15}),True)
        e=Engine(c); e.ingest(snapshot()); s=snapshot(101); s['activePlayer']['championStats']={}
        self.assertNotIn('custom_health',{a['key'] for a in e.ingest(s)})
        e.submit([{'key':k} for k in ['pentakill','ace','kill']]); self.assertEqual(len(e.active()),3)
        e.config['max_alerts']=1; self.assertEqual(len(e.active()),1)

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.patch=patch('league_api.main.ROOT',self.root); self.patch.start()
        self.service=Service(threading.Event())
        self.server=ThreadingHTTPServer(('127.0.0.1',0),self.service.handler())
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.patch.stop(); self.tmp.cleanup()
    def send(self,path,data=None,headers=None):
        if isinstance(data,dict): data=json.dumps(data).encode(); headers={'Content-Type':'application/json',**(headers or {})}
        return urlopen(Request(self.base+path,data=data,headers=headers or {}),timeout=2)
    def test_upload_assign_range_save_conflict_and_unassign(self):
        import wave
        data=io.BytesIO()
        with wave.open(data,'wb') as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(8000); f.writeframes(b'\0'*1600)
        payload=data.getvalue()
        uploaded=json.load(self.send('/upload?name=../../sample.wav',payload,{'Content-Type':'application/octet-stream'}))
        self.assertTrue((self.root/uploaded['path']).is_file())
        self.assertEqual((self.root/uploaded['path']).resolve().parent,self.root/'media')
        saved=json.load(self.send('/event',{'key':'kill','revision':0,'rule':{'media':uploaded['path'],'volume':.3}}))
        self.assertEqual(saved['config']['events']['kill']['volume'],.3)
        response=self.send('/media/kill',headers={'Range':'bytes=0-9'})
        self.assertEqual(response.status,206); self.assertEqual(response.read(),payload[:10])
        with self.assertRaises(HTTPError) as exc: self.send('/event',{'key':'kill','revision':0,'rule':{'volume':.9}})
        self.assertEqual(exc.exception.code,400)
        self.send('/event',{'key':'kill','revision':1,'rule':{'media':''}}).close()
        self.assertEqual(self.service.store.load()['events']['kill']['media'],'')
        self.assertTrue((self.root/uploaded['path']).exists())
    def test_invalid_upload_and_cross_origin(self):
        with self.assertRaises(HTTPError): self.send('/upload?name=bad.exe',b'test',{'Content-Type':'application/octet-stream'})
        with self.assertRaises(HTTPError) as exc: self.send('/clear',{}, {'Origin':'https://example.com'})
        self.assertEqual(exc.exception.code,403)
    def test_create_reload_remove_custom_rule(self):
        saved=json.load(self.send('/custom',{'revision':0,'rule':{'title':'Low health','trigger':{'type':'snapshot','field':'health_percent','operator':'crosses_below','value':15}}}))
        key=next(k for k in saved['config']['events'] if k.startswith('custom_'))
        self.assertIn(key,self.service.store.load()['events'])
        self.send('/delete',{'revision':1,'key':key}).close(); self.assertNotIn(key,self.service.store.load()['events'])
    def test_production_controls_leave_personal_clip_settings_alone(self):
        before=copy.deepcopy(self.service.engine.config)
        with patch('lib.settings_backups.SettingsBackups.snapshot'):
            data=json.load(self.send('/production/configure',{'revision':0,'settings':{'enabled':True,'opacity':.6}}))
        self.assertEqual(data['settings']['opacity'],.6)
        self.assertEqual(self.service.engine.config,before)
        self.send('/production/preview',{'key':'earth_cycle'}).close()
        self.assertTrue(json.load(self.send('/state'))['production']['ambient'])
        self.assertFalse(json.load(self.send('/production/settings'))['overlay_ready'])
        self.send('/state?consumer=obs').close()
        self.assertTrue(json.load(self.send('/production/settings'))['overlay_ready'])
        self.send('/production/clear',{}).close()
        self.assertIsNone(json.load(self.send('/state'))['production']['ambient'])
        with self.assertRaises(HTTPError): self.send('/production/configure',{'revision':0,'settings':{'enabled':False}})
    def test_host_and_cross_origin_preview_rejected(self):
        with self.assertRaises(HTTPError) as exc: self.send('/state',headers={'Host':'attacker.example'})
        self.assertEqual(exc.exception.code,403)
        with self.assertRaises(HTTPError) as exc: self.send('/production/preview',{}, {'Origin':'https://example.com'})
        self.assertEqual(exc.exception.code,403)

if __name__=='__main__': unittest.main()
