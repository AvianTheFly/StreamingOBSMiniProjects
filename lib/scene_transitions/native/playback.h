/* Pure playback policy. No timers, source updates, UI or OBS dependency. */
#pragma once
#include <stdint.h>
typedef struct { uint32_t rng; int bag[4], remaining, last; uint64_t serial; unsigned variants[4]; } spirit_queue;
static uint32_t spirit_random(spirit_queue *q) {
 uint32_t x=q->rng; x^=x<<13; x^=x>>17; x^=x<<5; return q->rng=x;
}
static void spirit_queue_init(spirit_queue *q,uint32_t seed) {
 q->rng=seed?seed:41; q->remaining=0; q->last=-1; q->serial=0;for(int i=0;i<4;i++)q->variants[i]=(seed>>i)&1;
}
static int spirit_next(spirit_queue *q) {
 if(!q->remaining){
  for(int i=0;i<4;i++)q->bag[i]=i;
  for(int i=3;i>0;i--){int j=spirit_random(q)%(i+1),v=q->bag[i];q->bag[i]=q->bag[j];q->bag[j]=v;}
  if(q->bag[3]==q->last){int v=q->bag[0];q->bag[0]=q->bag[3];q->bag[3]=v;}
  q->remaining=4;
 }
 q->last=q->bag[--q->remaining];q->serial++;return q->last;
}

/* Animal bags avoid repeats; each animal alternates its two performances. */
static unsigned spirit_next_variant(spirit_queue *q,int animal){return q->variants[animal]++ & 1u;}
