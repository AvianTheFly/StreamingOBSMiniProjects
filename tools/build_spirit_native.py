"""Build the OBS 32.1.1 native transition using the cached portable Zig compiler.

No system compiler installation or global PATH changes. Cache prerequisites:
official obs-studio-32.1.1 source and zig-x86_64-windows-0.16.0 release.
"""
from pathlib import Path
import os
import struct
import subprocess

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(os.environ['LOCALAPPDATA'])/'StreamingHub/build-cache'
OUT=ROOT/'lib/scene_transitions/native/build'

def dll_exports(file):
    """Read PE export names to create an import library for the installed OBS."""
    data=file.read_bytes();pe=struct.unpack_from('<I',data,0x3c)[0]
    sections=struct.unpack_from('<H',data,pe+6)[0]
    optional_size=struct.unpack_from('<H',data,pe+20)[0]
    optional=pe+24; section_table=optional+optional_size
    def offset(rva):
        for i in range(sections):
            virtual_size,virtual_addr,size,raw=struct.unpack_from('<IIII',data,section_table+i*40+8)
            if virtual_addr<=rva<virtual_addr+max(virtual_size,size):return raw+rva-virtual_addr
        raise ValueError('Unmapped PE address')
    export=offset(struct.unpack_from('<I',data,optional+112)[0])
    count=struct.unpack_from('<I',data,export+24)[0]
    names=offset(struct.unpack_from('<I',data,export+32)[0])
    result=[]
    for i in range(count):
        start=offset(struct.unpack_from('<I',data,names+4*i)[0]);end=data.index(b'\0',start)
        result.append(data[start:end].decode('ascii'))
    return result

def build():
    OUT.mkdir(parents=True,exist_ok=True)
    zig=CACHE/'zig-x86_64-windows-0.16.0/zig.exe'
    headers=CACHE/'obs-studio-32.1.1/libobs'
    (OUT/'obsconfig.h').write_text('#pragma once\n#define OBS_RELEASE_CANDIDATE 0\n#define OBS_BETA 0\n')
    definition=OUT/'obs.def'
    definition.write_text('LIBRARY obs.dll\nEXPORTS\n'+'\n'.join(dll_exports(Path('C:/Program Files/obs-studio/bin/64bit/obs.dll'))))
    subprocess.run([str(zig),'dlltool','-d',str(definition),'-l',str(OUT/'obs.lib'),'-m','i386:x86-64'],check=True)
    subprocess.run([str(zig),'cc','-target','x86_64-windows-gnu','-O2','-shared','-std=c11',
        '-I',str(headers),'-I',str(OUT),str(ROOT/'lib/scene_transitions/native/spirit_transition.c'),str(OUT/'obs.lib'),
        '-o',str(OUT/'hub-spirit-transition.dll')],check=True)
    print(OUT/'hub-spirit-transition.dll')

if __name__=='__main__':build()
