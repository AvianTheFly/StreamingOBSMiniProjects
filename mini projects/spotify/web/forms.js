/* Pure instrument catalog: topology, palettes and audio-to-form mappings.
 * Every instrument shares the same mesh, so morph endpoints match exactly.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 const mix=(a,b,t)=>t===0?a:t===1?b:a+(b-a)*t;
 function sample(values,t){
  const p=clamp(t)*(values.length-1),i=Math.floor(p),f=p-i;
  return mix(values[i]||0,values[Math.min(i+1,values.length-1)]||0,f);
 }
 const names=['Spectral silk','Phase bloom','Resonant orbit','Folded light','Standing tide',
  'Harmonic knot','Prismatic fan','Fluid lens','Electric pleat','Aurora ribbon',
  'Solar corolla','Double helix','Liquid heart','Prism lantern','Pulse mandala',
  'Resonance wings','Sonic vortex','Jelly bell','Comet braid','Star prism','Mobius flow','Petal flare',
  'Event horizon','Photon torus','Flow braid','Luminous gyroid','Iris aperture','Chromatic wave'];
 // Line, translucent surface, and spectral beads are rendering properties of
 // the SAME geometry. They interpolate with its vertices during every morph.
 const styles=[
  [1,.5,0],[1,.8,0],[.9,.4,.35],[1,.9,0],[1,.4,0],[1,.5,.2],
  [1,.7,0],[1,1,0],[1,.4,.3],[1,1,0],[1,1,.35],[1,.7,.45],
  [1,1,0],[1,.65,.55],[.65,.35,1],[1,1,.25],[.8,.5,.8],
  [1,1,.3],[.65,.65,1],[1,.7,.55],[1,1,.15],[1,1,.4],
  [1,.85,.4],[1,1,.25],[1,.7,.65],[1,1,.3],[1,.95,.25],[1,.9,.35]];
 const colors=[210,224,206,238,214,216,232,210,246,214,226,206,238,224,216,232,208,222,242,224,214,232,218,204,212,234,222,214];
 const affinity=[.25,.65,.2,.55,.3,.7,.8,.4,.95,.5,.32,.6,.24,.72,.9,.4,.75,.2,.85,.65,.5,.3,.18,.45,.7,.85,.35,.55];
 const closed=new Set([1,2,5,7,10,12,13,14,15,19,21,22,23,24,26]);
 function point(world,mode,u,row){
   const f=world.f,a=TAU*u,q=row/(9-1),v=(q-.5)*2;
   const low=world.phase[0],travel=world.phase[1],high=world.phase[2];
   const bass=Math.sqrt(f.bass),mid=Math.sqrt(f.mid),treble=Math.sqrt(f.treble);
   const level=Math.sqrt(world.levels[row]),attack=world.attacks[row];
   // Fold the audio lookup around closed paths: measured windows are not periodic.
   const signal=closed.has(mode)?(1-Math.cos(a))*.5:u;
   const w=(sample(world.wave,signal-.012)+2*sample(world.wave,signal)+sample(world.wave,signal+.012))*.25;
   const spectrum=sample(world.bands,signal),detail=w*(2+treble*5)+spectrum*4;
   let x,y,z;
   // Each instrument maps the same nine frequency lanes into a different
   // continuous surface. Curvature/detail still comes from the measured audio.
   switch(mode){
    case 0: { // flowing sheets: signed waveform along a softly folded ribbon
     x=(u-.5)*116;y=v*22+Math.sin(a+travel)*mid*17+w*(8+level*11);
     z=Math.cos(a*.5+low+v)*bass*24;break;
    }
    case 1: { // phase-space rosette: spectral energy opens its lobes
     const r=26+v*9+Math.cos(a*3+travel)*mid*13+detail;
     x=Math.cos(a)*r;y=Math.sin(a)*r;z=Math.sin(a*2+low+v)*bass*24;break;
    }
    case 2: { // nested orbits: frequency lanes become a toroidal field
     const r=36+v*11+detail+attack*4;
     x=Math.cos(a)*r;y=Math.sin(a)*r*.48+v*5;
     z=Math.sin(a+low)*bass*27+Math.cos(v*Math.PI+travel)*mid*9;break;
    }
    case 3: { // folded contour sheets, smooth rather than faceted confetti
     x=(u-.5)*105;y=v*23+Math.sin(a*1.5+travel+v)*mid*21+w*level*9;
     z=Math.cos(a+low)*bass*22+v*mid*10;break;
    }
    case 4: { // standing-wave contours
     x=(u-.5)*116;y=v*24+Math.sin(a*2+travel)*Math.sin(u*Math.PI)*(8+mid*19)+detail*level;
     z=Math.sin(a+v+low)*bass*17;break;
    }
    case 5: { // harmonic knot: intertwined continuous phase trajectories
     const r=29+v*9+Math.cos(a*3+travel)*mid*10;
     x=Math.sin(a*2)*r;y=Math.sin(a*3+low*.3)*r*.86;
     z=Math.cos(a*2+travel)*bass*22+w*level*8;break;
    }
    case 6: { // spectrum opens a fan into a curved folded shell
     const r=18+q*37+detail;
     x=Math.sin(a*.76-2.4)*r;y=Math.cos(a*.76-2.4)*r*.8+8;
     z=Math.sin(a+travel)*mid*23+Math.cos(a*2+low)*bass*9;break;
    }
    case 7: { // elliptical lens, contracting and refracting with the bass
     const r=28+v*11+Math.sin(a*2+travel)*mid*10+detail;
     x=Math.cos(a)*r*1.2;y=Math.sin(a)*r*.7;
     z=Math.cos(a+v*Math.PI+low)*bass*29;break;
    }
    case 8: { // high-frequency pleats on a stable bowed sheet
     x=(u-.5)*105;y=v*22+Math.sin(a*3+high)*treble*14+w*(5+level*12);
     z=Math.sin(a+travel+v)*mid*28;break;
    }
    case 9: { // auroral curtain: stacked oscilloscope lanes curl into space
     x=(u-.5)*103+Math.sin(a+travel)*mid*8;
     y=v*24+Math.sin(a*.75+low)*bass*17+detail*level;
     z=Math.cos(a+travel+v*2)*mid*27;break;
    }
    case 10: { // petals open independently with their frequency lane
     const petals=5,opening=11+mid*10+attack*9;
     const r=25+v*10+Math.cos(a*petals+travel*.35)*opening+detail;
     x=Math.cos(a)*r;y=Math.sin(a)*r;z=Math.sin(a*petals+low)*bass*18;break;
    }
    case 11: { // a double helix seen obliquely: each lane is a luminous filament
     const turn=a*1.6+travel+v*Math.PI,spread=15+bass*12+attack*5;
     x=(u-.5)*97;y=Math.sin(turn)*spread+v*5+w*level*7;
     z=Math.cos(turn)*spread;break;
    }
    case 12: { // a heart-shaped phase trace inflates with low-frequency attacks
     const r=.72+q*.3;
     x=48*Math.sin(a)**3*r;
     y=-(38*Math.cos(a)-15*Math.cos(2*a)-7*Math.cos(3*a)-3*Math.cos(4*a))*r+5+detail;
     z=Math.sin(a+travel+v)*mid*20;break;
    }
    case 13: { // diamond contours flex into a prismatic lantern
     const r=28+q*22+detail,den=Math.abs(Math.cos(a))+Math.abs(Math.sin(a));
     x=Math.cos(a)/den*r;y=Math.sin(a)/den*r;
     z=Math.cos(a*2+low+v)*bass*24;break;
    }
    case 14: { // a frequency mandala, defined by six soft lobes
     const r=17+q*29+(6+mid*8)*Math.cos(a*6+travel)+detail;
     x=Math.cos(a)*r;y=Math.sin(a)*r;z=Math.sin(a*3+high)*treble*15;break;
    }
    case 15: { // paired wings fold with actual attack envelopes
     const wing=28+18*Math.cos(a*2)+v*7+detail;
     x=Math.sin(a)*wing;
     y=Math.cos(a)*wing*.85;
     z=Math.sin(a)*(10+bass*20+attack*14)*Math.sin(low+v);break;
    }
    case 16: { // spiral lanes: treble highlights travel along the same spiral
     const turn=a*1.65+travel+q*.4,r=5+u*47+v*4+detail*.5;
     x=Math.cos(turn)*r;y=Math.sin(turn)*r*.85;z=(u-.5)*bass*35;break;
    }
    case 17: { // bell surface and flowing tendrils share one continuous path
     const dome=Math.sin(u*Math.PI),sway=Math.sin(a+travel+v)*mid;
     x=v*42*dome+sway*8;
     y=-30*dome+(u-.5)*42+w*level*10;
     z=Math.cos(v*Math.PI*.5)*dome*(18+bass*20)+attack*9;break;
    }
    case 18: { // braided comet stream with spectral highlights on its strands
     const curl=a*1.2+travel+v*.6,spread=(1-u)*(16+mid*17);
     x=(u-.5)*104;y=Math.sin(curl)*spread+v*11+detail;
     z=Math.cos(curl)*spread+attack*10;break;
    }
    case 19: { // soft five-point prism, with a measured waveform edge
     const r=31+v*10+Math.cos(a*5+travel*.2)*(9+mid*8)+detail;
     x=Math.cos(a)*r;y=Math.sin(a)*r;z=Math.cos(a*2+low+v)*bass*21;break;
    }
    case 20: { // a half-twisted band turns its surface through itself
     const r=34+v*13*Math.cos(a/2+travel)+detail*.5;
     x=Math.cos(a)*r;y=Math.sin(a)*r*.65;
     z=v*20*Math.sin(a/2+travel)+Math.sin(a+low)*bass*14;break;
    }
    case 21: { // a fan of petals opens on each lane's own attack
     const r=13+q*27+Math.sin(a*4+travel)*(9+mid*10+attack*7)+detail;
     x=Math.cos(a)*r;y=Math.sin(a)*r;
     z=Math.cos(a*4+low)*bass*(8+q*19);break;
    }
    case 22: { // recessed frequency rings form an audio-driven portal throat
     const r=13+q*39+Math.sin(a*3+travel)*mid*4+detail*.4;
     const turn=a+low*.14*(1-q);
     x=Math.cos(turn)*r;y=Math.sin(turn)*r*.87;
     z=(1-q)*(26+bass*30)+Math.sin(a*2+travel)*mid*11;break;
    }
    case 23: { // a toroidal shell rolls through its own cross-section
     const tube=v*Math.PI+travel*.35,r=32+Math.cos(tube)*(12+bass*7)+detail*.4;
     x=Math.cos(a)*r;y=Math.sin(a)*r*.84;
     z=Math.sin(tube)*(16+bass*11)+Math.sin(a*2+low)*mid*8;break;
    }
    case 24: { // continuous poi-like paths weave a trefoil light sculpture
     const turn=a+v*.09,r=19+v*5+detail*.35;
     x=(Math.sin(turn)+2*Math.sin(2*turn))*r*.85;
     y=(Math.cos(turn)-2*Math.cos(2*turn))*r*.8;
     z=-Math.sin(3*turn+travel*.28)*(20+bass*17)+w*level*7;break;
    }
    case 25: { // interleaved sinusoidal sheets twist into a gyroid-like sculpture
     x=(u-.5)*104;y=v*28+Math.sin(a+q*TAU+travel*.3)*(9+mid*12);
     z=Math.cos(a*1.5-q*TAU+low*.25)*(14+bass*17)+detail;break;
    }
    case 26: { // curved iris blades; high-frequency details light their tips
     const blade=a*6+travel*.28,r=23+q*20+Math.cos(blade)*(7+mid*9)+detail*.4;
     const angle=a+v*.17*Math.sin(blade);
     x=Math.cos(angle)*r;y=Math.sin(angle)*r;
     z=Math.sin(blade+v)*(13+bass*14)+attack*8;break;
    }
    default: { // a stereo wave folds like opalescent fabric
     x=(u-.5)*110;y=v*25+Math.sin(a*1.25+travel*.32+v)*(10+mid*19)+w*level*9;
     z=Math.sin(a+v*Math.PI+low*.3)*(18+bass*19)+Math.cos(a*3+high)*treble*5;break;
    }
   }
   // A small audio-integrated tilt gives depth without independent spinning.
   const tilt=Math.sin(low*.22)*bass*.38,tilt2=Math.sin(travel*.31)*mid*.48;
   const yy=y*Math.cos(tilt)-z*Math.sin(tilt),zz=y*Math.sin(tilt)+z*Math.cos(tilt);
   const xx=x*Math.cos(tilt2)+zz*Math.sin(tilt2),depth=zz*Math.cos(tilt2)-x*Math.sin(tilt2);
   const scale=(.8+Math.sqrt(f.energy)*.18+bass*.12+attack*.025)/(1+depth/240);
   return [xx*scale,yy*scale,depth];
  }
 const catalog={names,styles,colors,affinity,closed,point};
 root.ReactiveForms=catalog;
 if(typeof module!=='undefined'&&module.exports)module.exports=catalog;
})(globalThis);
