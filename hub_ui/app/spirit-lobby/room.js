// Original woodland clubhouse plate. Keep its composition and prop placement.
export class Room {
  constructor(){this.plate=new Image();}
  async load(){this.plate.src=new URL('art/clubhouse-clean.webp',import.meta.url).href;await this.plate.decode();return this;}
  draw(c){c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(this.plate,0,0,1920,1080);c.restore();}
}
