/* Live geometric transport between distinct compositions. Curves and facets
 * keep receiving current audio throughout the handoff. Only correspondence is
 * cached, in one bounded plan per scene pair; no frame history or GPU resources. */
(function(root){
 'use strict';
 const Stages=typeof module!=='undefined'&&module.exports?require('./stage_geometry.js'):root.VisualStages;
 const mix=(a,b,t)=>a+(b-a)*t,clamp=v=>Math.max(0,Math.min(1,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const plans=new Map();
 function capture(stage,w,j,decorate=s=>s){
  const groups={stroke:[],line:[],face:[]};
  const add=(kind,points,colors,widths,alphas,key)=>groups[kind].push({points,colors,widths,alphas,key:key??groups[kind].length});
  Stages.render(stage,decorate({
   stroke(p,c,w,a,key){add('stroke',p,c,w,a,key);},
   line(a,b,c,w,alpha,key){add('line',[a,b],[c,c],[w,w],[alpha,alpha],key);},
   face(p,c,a,key){
    const base=key??groups.face.length;
    // Exact fan tessellation bounds every transported facet to a triangle.
    // A many-sided petal must not be duplicated hundreds of times into a city.
    for(let i=1;i<p.length-1;i++)add('face',[p[0],p[i],p[i+1],p[0]],Array(4).fill(c),Array(4).fill(0),Array(4).fill(a),`${base}/${i}`);
   }
  }),w,j);
  for(const list of Object.values(groups))list.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  groups.stroke=groups.stroke.map(canonical);
  return groups;
 }
 function canonical(item){
  const source=prepare(item),knots=[0,1],p=source.points;
  const count=Math.max(16,Math.min(64,Math.ceil(source.total/4)));
  for(let i=1;i<count;i++)knots.push(i/count);
  // One sampling contract in resting scenes and morphs prevents the outline
  // from changing thickness when a differently sampled curve joins it.
  for(let i=1;i<p.length-1;i++){
   const ax=p[i][0]-p[i-1][0],ay=p[i][1]-p[i-1][1],bx=p[i+1][0]-p[i][0],by=p[i+1][1]-p[i][1];
   const dot=(ax*bx+ay*by)/Math.max(1e-9,Math.hypot(ax,ay)*Math.hypot(bx,by));
   if(dot<.94)knots.push(source.times[i]);
  }
  knots.sort((a,b)=>a-b);
  const points=[],colors=[],widths=[],alphas=[],value={point:[0,0,0],color:[0,0,0]};
  for(let i=0;i<knots.length;i++)if(i===0||knots[i]-knots[i-1]>1e-6){
   sampleInto(source,knots[i],value);points.push(value.point.slice());colors.push(value.color.slice());
   widths.push(value.width);alphas.push(value.alpha);
  }
  return {key:item.key,points,colors,widths,alphas};
 }
 function prepare(item){
  const p=item.points,lengths=[0];let total=0;
  for(let i=1;i<p.length;i++){total+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);lengths.push(total);}
  const times=lengths.map(v=>total>1e-8?v/total:0);times[times.length-1]=1;
  const closed=p.length>2&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-5;
  const center=[0,0,0];for(const q of p)for(let k=0;k<3;k++)center[k]+=(q[k]||0)/p.length;
  // Keep every authored vertex: straight-edged gates and crystalline corners
  // must remain exact at both ends, even when the other curve is smooth.
  return {...item,times,closed,center,total};
 }
 function sample(p,u){
  return sampleInto(p,u,{point:[0,0,0],color:[0,0,0]});
 }
 function sampleInto(p,u,out){
  u=clamp(u);let lo=0,hi=p.times.length-1;
  while(hi-lo>1){const m=(hi+lo)>>1;if(p.times[m]<=u)lo=m;else hi=m;}
  const q=(u-p.times[lo])/Math.max(1e-9,p.times[hi]-p.times[lo]);
  for(let k=0;k<3;k++){
   out.point[k]=mix(p.points[lo][k]||0,p.points[hi][k]||0,q);
   out.color[k]=mix(p.colors[lo][k],p.colors[hi][k],q);
  }
  out.width=mix(p.widths[lo],p.widths[hi],q);out.alpha=mix(p.alphas[lo],p.alphas[hi],q);return out;
 }
 function targetTime(u,shift,reverse,closed){
  const v=(reverse?1-u:u)+shift;
  return closed?((v%1)+1)%1:clamp(v);
 }
 function alignment(a,b,kind){
  let best=Infinity,result={shift:0,reverse:false};
  const steps=kind==='face'?4:12;
  for(const reverse of [false,true])for(let k=0;k<(b.closed?steps:1);k++){
   const shift=k/steps;let cost=0;
   for(let i=0;i<steps;i++){
    const u=i/steps,p=sample(a,u).point,q=sample(b,targetTime(u,shift,reverse,b.closed)).point;
    cost+=(p[0]-a.center[0]-q[0]+b.center[0])**2+(p[1]-a.center[1]-q[1]+b.center[1])**2;
   }
   if(cost<best){best=cost;result={shift,reverse};}
  }
  return result;
 }
 function cost(a,b){
  return (a.center[0]-b.center[0])**2+(a.center[1]-b.center[1])**2+
   (Math.sqrt(a.total)-Math.sqrt(b.total))**2*8+(a.closed!==b.closed?1800:0);
 }
 function faceAlignment(a,b){
  let best=Infinity,order=[0,1,2];
  for(const direction of [-1,1])for(let start=0;start<3;start++){
   const indices=[0,1,2].map(i=>(start+direction*i+3)%3);let score=0;
   for(let i=0;i<3;i++)for(let k=0;k<2;k++)score+=(a.points[i][k]-a.center[k]-b.points[indices[i]][k]+b.center[k])**2;
   if(score<best){best=score;order=indices;}
  }return {order};
 }
 function contourPart(item,count,index){
  return !item.closed&&count>1?[index/count,(index+1)/count]:[0,1];
 }
 function preparePart(item,range){
  if(range[0]===0&&range[1]===1)return item;
  const knots=[range[0],...item.times.filter(t=>t>range[0]&&t<range[1]),range[1]],points=[],colors=[],widths=[],alphas=[];
  for(const u of knots){const v=sample(item,u);points.push(v.point);colors.push(v.color);widths.push(v.width);alphas.push(v.alpha);}
  return prepare({points,colors,widths,alphas});
 }
 function pairGroup(a,b,kind){
  if(!a.length||!b.length)return [];
  const n=Math.max(a.length,b.length),countsA=Array(a.length).fill(0),countsB=Array(b.length).fill(0),pairs=[];
  const largeA=a.length>=b.length,large=largeA?a:b,small=largeA?b:a,used=Array(small.length).fill(0);
  // Facet bands have hundreds of tiny faces: spatial ordering avoids a costly
  // all-pairs assignment. The far smaller principal curves use nearest fitting.
  const rank=list=>list.map((p,i)=>i).sort((i,k)=>list[i].center[0]-list[k].center[0]||list[i].center[1]-list[k].center[1]);
  const ra=rank(a),rb=rank(b);
  for(let i=0;i<n;i++){
   let ai,bi;
   if(kind==='face'){ai=ra[Math.floor(i*a.length/n)];bi=rb[Math.floor(i*b.length/n)];}
   else{
    let chosen=0,best=Infinity;const floor=Math.min(...used);
    for(let k=0;k<small.length;k++)if(used[k]===floor){const c=cost(large[i],small[k]);if(c<best){best=c;chosen=k;}}
    used[chosen]++;ai=largeA?i:chosen;bi=largeA?chosen:i;
   }
   countsA[ai]++;countsB[bi]++;pairs.push({a:ai,b:bi,...(kind==='face'?faceAlignment(a[ai],b[bi]):alignment(a[ai],b[bi],kind))});
  }
  // Assign distinct pieces by spatial order, independent of transport direction.
  // The pieces meet at shared endpoints instead of all spanning the whole curve.
  const slots=(side,other,items)=>{
   const result=Array(n),groups=new Map();
   pairs.forEach((p,i)=>{const key=p[side];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
   for(const group of groups.values()){
    group.sort((i,k)=>items[pairs[i][other]].center[0]-items[pairs[k][other]].center[0]||
     items[pairs[i][other]].center[1]-items[pairs[k][other]].center[1]);
    group.forEach((i,slot)=>result[i]=slot);
   }return result;
  };
  const slotsA=slots('a','b',b),slotsB=slots('b','a',a);
  const seenA=new Set(),seenB=new Set();
  return pairs.map((p,i)=>{
   const primaryA=!seenA.has(p.a),primaryB=!seenB.has(p.b);seenA.add(p.a);seenB.add(p.b);
   const ca=countsA[p.a],cb=countsB[p.b],sa=slotsA[i],sb=slotsB[i];
   if(kind==='face')return {...p,...faceAlignment(a[p.a],b[p.b]),
    ca,cb,sa,sb,primaryA,primaryB,delay:0};
   const rangeA=contourPart(a[p.a],ca,sa),rangeB=contourPart(b[p.b],cb,sb);
   const aligned=alignment(preparePart(a[p.a],rangeA),preparePart(b[p.b],rangeB),kind);
   return {...p,...aligned,rangeA,rangeB,ca,cb,primaryA,primaryB,delay:0,lane:n>1?i/(n-1):.5};
  });
 }
 function reference(){
  return {w:{bands:Array(48).fill(.18),wave:Array(128).fill(0),f:{}},
   j:{travel:1,lamp:0,history:[],tone:.4,drive:.3,palettePhase:0,motion:{bass:.4,mid:.3,high:.2,width:.4,balance:0,
    spring:0,snap:0,kick:0,tick:0,kickAge:1,peaks:Array(24).fill(.18)}}};
 }
 function pairContours(a,b){
  const role=p=>p.widths.reduce((sum,w)=>sum+w,0)/p.widths.length>=.7;
  const groups=list=>[false,true].map(primary=>list.map((p,i)=>({p,i})).filter(({p})=>role(p)===primary));
  const aa=groups(a),bb=groups(b);
  if(aa.some(g=>!g.length)||bb.some(g=>!g.length))return pairGroup(a,b,'stroke');
  // Main silhouettes inherit other main silhouettes. Thin interior rails do
  // not branch into the thick leading edge of a new composition.
  return aa.flatMap((group,k)=>pairGroup(group.map(v=>v.p),bb[k].map(v=>v.p),'stroke')
   .map(pair=>({...pair,a:group[pair.a].i,b:bb[k][pair.b].i})));
 }
 function plan(from,to){
  const key=from+':'+to;if(plans.has(key))return plans.get(key);
  const {w,j}=reference(),a=capture(from,w,j),b=capture(to,w,j),result={};
  for(const kind of ['face','line','stroke']){
   const aa=a[kind].map(prepare),bb=b[kind].map(prepare);
   result[kind]=kind==='stroke'?pairContours(aa,bb):pairGroup(aa,bb,kind);
  }
  plans.set(key,result);return result;
 }
 function render(sink,w,j,decorate=s=>s){
  if(!j.transitioning||j.blend<=0||j.blend>=1){
   const stage=j.transitioning&&j.blend>=1?j.next:j.stage;
   // Resting scenes need the same canonical contours, but no correspondence
   // records or triangle/color/width copies for thousands of ordinary facets.
   Stages.render(stage,decorate({
    face(p,c,a,key){sink.face(p,c,a,key);},
    line(a,b,c,w,alpha,key){sink.line(a,b,c,w,alpha,key);},
    stroke(points,colors,widths,alphas,key){const p=canonical({points,colors,widths,alphas,key});
     emit(sink,p.points,p.colors,p.widths,p.alphas);}
   }),w,j);return;
  }
  const a=capture(j.stage,w,j,decorate),b=capture(j.next,w,j,decorate),mapping=plan(j.stage,j.next),progress=j.blend;
  for(const kind of ['face','line','stroke']){
   // Facet correspondence is already cached. Its live interpolation only needs
   // three corners, color and opacity; rebuilding arc metrics wastes every frame.
   const aa=kind==='face'?a[kind]:a[kind].map(prepare),bb=kind==='face'?b[kind]:b[kind].map(prepare);
   // Isolated decorative rails may not exist in the other composition. They
   // contract into their own moving center while principal contours transport.
   if(!mapping[kind].length){
    const list=aa.length?aa:bb,q=aa.length?1-progress:progress;
    for(const raw of list){const p=kind==='face'?prepare(raw):raw;
     // An unmatched rail contracts inside its own spatial plane. Dropping Z
     // would move it to the camera pivot during the first tilted morph frame.
     const points=p.points.map(v=>[0,1,2].map(k=>mix(p.center[k],v[k]||0,q)));
     if(kind==='face')sink.face(points.slice(0,-1),p.colors[0],p.alphas[0]*q);
     else emit(sink,points,p.colors,p.widths,p.alphas.map(v=>v*q));}
    continue;
   }
   for(const pair of mapping[kind]){
    const p=aa[pair.a],r=bb[pair.b],q=progress;
    // One full-strength contour owns each seam; branches share its coverage
    // only after they separate. This also avoids 8-bit alpha underflow when a
    // single crystal facet has many tiny destination facets.
    const split=smooth(q/.18),merge=smooth((1-q)/.18);
    const partA=kind!=='face'&&pair.rangeA[1]-pair.rangeA[0]<1;
    const partB=kind!=='face'&&pair.rangeB[1]-pair.rangeB[0]<1;
    const shareA=partA?1:mix(pair.primaryA?1:0,1/pair.ca,split),shareB=partB?1:mix(pair.primaryB?1:0,1/pair.cb,merge);
    const share=mix(shareA,shareB,q);if(share<1e-6)continue;
    if(kind==='face'){
     const points=[0,1,2].map(i=>[0,1,2].map(k=>mix(p.points[i][k]||0,r.points[pair.order[i]][k]||0,q)));
     // Unequal meshes contain many incompatible moving facets. Their surface
     // detail stays subordinate to the transported silhouette instead of
     // drawing a bright stack of diagonal panes across it. Matched meshes keep
     // full material; both authored endpoints retain their exact coverage.
     const density=1/(1+3*(Math.max(pair.ca,pair.cb)-1)*4*q*(1-q));
     const color=p.colors[0].map((v,k)=>mix(v,r.colors[0][k],q)),alpha=mix(p.alphas[0],r.alphas[0],q)*density;
     sink.face(points,color,sink.coverageCopies?alpha:1-Math.pow(1-clamp(alpha),share),undefined,1/share);
     continue;
    }
    const [a0,a1]=pair.rangeA,[b0,b1]=pair.rangeB;
    const convert=u=>mix(b0,b1,targetTime(u,pair.shift,pair.reverse,r.closed));
    const knots=[0,1];
    for(const time of p.times){const u=(time-a0)/(a1-a0);if(u>0&&u<1)knots.push(u);}
    for(const time of r.times){const local=(time-b0)/(b1-b0);if(local<0||local>1)continue;
     let u=pair.reverse?1+pair.shift-local:local-pair.shift;if(r.closed)u=((u%1)+1)%1;if(u>0&&u<1)knots.push(u);}
    knots.sort((x,y)=>x-y);const unique=knots.filter((v,i)=>i===0||v-knots[i-1]>1e-6);
    const points=[],colors=[],widths=[],alphas=[],x={point:[0,0,0],color:[0,0,0]},y={point:[0,0,0],color:[0,0,0]};
    // Principal curves inherit the live, evolving shapes directly. Their
    // transport stays visible throughout, with no intermediate preset pose.
    for(const u of unique){
     sampleInto(p,mix(a0,a1,u),x);sampleInto(r,convert(u),y);
     const point=[],color=[];for(let k=0;k<3;k++){point.push(mix(x.point[k],y.point[k],q));color.push(mix(x.color[k],y.color[k],q));}
     points.push(point);colors.push(color);widths.push(mix(x.width,y.width,q));
     // Multiplicity compensation preserves coverage as one contour branches
     // into several, instead of brightening duplicate paths at the endpoints.
     const alpha=mix(x.alpha,y.alpha,q);
     alphas.push(sink.coverageCopies?alpha:1-Math.pow(1-clamp(alpha),share));
    }
    const copies=1/share;
    emit(sink,points,colors,widths,alphas,copies);
   }
  }
 }
 function emit(sink,p,c,w,a,copies=1){if(sink.stroke)sink.stroke(p,c,w,a,undefined,copies);else for(let i=1;i<p.length;i++)sink.line(p[i-1],p[i],c[i],w[i],a[i]);}
 const api={render,capture,planCount:()=>plans.size};root.VisualMorph=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
