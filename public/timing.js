// A monotonic display clock. Quiz answers and scores still use server time only.
export class RoomClock {
  constructor({now=()=>performance.now(),epoch=Date.now()}={}) {
    this.read=now;this.origin=now();this.epoch=epoch;this.offset=0;this.synced=false;this.samples=[];this.pending=new Map();this.sequence=0;
  }
  local() {return this.epoch+this.read()-this.origin;}
  now() {return this.local()+this.offset;}
  observe(serverNow) {if(!this.synced&&Number.isFinite(serverNow))this.offset=serverNow-this.local();}
  request() {
    const id=String(++this.sequence);this.pending.set(id,this.local());
    if(this.pending.size>8)this.pending.delete(this.pending.keys().next().value);
    return {type:'ping',id};
  }
  accept(message) {
    const sent=this.pending.get(message.id);if(sent==null)return false;this.pending.delete(message.id);
    const received=this.local(),serverEnd=message.serverNow,serverStart=message.serverReceivedAt??serverEnd;
    if(!Number.isFinite(serverEnd)||!Number.isFinite(serverStart)||serverEnd<serverStart)return false;
    const rtt=received-sent-(serverEnd-serverStart);
    if(rtt<0||rtt>10000)return false;
    const offset=((serverStart-sent)+(serverEnd-received))/2;
    this.samples.push({rtt,offset,at:received});
    this.samples=this.samples.filter(sample=>received-sample.at<120000).slice(-8);
    this.offset=this.samples.reduce((best,sample)=>sample.rtt<best.rtt?sample:best).offset;
    this.synced=true;return true;
  }
}
