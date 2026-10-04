/* SPDX-License-Identifier: GPL-2.0-or-later
 * Monotonic media position, scoped to one transition start. Video and audio
 * share an atomic epoch/position so a late sample cannot contaminate a restart.
 */
#ifndef HUB_SPIRIT_CLOCK_H
#define HUB_SPIRIT_CLOCK_H
#include <stdint.h>
#include <stdatomic.h>
#define SPIRIT_CLOCK_READY UINT32_C(0x80000000)
#define SPIRIT_CLOCK_MS UINT32_C(0x7fffffff)
typedef struct { _Atomic uint64_t state; } spirit_clock;
static inline void spirit_clock_init(spirit_clock *c){atomic_init(&c->state,0);}
static inline uint32_t spirit_clock_epoch(spirit_clock *c){return (uint32_t)(atomic_load(&c->state)>>32);}
static inline uint32_t spirit_clock_value(spirit_clock *c){return (uint32_t)atomic_load(&c->state)&SPIRIT_CLOCK_MS;}
static inline void spirit_clock_reset(spirit_clock *c){
 uint64_t next=(uint64_t)(spirit_clock_epoch(c)+1)<<32;atomic_store(&c->state,next);
}
static inline uint32_t spirit_clock_observe(spirit_clock *c,uint32_t epoch,int64_t sample){
 uint64_t before=atomic_load(&c->state);
 for(;;){
  if((uint32_t)(before>>32)!=epoch)return 0;
  uint32_t low=(uint32_t)before,ms=low&SPIRIT_CLOCK_MS;
  if(sample<0||sample>SPIRIT_CLOCK_MS)return ms;
  /* Media restart is asynchronous. Its old end position is not a new clock. */
  if(!(low&SPIRIT_CLOCK_READY)&&sample>1000)return 0;
  uint32_t next_ms=(uint32_t)sample>ms?(uint32_t)sample:ms;
  uint64_t after=((uint64_t)epoch<<32)|SPIRIT_CLOCK_READY|next_ms;
  if(atomic_compare_exchange_weak(&c->state,&before,after))return next_ms;
 }
}
#endif
