// Landmarks on the trimmed intact v14 creature, measured in source UV units.
// Near fore/hind, far fore/hind. Roots, joints and claws are already painted together.
export const anatomy={w:1.24,h:.668,legs:[
 {root:[.559,.600],joint:[.610,.790],sole:[.650,.981],ankle:.90,width:.098},
 {root:[.173,.692],joint:[.142,.824],sole:[.113,.946],ankle:.89,width:.099},
 {root:[.843,.747],joint:[.861,.844],sole:[.890,.961],ankle:.905,width:.065},
 {root:[.410,.777],joint:[.399,.849],sole:[.405,.932],ankle:.90,width:.060}
],regions:[
 [[.535,.58],[.61,.55],[.69,.62],[.733,.79],[.795,1],[.545,1],[.525,.81]],
 [[.065,.665],[.175,.64],[.236,.675],[.275,.83],[.265,1],[0,1],[0,.775]],
 [[.804,.74],[.884,.745],[.914,.817],[.976,.89],[.985,1],[.786,1],[.765,.833]],
 [[.355,.775],[.442,.755],[.505,.84],[.51,1],[.29,1],[.29,.87]]
]};
export function sourcePoint(u,v){return [(u-.5)*anatomy.w,(v-1)*anatomy.h];}
