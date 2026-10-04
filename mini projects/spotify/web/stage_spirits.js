/* Authored spirit silhouettes and their musical articulation. Pure geometry:
 * no sprite downloads, random particles, private feature imports or clocks.
 * The geometry owner supplies its shared strokes, projection and color tools. */
(function(root){
 'use strict';
 function create({TAU,mix,color,path,project,rot,evolution}){
  const voice=(m,k)=>m.presenceVoices?.[k%8]??m.voices?.[k%8]??[m.bass,m.mid,m.high][k%3];
  const detail=(m,k)=>m.details?.[k%8]??m.tick;
  function curve(points,closed=false,steps=5){
   const p=closed?[...points,points[0]]:points,out=[];
   for(let i=0;i<p.length-1;i++)for(let k=0;k<steps;k++){
    const a=p[i===0?(closed?p.length-2:0):i-1],b=p[i],c=p[i+1],d=p[i+2]||p[closed?1:p.length-1],u=k/steps;
    out.push([0,1,2].map(n=>.5*((2*(b[n]||0))+(-(a[n]||0)+(c[n]||0))*u+
     (2*(a[n]||0)-5*(b[n]||0)+4*(c[n]||0)-(d[n]||0))*u*u+
     (-(a[n]||0)+3*(b[n]||0)-3*(c[n]||0)+(d[n]||0))*u*u*u)));
   }out.push(p.at(-1));return out;
  }
  function instrument(stage,s,w,j){
   const m=j.motion,e=evolution(j),tonal=m.tonal??.5;
   // Tonal passages gather the figure; noisier passages loosen its contours
   // into flowing field lines. The slow opening persists between beats.
   const unravel=(1-e.contour)*(.35+(1-tonal)*.65),depth=18+e.depth*23+m.width*24;
   const point=(p,id,u)=>{
    const wave=Math.sin(p[0]/55+p[1]/75+e.twist)*unravel;
    const local=voice(m,id),spark=detail(m,id);
    return project(rot([p[0]*(1+m.spring*.24)+wave*(7+local*8),
     p[1]*(1+m.spring*.22)+Math.sin(p[0]/45-p[1]/65+e.twist)*unravel*(5+spark*9),
     (p[2]||0)+Math.sin(p[0]/65+p[1]/85+e.twist)*unravel*depth],e.twist*.10,m.balance*.23+e.twist*.14),.92);
   };
   return {
    line(points,id,t=.2,width=.9,alpha=.86,closed=false){
     const pts=curve(points,closed).map((p,i,a)=>point(p,id,i/(a.length-1)));
     path(s,pts,color(stage,t,j),width*(1+detail(m,id)*.4),alpha,j,id*.39,`spirit-${id}`);
    },
    facet(points,id,t=.3,alpha=.24){s.face(points.map((p,i,a)=>point(p,id,i/a.length)),color(stage,t,j),alpha,`facet-${id}`);},
    point
   };
  }
  function phoenix(s,w,j){
   const m=j.motion,e=evolution(j),g=instrument(13,s,w,j);
   const lift=(e.open-.5)*24-m.spring*42-m.kick*7,span=1+m.width*.12;
   // A swept shoulder leads to seven separate flight feathers per wing.
   // Each feather follows its own frequency voice, preserving the bird in rest.
   for(const side of [-1,1]){
    const p=(x,y,z=0)=>[x*side*span,y,z];
    g.line([p(8,-17),p(33,-42+lift*.3),p(74,-60+lift),p(121,-65+lift)],20+(side+1),.1,1.45);
    for(let feather=0;feather<7;feather++){
     const u=feather/6,local=voice(m,feather),hinge=p(19+u*24,-21+u*5,5);
     const tip=p(126-u*67,-57+lift+u*76-local*12,Math.sin(u*Math.PI)*m.width*26);
     const back=p(45-u*16,-4+u*11,8);
     const id=30+(side+1)*10+feather;
     const pts=[hinge,p(70-u*13,-46+lift*.7+u*29),tip,p(tip[0]*side/span-9,tip[1]+9),back];
     g.line(pts,id,u<.45?.13:.95,1.05,.94);
     g.facet([hinge,tip,back],id,u<.45?.13:.9,.18+local*.15);
    }
   }
   g.line([[0,-43],[-9,-29],[-11,-9],[-6,22],[0,30],[7,20],[10,-10],[6,-31],[0,-43]],1,.65,1.5);
   g.facet([[0,-37],[-8,-10],[0,27],[8,-10]],1,.4,.48);
   g.line([[-4,-36],[1,-48],[10,-46],[16,-39],[5,-39]],2,.95,1.1);
   for(let plume=0;plume<5;plume++){
    const u=(plume-2)/2,reach=66+e.depth*12+voice(m,plume)*9;
    g.line([[u*3,19],[u*14,42],[u*(22+e.open*14)+Math.sin(j.travel*.5+plume)*7,reach],
     [u*10,51],[u*2,27]],80+plume,plume%2?.95:.25,.8,.82);
   }
  }
  function bear(s,w,j){
   const m=j.motion,e=evolution(j),g=instrument(14,s,w,j),breath=m.spring*21;
   const head=[[-43,-39],[-29,-58],[0,-62],[29,-58],[43,-39],[46,-9],[30,26],[17,43],[0,48],[-17,43],[-30,26],[-46,-9]];
   for(const side of [-1,1]){
    const p=(x,y,z=0)=>[side*x,y,z];
    g.line([p(28,-51),p(32,-71),p(45,-77),p(58,-68),p(56,-47),p(43,-38)],10+(side+1),.7,1.25);
    g.line([p(37,-57),p(41,-66),p(49,-61),p(47,-51)],14+(side+1),.95,.75);
    g.line([p(12,-17),p(21,-23),p(33,-19)],20+(side+1),1,1.55);
    g.line([p(21,-17),p(25,-17)],24+(side+1),1,1.5);
    g.line([p(42,11),p(60,27),p(81,48+breath),p(87,73+breath*.35)],30+(side+1),.15,1.3);
    // Three weight-bearing claw arcs open with separate lower-mid voices.
    for(let claw=0;claw<3;claw++){
     const reach=92+voice(m,claw)*16+e.open*13;
     g.line([p(55+claw*8,18+claw*6),p(reach+claw*8,37+claw*7+breath),p(111+claw*9,66+claw*5)],40+(side+1)*5+claw,.9-claw*.3,.95);
    }
    g.facet([p(7,-52),p(39,-33),p(28,11),p(12,0)],70+(side+1),.18,.32);
   }
   g.line(head,1,.15,1.45,.95,true);
   g.line([[-21,8],[-15,-3],[0,-8],[15,-3],[21,8],[16,25],[0,32],[-16,25]],2,.55,1.1,.85,true);
   g.facet([[-10,4],[10,4],[5,12],[-5,12]],3,.98,.6);
   g.line([[0,12],[0,22],[-9,25]],4,1,.8);g.line([[0,22],[9,25]],5,1,.8);
   g.line([[-9,-45],[0,-31],[9,-45]],6,.9,.8);
  }
  function turtle(s,w,j){
   const m=j.motion,e=evolution(j),g=instrument(15,s,w,j);
   const shell=(a,r=1)=>[Math.cos(a)*56*r,Math.sin(a)*62*r,-Math.sqrt(Math.max(0,1-r*r))*(22+e.depth*25+m.bass*14)];
   const rim=Array.from({length:24},(_,i)=>shell(i/24*TAU,1));
   g.line(rim,1,.2,1.4,.95,true);
   const center=Array.from({length:6},(_,i)=>shell(i/6*TAU,.43));g.line(center,2,.95,1.1,.95,true);
   g.facet(center,2,.4,.32);
   for(let plate=0;plate<6;plate++){
    const a=plate/6*TAU,b=(plate+1)/6*TAU,points=[shell(a,.43),shell(a,.93),shell(b,.93),shell(b,.43)];
    g.line(points,10+plate,plate%2?.2:.9,.85,.8,true);g.facet(points,10+plate,plate%2?.2:.9,.18+voice(m,plate)*.14);
   }
   for(const side of [-1,1])for(const fore of [true,false]){
    const y=fore?-28:29,swim=Math.sin(j.travel*.9+(fore?0:2))*7+e.open*9+m.spring*27;
    const pts=[[side*42,y],[side*69,y+(fore?-15:6)],[side*(109+swim),y+(fore?12:26)],
     [side*77,y+(fore?20:31)],[side*48,y+15]];
    const id=30+(side+1)*2+(fore?0:1);g.line(pts,id,.95,1.1,.9,true);g.facet(pts.slice(0,4),id,.7,.23);
   }
   g.line([[-14,-58],[-17,-73],[-11,-86],[0,-90],[11,-86],[17,-73],[14,-58]],50,.3,1.3);
   for(const side of [-1,1])g.line([[side*8,-77],[side*10,-77]],54+(side+1),1,1.6);
   g.line([[-9,58],[0,83+e.open*6],[9,58]],60,.95,1);
  }
  function ram(s,w,j){
   const m=j.motion,e=evolution(j),g=instrument(16,s,w,j);
   for(const side of [-1,1]){
    // Paired tapered spiral horns, with eight spectral ridges each.
    for(let rail=0;rail<3;rail++){
     const pts=[];
     for(let i=0;i<=72;i++){
      const u=i/72,a=-Math.PI*.82+u*TAU*1.03,r=49-u*32+(rail-1)*(5-u*3)+m.spring*23;
      pts.push([side*(51+Math.cos(a)*r),-24+Math.sin(a)*r*(.85+e.open*.14),Math.sin(a)*(12+e.depth*14)]);
     }g.line(pts,10+(side+1)*3+rail,rail===1?.95:.12,rail===1?1.4:.65,rail===1?.96:.6);
    }
    for(let ridge=0;ridge<8;ridge++){
     const u=ridge/10,a=-Math.PI*.82+u*TAU*1.03,r=49-u*32+m.spring*23;
     g.line([[side*(51+Math.cos(a)*(r-5)),-24+Math.sin(a)*(r-5)],
      [side*(51+Math.cos(a)*(r+5+voice(m,ridge)*5)),-24+Math.sin(a)*(r+5)]],40+(side+1)*5+ridge,.9,.7);
    }
    g.line([[side*28,-17],[side*56,-6],[side*44,6],[side*30,1]],70+(side+1),.3,1,.9,true);
    g.line([[side*10,-2],[side*21,-8],[side*26,-4]],80+(side+1),1,1.3);
    g.facet([[side*3,-30],[side*26,-18],[side*24,19],[side*8,42]],90+(side+1),.2,.3);
   }
   g.line([[-23,-34],[-32,-9],[-24,26],[-14,48],[0,61],[14,48],[24,26],[32,-9],[23,-34]],1,.2,1.4,.96,true);
   g.line([[-13,27],[0,21],[13,27],[9,39],[0,45],[-9,39]],2,.95,1,.9,true);
   g.line([[-7,-31],[0,-43],[7,-31],[0,-14]],3,.95,1,.95,true);
   for(let i=0;i<3;i++)g.line([[-13+i*6,47],[Math.sin(e.twist+i)*7,75-i*5],[13-i*6,47]],100+i,.35+i*.3,.7);
  }
  function faeries(s,w,j){
   const m=j.motion,e=evolution(j),t=j.travel,items=[];
   // Deliberate near/far flight paths. Bright cores carry local frequencies;
   // the eight voices pull their own wingbeats rather than all pulsing at once.
   for(let id=0;id<24;id++){
    const u=id/24,a=u*TAU+t*.13,lane=id%3-1,local=voice(m,id);
    const radius=55+lane*17+e.open*16+m.spring*32;
    const p=[Math.cos(a)*radius*1.65,Math.sin(a*2+lane*.9)*(28+e.depth*15),Math.sin(a)*(36+m.width*44)+lane*13];
    items.push({id,p,a,local});
   }items.sort((a,b)=>b.p[2]-a.p[2]);
   for(const {id,p,a,local} of items){
    const c=color(12,(id%3)/2,j),size=1.9+local*1.9+detail(m,id)*1.8,pts=[];
    for(let k=0;k<=5;k++){const angle=k/5*TAU;pts.push(project([p[0]+Math.cos(angle)*size,p[1]+Math.sin(angle)*size,p[2]]));}
    s.face(pts.slice(0,-1),c,.72,`faerie-core-${id}`);path(s,pts,c,.7,.97,j,id,`faerie-rim-${id}`);
    for(const side of [-1,1]){
     const wing=[],spread=5+e.contour*5+local*6,flap=.7+.3*Math.sin(t*(1+local)+id);
     for(let k=0;k<=24;k++){
      const q=k/24*TAU,dx=(1-Math.cos(q))*spread*side;
      wing.push(project([p[0]+dx,p[1]+Math.sin(q)*spread*.58*flap,p[2]+dx*e.twist]));
     }path(s,wing,color(12,side===1?1:.05,j),.45,.46+local*.3,j,id,`faerie-wing-${id}-${side}`);
    }
    const trail=[];
    for(let k=0;k<=18;k++){
     const q=k/18,angle=a-q*(.25+e.depth*.25),r=55+(id%3-1)*17+e.open*16+m.spring*32;
     trail.push(project([Math.cos(angle)*r*1.65,Math.sin(angle*2+(id%3-1)*.9)*(28+e.depth*15),p[2]+q*16]));
    }path(s,trail,c,.4,.35+local*.2,j,id,`faerie-flight-${id}`);
   }
  }
  return [faeries,phoenix,bear,turtle,ram];
 }
 const api={create};root.VisualSpiritStages=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
