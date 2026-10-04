// Bear-only image selection and anatomical cutout regions.
import {Parts} from '../../rig.js';
import {SpriteMesh} from '../../mesh.js';
const atlas={file:'bear-storm-rig-v14.png',width:1254,regions:[
 [[0,0],[697,0],[697,627],[0,627]],[[697,0],[1254,0],[1254,627],[697,627]],
 [[0,627],[627,627],[627,1254],[0,1254]],[[627,627],[1254,627],[1254,1254],[627,1254]]
]};
const turnAtlas={file:'bear-storm-turn-v14.png',width:1254,regions:[
 [[0,100],[640,100],[640,285],[657,310],[670,335],[678,355],[678,395],[640,420],[627,610],[0,610]],
 [[640,100],[1254,100],[1254,610],[627,610],[640,420],[678,395],[678,355],[670,335],[657,310],[640,285]],
 [[0,650],[627,650],[627,1190],[0,1190]],[[627,650],[1254,650],[1254,1190],[627,1190]]
]};
// Three complete frontal poses retain the original painted shoulder/arm anatomy.
const frontAtlas={file:'bear-storm-front-v14.png',width:1774,regions:[
 [[443,400],[887,400],[887,887],[443,887]],
 [[904,400],[1324,400],[1324,887],[904,887]],
 [[1330,400],[1774,400],[1774,887],[1330,887]]
]};
export async function load(){const parts=await new Parts().load('bear',atlas);
 parts.run=await Promise.all([[0,0],[1,0],[0,1],[1,1]].map(cell=>new SpriteMesh().load('bear-storm-run-v14',cell)));
 parts.turn=(await new Parts().load('bear',turnAtlas)).cells;
 parts.front={poses:(await new Parts().load('bear',frontAtlas)).cells};
 for(const pose of parts.front.poses)pose.mesh.fromImage(pose.image,20,24);
 for(const key of ['view','mix']){parts.front[key]=document.createElement('canvas');parts.front[key].width=1536;parts.front[key].height=1080;}
 for(const key of ['view','mix']){parts[key]=document.createElement('canvas');parts[key].width=1536;parts[key].height=1080;}
 return parts;}
