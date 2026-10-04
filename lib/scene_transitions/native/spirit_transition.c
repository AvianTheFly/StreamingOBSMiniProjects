/* SPDX-License-Identifier: GPL-2.0-or-later
 * Native transition ownership: each start selects one pre-created media child.
 * Finishing only stops that child; it NEVER queues or plays a second clip.
 * Built against OBS 32.1.1. Audio composition follows OBS's stinger implementation.
 */
#include <obs-module.h>
#include <util/platform.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "playback.h"
#include "clock.h"
OBS_DECLARE_MODULE()
MODULE_EXPORT const char *obs_module_description(void){return "Streaming Hub spirit transitions";}
static const char *ids[]={"bear","turtle","ram","phoenix"};
struct spirit {
 obs_source_t *source,*media[8]; spirit_queue queue;
 int selected,variant,variant_count; bool playing; spirit_clock clock; uint32_t duration_ms,cut_ms;
 uint32_t cuts[4],covered_from[4],covered_until[4];
};
static obs_source_t *selected_media(struct spirit *s){return s->selected<0?NULL:s->media[s->selected*2+s->variant];}
static const char *name(void *unused){UNUSED_PARAMETER(unused);return "Hub Spirit Shuffle";}
static void telemetry(struct spirit *s){
 obs_data_t *d=obs_source_get_settings(s->source);
 obs_data_set_string(d,"runtime_spirit",s->selected<0?"":ids[s->selected]);
 char clip[64];snprintf(clip,sizeof(clip),"%s%s",s->selected<0?"":ids[s->selected],s->variant?"-alt":"");obs_data_set_string(d,"runtime_clip",clip);
 obs_data_set_int(d,"runtime_serial",s->queue.serial);
 obs_data_set_int(d,"runtime_cut_ms",s->cut_ms);
 obs_data_set_bool(d,"runtime_playing",s->playing);obs_data_release(d);
}
static void stop(void *data){
 struct spirit *s=data;if(!s->playing)return;
 s->playing=false;
 obs_source_t *media=selected_media(s);
 obs_source_media_stop(media);obs_source_remove_active_child(s->source,media);
 telemetry(s);blog(LOG_INFO,"[hub-spirit] stop serial=%llu spirit=%s",(unsigned long long)s->queue.serial,ids[s->selected]);
}
static void update(void *data,obs_data_t *d){
 struct spirit *s=data;
 for(int i=0;i<4;i++){
  char key[80];
  snprintf(key,sizeof(key),"%s_covered_from_ms",ids[i]);s->covered_from[i]=(uint32_t)obs_data_get_int(d,key);
  snprintf(key,sizeof(key),"%s_covered_until_ms",ids[i]);s->covered_until[i]=(uint32_t)obs_data_get_int(d,key);
  if(s->covered_from[i]<1 || s->covered_until[i]<=s->covered_from[i]+100 || s->covered_until[i]>=s->duration_ms){s->covered_from[i]=3850;s->covered_until[i]=4250;}
  snprintf(key,sizeof(key),"%s_cut_ms",ids[i]);int64_t cut=obs_data_get_int(d,key);
  /* Keep a decoded-frame margin on both sides of the verified opaque interval. */
  if(cut<s->covered_from[i]+50)cut=s->covered_from[i]+50;
  if(cut>s->covered_until[i]-50)cut=s->covered_until[i]-50;
  s->cuts[i]=(uint32_t)cut;obs_data_set_int(d,key,cut);
 }
}
static void defaults(obs_data_t *d){
 obs_data_set_default_string(d,"directory","C:/StreamingMedia/Transitions/udyr-spirits-v4");
 obs_data_set_default_int(d,"variant_count",1);
 obs_data_set_default_int(d,"duration_ms",6600);obs_data_set_default_int(d,"cut_ms",4050);
 for(int i=0;i<4;i++){char key[80];
  snprintf(key,sizeof(key),"%s_cut_ms",ids[i]);obs_data_set_default_int(d,key,4050);
  snprintf(key,sizeof(key),"%s_covered_from_ms",ids[i]);obs_data_set_default_int(d,key,3850);
  snprintf(key,sizeof(key),"%s_covered_until_ms",ids[i]);obs_data_set_default_int(d,key,4250);
 }
}
static void *create(obs_data_t *d,obs_source_t *source){
 struct spirit *s=bzalloc(sizeof(*s));s->source=source;s->selected=-1;spirit_clock_init(&s->clock);
 s->duration_ms=(uint32_t)obs_data_get_int(d,"duration_ms");s->cut_ms=(uint32_t)obs_data_get_int(d,"cut_ms");
 if(s->duration_ms<1000)s->duration_ms=6600;if(!s->cut_ms||s->cut_ms>=s->duration_ms)s->cut_ms=4000;
 s->variant_count=obs_data_get_int(d,"variant_count")==2?2:1;
 update(s,d);
 spirit_queue_init(&s->queue,(uint32_t)os_gettime_ns());
 for(int i=0;i<4;i++)for(int variant=0;variant<s->variant_count;variant++){
  int slot=i*2+variant;char path[2048],label[128];
  snprintf(path,sizeof(path),"%s/%s%s.webm",obs_data_get_string(d,"directory"),ids[i],variant?"-alt":"");
  snprintf(label,sizeof(label),"Hub Spirit media: %s %d",ids[i],variant+1);
  obs_data_t *m=obs_data_create();obs_data_set_string(m,"local_file",path);
  obs_data_set_bool(m,"is_local_file",true);obs_data_set_bool(m,"is_stinger",true);
  obs_data_set_bool(m,"looping",false);obs_data_set_bool(m,"hw_decode",false);
  obs_data_set_bool(m,"full_decode",false);obs_data_set_bool(m,"restart_on_activate",true);
  obs_data_set_bool(m,"close_when_inactive",false);obs_data_set_bool(m,"clear_on_media_end",true);
  s->media[slot]=obs_source_create_private("ffmpeg_source",label,m);obs_data_release(m);
  if(!s->media[slot]){for(int j=0;j<8;j++)obs_source_release(s->media[j]);bfree(s);return NULL;}
 }
 obs_transition_enable_fixed(source,true,s->duration_ms+250);telemetry(s);return s;
}
static void destroy(void *data){struct spirit *s=data;stop(s);for(int i=0;i<8;i++)obs_source_release(s->media[i]);bfree(s);}
static void start(void *data){
 struct spirit *s=data;stop(s);s->selected=spirit_next(&s->queue);s->variant=s->variant_count==2?spirit_next_variant(&s->queue,s->selected):0;s->cut_ms=s->cuts[s->selected];spirit_clock_reset(&s->clock);s->playing=true;
 obs_transition_enable_fixed(s->source,true,s->duration_ms+250);
 obs_source_add_active_child(s->source,selected_media(s));
 obs_source_media_restart(selected_media(s));telemetry(s);
 blog(LOG_INFO,"[hub-spirit] play serial=%llu spirit=%s variant=%d",(unsigned long long)s->queue.serial,ids[s->selected],s->variant);
}
/* Decode position, not OBS wall time: the decoder may start later than the scene transition.
 * Subtract one video frame because media_get_time reports the next queued PTS. */
static double seconds(struct spirit *s){
 if(s->selected<0)return 0;
 int64_t ms;
 if(s->playing){uint32_t epoch=spirit_clock_epoch(&s->clock);
  ms=spirit_clock_observe(&s->clock,epoch,obs_source_media_get_time(selected_media(s)));
 }else ms=spirit_clock_value(&s->clock);
 /* Natural media end may reset its timestamp to zero before OBS ends the tail.
  * Retain the greatest position so neither scene video nor audio cuts back. */
 ms-=17;
 return ms>0?ms/1000.0:0;
}
static float kick(double t,double hit,float power){double d=t-hit;return d>=0&&d<.45?(float)(power*exp(-d*12)):0;}
static void scene_render(void *data,gs_texture_t *a,gs_texture_t *b,float progress,uint32_t width,uint32_t height){
 struct spirit *s=data;double t=seconds(s);float amp=0;
 if(s->playing){
  if(s->selected==0)amp=kick(t,2.18,14)+kick(t,2.68,17)+kick(t,3.18,22);
  if(s->selected==1)amp=kick(t,1.94,5)+kick(t,3.62,8);
  if(s->selected==2)amp=kick(t,3.65,34);
  if(s->selected==3)amp=kick(t,1.12,6)+kick(t,3.16,17);
 }
 gs_texture_t *tex=t*1000<s->cut_ms?a:b;if(!tex)tex=a?a:b;if(!tex)return;
 float zoom=1+amp*.002f,dx=sin(t*91)*amp,dy=cos(t*113)*amp*.6f;
 gs_matrix_push();gs_matrix_translate3f(width*.5f+dx,height*.5f+dy,0);
 /* Cast before negation: width/height are unsigned, so -width wraps to 4B. */
 gs_matrix_scale3f(zoom,zoom,1);gs_matrix_translate3f(-(float)width*.5f,-(float)height*.5f,0);
 gs_effect_t *effect=obs_get_base_effect(OBS_EFFECT_DEFAULT);
 const bool srgb=gs_framebuffer_srgb_enabled();gs_enable_framebuffer_srgb(true);
 gs_effect_set_texture_srgb(gs_effect_get_param_by_name(effect,"image"),tex);
 while(gs_effect_loop(effect,"Draw"))gs_draw_sprite(tex,0,width,height);
 gs_enable_framebuffer_srgb(srgb);gs_matrix_pop();UNUSED_PARAMETER(progress);
}
static void render(void *data,gs_effect_t *unused){
 struct spirit *s=data;
 obs_transition_video_render(s->source,scene_render);
 if(s->playing&&s->selected>=0){
  obs_source_t *m=selected_media(s);uint32_t w=obs_source_get_width(m),h=obs_source_get_height(m);
  if(w&&h){const bool linear=gs_set_linear_srgb(true);gs_matrix_push();gs_matrix_scale3f((float)obs_source_get_width(s->source)/w,(float)obs_source_get_height(s->source)/h,1);obs_source_video_render(m);gs_matrix_pop();gs_set_linear_srgb(linear);}
 }
 UNUSED_PARAMETER(unused);
}
static float mix_a(void *data,float t){struct spirit *s=data;UNUSED_PARAMETER(t);return seconds(s)*1000<s->cut_ms?1:0;}
static float mix_b(void *data,float t){return 1-mix_a(data,t);}
static bool audio(void *data,uint64_t *ts,struct obs_source_audio_mix *out,uint32_t mixers,size_t channels,size_t rate){
 struct spirit *s=data;obs_source_t *m=s->selected>=0?selected_media(s):NULL;uint64_t stamp=0;
 if(s->playing&&m&&!obs_source_audio_pending(m))stamp=obs_source_get_audio_timestamp(m);
 bool ok=obs_transition_audio_render(s->source,ts,out,mixers,channels,rate,mix_a,mix_b);
 if(!stamp)return ok;if(!*ts||stamp<*ts)*ts=stamp;
 struct obs_source_audio_mix child;obs_source_get_audio_mix(m,&child);
 for(size_t track=0;track<MAX_AUDIO_MIXES;track++)if(mixers&(1<<track))
  for(size_t ch=0;ch<channels;ch++)for(size_t i=0;i<AUDIO_OUTPUT_FRAMES;i++)out->output[track].data[ch][i]+=child.output[track].data[ch][i];
 return true;
}
static void active_sources(void *data,obs_source_enum_proc_t cb,void *param){struct spirit *s=data;if(s->playing)cb(s->source,selected_media(s),param);}
static void all_sources(void *data,obs_source_enum_proc_t cb,void *param){struct spirit *s=data;for(int i=0;i<8;i++)if(s->media[i])cb(s->source,s->media[i],param);}
static enum gs_color_space color_space(void *data,size_t count,const enum gs_color_space *preferred){UNUSED_PARAMETER(count);UNUSED_PARAMETER(preferred);return obs_transition_video_get_color_space(((struct spirit*)data)->source);}
static obs_properties_t *properties(void *data){
 struct spirit *s=data;obs_properties_t *p=obs_properties_create();
 obs_properties_add_text(p,"about","Scene cut follows animation playback. Each cut stays inside its verified fully covered interval. Changes apply to the next transition.",OBS_TEXT_INFO);
 for(int i=0;i<4;i++){char key[80],label[128];snprintf(key,sizeof(key),"%s_cut_ms",ids[i]);snprintf(label,sizeof(label),"%s scene cut (milliseconds)",ids[i]);
  obs_properties_add_int(p,key,label,s?s->covered_from[i]+50:3900,s?s->covered_until[i]-50:4200,1);
 }return p;
}
static struct obs_source_info info={
 .id="hub_spirit_transition",.type=OBS_SOURCE_TYPE_TRANSITION,.output_flags=OBS_SOURCE_VIDEO|OBS_SOURCE_COMPOSITE|OBS_SOURCE_CUSTOM_DRAW,
 .get_name=name,.update=update,.get_properties=properties,.video_get_color_space=color_space,.create=create,.destroy=destroy,.get_defaults=defaults,.video_render=render,.audio_render=audio,
 .transition_start=start,.transition_stop=stop,.enum_active_sources=active_sources,.enum_all_sources=all_sources
};
bool obs_module_load(void){obs_register_source(&info);return true;}
