// One audible preview at a time; encoded audio/video share a single media clock.
for(const section of document.querySelectorAll('section')){
 const video=section.querySelector('video'),play=section.querySelector('[data-play]');
 const replay=section.querySelector('[data-replay]'),seek=section.querySelector('input[type=range]');
 const loop=section.querySelector('input[type=checkbox]'),time=section.querySelector('output');
 const duration=Number(section.dataset.duration);
 const update=()=>{
  video.style.opacity=video.ended?'0':'1';
  seek.value=Math.min(duration,video.currentTime);
  time.value=`${Math.min(duration,video.currentTime).toFixed(3)} / ${duration.toFixed(3)} s`;
  const label=video.paused?'Play':'Pause';play.title=label;play.setAttribute('aria-label',label);
  play.innerHTML=video.paused?'&#9654;':'&#10074;&#10074;';
 };
 seek.max=duration;video.loop=loop.checked;
 play.addEventListener('click',()=>video.paused?video.play().catch(()=>update()):video.pause());
 replay.addEventListener('click',()=>{video.currentTime=0;video.play().catch(()=>update());});
 loop.addEventListener('change',()=>video.loop=loop.checked);
 seek.addEventListener('input',()=>{video.pause();video.currentTime=Number(seek.value);update();});
 video.addEventListener('play',()=>{
  for(const other of document.querySelectorAll('video'))if(other!==video)other.pause();
  update();
 });
 for(const event of ['pause','timeupdate','ended','seeked','loadedmetadata'])video.addEventListener(event,update);
 // Release audible playback on navigation, including file-preview panel closure.
 window.addEventListener('pagehide',()=>video.pause());
 update();
}
