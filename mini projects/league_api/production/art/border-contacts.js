// Physical coordinates used by both the drawing and finite contact review.
export function borderStrikeMotion(p){const reach=borderEase(p,.10,.43);return {bladeX:1510+219.6*reach,tipX:1510+219.6*reach+62.4,targetFace:1792,contact:p>=.43};}
export function borderAssistMotion(p){const reach=borderEase(p,.12,.43);return {left:960-(245-206*reach),right:960+(245-206*reach),radius:39,contact:p>=.43};}
export function borderHeraldMotion(p){const charge=borderEase(p,.38,.68);return {shellX:549+970*charge,hornX:648+970*charge,hornY:963,targetFace:1618,contact:p>=.68};}
export function borderLevelMotion(p){const rise=borderEase(p,.44,.70);return {y:716.1-245*rise,foot:42.9,support:514,landed:p>=.70,rise};}
export function borderHextechMotion(p){const join=borderEase(p,.24,.46);return {left:928-82*(1-join),right:992+82*(1-join),terminal:32,contact:p>=.46};}
