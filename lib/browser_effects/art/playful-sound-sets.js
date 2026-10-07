// Individual stage environments for the selected long/reaction sound performances.
function playfulSoundSet(c,t,d,e,key){
 const{prop,local,line,oval,poly,box,ribbon,garland,sparkle}=playfulInk(c,t,d),beat=t*(e.bpm||120)/60;
 const pink='#ffb0cc',mint='#a3e6d6',gold='#ffe097',blue='#a4d9ff',lilac='#c6b4ff',coral='#ffaf87';
 const wave=(x,y,h,w,f=11)=>u=>[x+Math.sin(u*f+t*.35)*w,y+u*h];
 c.save();
 switch(key){
 case 'crabs':
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1906-j*18:12+j*18;const fn=u=>[x+Math.sin(u*10-t*.45+j)*15,801-u*(345+j*43)];ribbon(fn,j%2?mint:blue,12,.32,j*.08);for(let n=0;n<3;n++){const[x,y]=fn(.15+n*.27);local(x,y,.58,Math.sin(t*.7+n)*.08,()=>poly([[0,0],[23,-15],[34,-6],[18,5],[0,0]],mint));}}
  for(let j=0;j<3;j++)ribbon(u=>[334+u*1250,1042+j*10+Math.sin(u*18-t*.8+j)*8],j%2?mint:blue,19,.32,j*.11);garland(u=>[347+u*1221,48+Math.sin(u*Math.PI)*28],'star',gold,14,.18);break;
 case 'coffin':
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1903-j*14:17+j*14;ribbon(u=>[x+Math.sin(u*Math.PI)*j*5,217+u*591],j%2?gold:lilac,23,.2,j*.1);}for(const side of [0,1])for(let j=0;j<8;j++){const y=230+j*76,x=side?1888:31;local(x,y,.5,0,()=>{box(-8,-18,16,43,4,'#ffeed6');oval(0,-29,5+Math.sin(beat+j)*.4,11,gold);});}garland(u=>[356+u*1211,1045+Math.sin(u*10)*17],'ghost',blue,13,.23);break;
 case 'disco':
  for(const side of [0,1])for(let j=0;j<5;j++){const x=side?1899-j*19:19+j*19;ribbon(wave(x,218,590,17+j*2,14),[pink,mint,gold,lilac,blue][j],17,.3,j*.09);}for(let j=0;j<20;j++){const x=352+j*61;local(x,1051,.65,Math.sin(beat+j)*.04,()=>box(-24,-13,48,26,4,[pink,mint,lilac,blue][j%4]));}garland(u=>[359+u*1210,42+Math.sin(u*Math.PI)*31],'note',gold,15,.22);break;
 case 'mash':
  garland(wave(26,221,589,23,10),'book',lilac,11,.2);for(let j=0;j<4;j++)ribbon(wave(1891-j*14,808,-590,20,12),j%2?gold:mint,13,.3,j*.1);garland(u=>[356+u*1220,1054-Math.sin(u*12)*17],'star',gold,16,.24);for(let j=0;j<10;j++)sparkle(440+j*111,62+Math.sin(beat+j)*8,.45,mint,t*.2+j);break;
 case 'balloons':
  for(const side of [0,1])for(let j=0;j<5;j++)ribbon(wave(side?1900-j*18:18+j*18,210,603,24,14),[pink,gold,mint,blue,lilac][j],11,.27,j*.1);garland(u=>[354+u*1208,54+Math.sin(u*Math.PI)*21],'bow',pink,17,.2);garland(u=>[353+u*1214,1048+Math.sin(u*13)*14],'star',gold,16,.21);break;
 case 'rats':
  for(const side of [0,1]){const x=side?1887:29;ribbon(u=>[x,216+u*595],lilac,21,.31,side*.1);for(let j=0;j<9;j++){const y=228+j*70;line([[x-16,y],[x+16,y]],gold,4,.45);}}garland(u=>[355+u*1206,53+Math.sin(u*14)*15],'note',pink,15,.21);for(let j=0;j<3;j++)ribbon(u=>[345+u*1235,1038+j*11+Math.sin(u*15-t+j)*9],j%2?blue:pink,8,.28,j*.12);break;
 case 'shades':
  for(const side of [0,1])for(let j=0;j<7;j++){const y=213+j*82,x=side?1887:28;line([[x+(side?-47:47),y],[x,y+29],[x,y+63]],j%2?gold:blue,3,.37);}for(let j=0;j<3;j++)ribbon(u=>[340+u*1240,1040+j*12+Math.sin(u*7)*8],j%2?gold:blue,13,.27,j*.11);garland(u=>[345+u*1240,46+Math.sin(u*12)*17],'crown',gold,12,.19);break;
 case 'equalizer':
  for(const side of [0,1])for(let j=0;j<7;j++){const x=side?1905-j*16:15+j*16;const y=799,hh=160+Math.abs(Math.sin(beat*1.7+j*.7))*420;c.save();c.globalAlpha*=.34;box(x-4,y-hh,8,hh,4,[mint,pink,gold,blue][j%4]);c.restore();ribbon(wave(x,215,591,9,18),j%2?mint:lilac,9,.21,j*.1);}garland(u=>[350+u*1220,1050+Math.sin(u*17)*16],'bolt',gold,16,.23);break;
 case 'nyan':
  for(let j=0;j<5;j++){ribbon(wave(12+j*17,211,596,24,14),[pink,gold,mint,blue,lilac][j],20,.35,j*.09);ribbon(wave(1900-j*17,810,-595,23,14),[pink,gold,mint,blue,lilac][j],20,.35,j*.1);}garland(u=>[359+u*1210,1051+Math.sin(u*12)*13],'paw',pink,16,.22);for(let j=0;j<13;j++)sparkle(410+j*91,60+Math.sin(beat+j)*8,.46,j%2?gold:mint,t*.3+j);break;
 case 'tantrum':
  for(const side of [0,1])for(let j=0;j<7;j++){const y=225+j*83,x=side?1887:34;line([[x-21,y],[x+23,y+15],[x-21,y+29],[x+23,y+44]],j%2?pink:gold,3,.42);}garland(u=>[350+u*1220,1048-Math.sin(u*11)*17],'cloud',lilac,12,.22);ribbon(u=>[355+u*1200,41+Math.sin(u*19)*15],mint,21,.23);break;
 case 'kitchen':
  for(let j=0;j<5;j++)ribbon(wave(18+j*16,792,-574,19,12),j%2?gold:coral,16,.3,j*.09);garland(wave(1881,211,590,24,10),'potion',mint,10,.21);for(let j=0;j<18;j++){const x=356+j*68;local(x,1052,.57,Math.sin(t+j)*.04,()=>box(-24,-11,48,22,3,j%2?'#ffedd4':coral));}garland(u=>[362+u*1200,57+Math.sin(u*10)*17],'note',gold,12,.19);break;
 case 'meltdown':
  for(const side of [0,1])for(let j=0;j<4;j++)ribbon(wave(side?1899-j*18:18+j*18,213,598,22,16),j%2?pink:blue,19,.31,j*.12);garland(u=>[347+u*1220,1046+Math.sin(u*14)*16],'alarm',pink,13,.22);garland(u=>[358+u*1205,52+Math.sin(u*13)*14],'bolt',gold,15,.22);break;
 case 'rewind':
  for(const side of [0,1]){const x=side?1886:34;const fn=u=>[x+Math.sin(u*12-t*.35)*17,216+u*590];ribbon(fn,blue,23,.35,side*.1);for(let j=0;j<21;j++){const u=j/20,[xx,y]=fn(u);local(xx,y,.55,-.1,()=>{box(-20,-13,40,26,3,lilac);oval(-12,-8,2,2,'#fff1d8');oval(12,-8,2,2,'#fff1d8');});}}garland(u=>[352+u*1212,49+Math.sin(u*10)*16],'eye',mint,11,.19);break;
 case 'spill':
  for(const side of [0,1])for(let j=0;j<4;j++)ribbon(wave(side?1891-j*14:20+j*14,217,587,24,11),j%2?mint:lilac,22,.28,j*.1);garland(u=>[354+u*1220,1050+Math.sin(u*17)*13],'frog',mint,11,.21);garland(u=>[353+u*1215,52+Math.sin(u*11)*15],'potion',lilac,13,.18);break;
 case 'heartbreak':
  garland(wave(33,218,596,22,11),'heart',pink,14,.22);garland(wave(1884,806,-587,22,11),'note',lilac,12,.22);for(let j=0;j<3;j++)ribbon(u=>[345+u*1233,1040+j*11+Math.sin(u*14-t*.35+j)*10],j%2?pink:blue,13,.28,j*.12);garland(u=>[353+u*1215,55+Math.sin(u*Math.PI)*23],'cloud',blue,10,.22);break;
 case 'isolation':
  for(const side of [0,1])for(let j=0;j<5;j++){const x=side?1886-j*18:28+j*18;ribbon(u=>[x+Math.sin(u*8+t*.2+j)*11,214+u*595],j%2?lilac:blue,14,.19,j*.13);}garland(u=>[358+u*1200,1054-Math.sin(u*Math.PI)*17],'moon',lilac,13,.18);for(let j=0;j<9;j++)sparkle(466+j*125,62,.35,gold,Math.sin(t*.7+j)*.12);break;
 case 'prowler':
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1900-j*12:20+j*12;for(let n=0;n<9;n++){const y=217+n*69;c.save();c.globalAlpha*=.23;box(x,y,8,44,2,j%2?lilac:mint);c.restore();}ribbon(wave(x,208,607,12,15),lilac,12,.18,j*.12);}ribbon(u=>[352+u*1216,1056-Math.sin(u*11)*18],mint,17,.25);garland(u=>[366+u*1190,52+Math.sin(u*12)*13],'eye',lilac,9,.15);break;
 case 'rescue':
  for(let j=0;j<4;j++){ribbon(wave(21+j*16,216,591,23,10),j%2?pink:mint,17,.27,j*.1);ribbon(wave(1897-j*16,807,-591,23,10),j%2?gold:mint,17,.27,j*.1);}garland(u=>[353+u*1220,1056-Math.sin(u*Math.PI)*27],'heart',pink,15,.22);garland(u=>[365+u*1190,54+Math.sin(u*12)*16],'bow',gold,13,.2);break;
 case 'confusion':
  for(const side of [0,1])for(let j=0;j<8;j++){const x=side?1889:32,y=220+j*78;local(x+Math.sin(t+j)*15,y,.49,Math.sin(t*.8+j)*.2,()=>{box(-19,-19,38,38,5,[pink,mint,lilac,blue][j%4]);line([[-10,-10],[10,10]],'#fff1d8',2,.7);});}ribbon(u=>[351+u*1219,1048+Math.sin(u*18)*19],lilac,19,.26);garland(u=>[356+u*1211,57+Math.sin(u*13)*16],'gear',pink,12,.19);break;
 }
 c.restore();
}
