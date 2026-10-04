"""Persistent session boundaries and reversible match-review policy."""
import copy
import uuid


class Sessions:
    def __init__(self,store,clock):
        self.store,self.clock=store,clock
        self.state=store.metadata('sessions')
        if self.state is None:
            self.state={'current':None,'history':[]}
            self.start('Stream session')
        if not isinstance(self.state,dict) or not isinstance(self.state.get('history'),list):
            raise ValueError('Malformed session archive; original data preserved')

    def start(self,label):
        if not isinstance(label,str) or not label.strip() or len(label)>80:
            raise ValueError('Session name must be 1–80 characters')
        state=copy.deepcopy(self.state)
        if state.get('current'):
            state['current']['ended_at']=self.clock()
            state['history'].append(state['current'])
        state['current']=dict(id=uuid.uuid4().hex,name=label.strip(),started_at=self.clock())
        self.store.metadata('sessions',state)
        self.state=state
        return copy.deepcopy(state['current'])

    def bounds(self,identity=''):
        session=self.state['current']
        if identity:
            session=next((s for s in [self.state['current'],*self.state['history']] if s['id']==identity),None)
            if session is None:
                raise ValueError('Unknown saved session')
        return session['started_at'],session.get('ended_at')


def review(record,patch,now):
    if set(patch)-{'id','revision','note','excluded'}:
        raise ValueError('Unknown review field')
    old=record.get('review',{})
    if patch.get('revision')!=old.get('revision',0):
        raise ValueError('This match was edited elsewhere. Reload before saving.')
    note=patch.get('note',old.get('note',''))
    excluded=patch.get('excluded',old.get('excluded',False))
    if not isinstance(note,str) or len(note)>1000 or not isinstance(excluded,bool):
        raise ValueError('Use a note up to 1,000 characters and an exclusion checkbox')
    updated={**old,'note':note,'excluded':excluded,'revision':old.get('revision',0)+1,'updated_at':now}
    return {**record,'review':updated}
