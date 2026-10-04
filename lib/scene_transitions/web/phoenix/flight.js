// Rebirth, side exit/re-entry, downward dive, and frontal wing-stroke return.
import {smooth} from '../math.js';
import {track} from '../performance.js';
export const beats={feather:.05,ignite:.72,hatch:1.12,ascent:1.65,bank:2.15,downstroke:3.16};
export function flight(t,variant=0){const side=variant?-1:1;
 return {x:960+side*track([[0,0],[1.12,0],[1.48,340],[1.82,1550],[2.04,1450],[2.23,410],[2.48,-430],[2.64,-260],[2.95,-20],[3.16,0],[3.85,0]],t),
  y:track([[0,880],[1.12,880],[1.48,420],[1.82,140],[2.04,470],[2.23,650],[2.48,1350],[2.64,1520],[2.95,660],[3.16,570],[3.85,570]],t),
  size:track([[0,110],[1.12,110],[1.48,420],[1.82,450],[2.04,490],[2.23,560],[2.48,620],[2.64,710],[2.95,1050],[3.16,1150],[3.85,1380]],t),
  angle:side*track([[0,0],[1.12,0],[1.48,-.34],[1.82,-.18],[2.04,.18],[2.23,-.06],[2.48,-.53],[2.64,.10],[2.95,.05],[3.3,0],[3.85,0]],t),
  // Direction changes happen beyond the side/bottom boundaries, never as a
  // visible sprite flip. Alpha stays present throughout both off-screen arcs.
  alpha:smooth(1.12,1.38,t)*(1-smooth(3.36,3.8,t)),cast:smooth(2.58,2.98,t),
  variant:variant^Number(t>=1.96&&t<2.64)};
}
