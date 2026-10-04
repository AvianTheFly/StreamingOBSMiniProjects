"""Exercise the exact C shuffle policy used by the native OBS module."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
ZIG=Path(os.environ['LOCALAPPDATA'])/'StreamingHub/build-cache/zig-x86_64-windows-0.16.0/zig.exe'

class NativePolicyTests(unittest.TestCase):
    def test_rapid_starts_and_cycle_boundaries(self):
        code=r'''
#include <assert.h>
#include "playback.h"
#include "clock.h"
int main(void) {
 spirit_clock clock;spirit_clock_init(&clock);spirit_clock_reset(&clock);
 uint32_t epoch=spirit_clock_epoch(&clock);
 assert(spirit_clock_observe(&clock,epoch,6600)==0);
 assert(spirit_clock_observe(&clock,epoch,0)==0);
 assert(spirit_clock_observe(&clock,epoch,4100)==4100);
 assert(spirit_clock_observe(&clock,epoch,6599)==6599);
 assert(spirit_clock_observe(&clock,epoch,0)==6599); /* natural-end rewind */
 assert(spirit_clock_observe(&clock,epoch,-1)==6599);
 spirit_clock_reset(&clock);uint32_t fresh=spirit_clock_epoch(&clock);
 assert(spirit_clock_observe(&clock,epoch,6599)==0); /* late old audio sample */
 assert(spirit_clock_value(&clock)==0);
 assert(spirit_clock_observe(&clock,fresh,6550)==0); /* asynchronous restart */
 assert(spirit_clock_observe(&clock,fresh,80)==80);
 assert(spirit_clock_observe(&clock,fresh,40)==80); /* reordered samples */
 assert(spirit_clock_observe(&clock,epoch,6599)==0);
 assert(spirit_clock_value(&clock)==80);
 for(unsigned seed=1;seed<500;seed++){
  spirit_queue q;spirit_queue_init(&q,seed);int previous=-1;unsigned all_clips=0;
  for(int cycle=0;cycle<100;cycle++){
   int seen=0;
   for(int i=0;i<4;i++){
    int id=spirit_next(&q);assert(id>=0&&id<4);assert(id!=previous);
    assert(!(seen&(1<<id)));seen|=1<<id;previous=id;
    unsigned variant=spirit_next_variant(&q,id);all_clips|=1u<<(id*2+variant);
    assert(q.serial==(unsigned long long)(cycle*4+i+1));
   }
   assert(seen==15);if(cycle%2==1){assert(all_clips==255);all_clips=0;}
  }
 }
 return 0;
}
'''
        with tempfile.TemporaryDirectory(prefix='hub-spirit-policy-') as tmp:
            src=Path(tmp)/'policy.c';exe=Path(tmp)/'policy.exe';src.write_text(code)
            subprocess.run([str(ZIG),'cc','-O2','-I',str(ROOT/'lib/scene_transitions/native'),str(src),'-o',str(exe)],check=True,capture_output=True)
            subprocess.run([str(exe)],check=True)

if __name__=='__main__':unittest.main()
