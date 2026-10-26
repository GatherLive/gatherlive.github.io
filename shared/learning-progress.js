// Compact per-device counters keep learning sync idempotent across offline devices.
export const LEARNING_MAX_BYTES=128*1024;
export const LEARNING_MAX_DEVICES=8;
export const LEARNING_MAX_ITEMS=750;
const MAX_COUNT=1_000_000;
const TOPICS=new Set(['flags','capitals','map','review']);
const REGIONS=new Set(['World','Africa','Americas','Asia','Europe','Oceania']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
export class LearningProgressError extends Error {
  constructor(status,message,progress){super(message);this.name='LearningProgressError';this.status=status;if(progress)this.progress=progress;}
}
export function emptyLearningProgress(generation=0){return {version:1,generation,updatedAt:0,devices:{},tests:[]};}
function invalid(){throw new LearningProgressError(400,'Invalid learning progress.');}
export function validateLearningProgress(input,now=Date.now()){
  if(!record(input)||input.version!==1||!integer(input.generation,Number.MAX_SAFE_INTEGER)||!integer(input.updatedAt,now+300_000)||!record(input.devices)||!Array.isArray(input.tests))invalid();
  const deviceEntries=Object.entries(input.devices);
  if(deviceEntries.length>LEARNING_MAX_DEVICES||input.tests.length>20)throw new LearningProgressError(413,'Learning progress has reached its sync limit.');
  const out=emptyLearningProgress(input.generation);out.updatedAt=input.updatedAt;
  for(const [id,device] of deviceEntries){
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!record(device)||!record(device.items))invalid();
    const entries=Object.entries(device.items);if(entries.length>LEARNING_MAX_ITEMS)throw new LearningProgressError(413,'Learning progress has reached its sync limit.');
    const items={};
    for(const [key,tuple] of entries){
      if(!/^(flags|capitals|map):[a-z]{2}$/.test(key)||!Array.isArray(tuple)||tuple.length!==6||!tuple.slice(0,3).every(value=>integer(value,MAX_COUNT))||!tuple.slice(3).every(value=>integer(value,now+300_000))||tuple[1]>tuple[0]||tuple[2]>tuple[1])invalid();
      items[key]=tuple.slice();
    }
    out.devices[id]={items};
  }
  const testIds=new Set();
  for(const test of input.tests){
    if(!record(test)||typeof test.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(test.id)||testIds.has(test.id)||!TOPICS.has(test.topic)||!REGIONS.has(test.region)||!integer(test.total,750)||test.total<1||!integer(test.correct,test.total)||!integer(test.at,now+300_000))invalid();
    testIds.add(test.id);out.tests.push({id:test.id,topic:test.topic,region:test.region,total:test.total,correct:test.correct,at:test.at});
  }
  if(new TextEncoder().encode(JSON.stringify(out)).byteLength>LEARNING_MAX_BYTES)throw new LearningProgressError(413,'Learning progress has reached its sync limit.');
  return out;
}
function compareTests(a,b){return a.at-b.at||a.id.localeCompare(b.id);}
export function mergeLearningProgress(saved,incoming,now=Date.now()){
  const current=validateLearningProgress(saved,now),next=validateLearningProgress(incoming,now);
  if(current.generation!==next.generation)throw new LearningProgressError(409,'Learning progress was reset on another device.',current);
  const out=structuredClone(current);out.updatedAt=Math.max(current.updatedAt,next.updatedAt);
  for(const [id,device] of Object.entries(next.devices)){
    out.devices[id] ||= {items:{}};
    for(const [key,tuple] of Object.entries(device.items)){
      const old=out.devices[id].items[key];out.devices[id].items[key]=old?tuple.map((value,index)=>Math.max(value,old[index])):tuple.slice();
    }
  }
  const tests=new Map(current.tests.map(test=>[test.id,test]));
  for(const test of next.tests){const old=tests.get(test.id);if(!old||test.at>old.at||(test.at===old.at&&JSON.stringify(test)>JSON.stringify(old)))tests.set(test.id,test);}
  out.tests=[...tests.values()].sort(compareTests).slice(-20);
  return validateLearningProgress(out,now);
}
export function resetLearningProgress(saved,now=Date.now()){
  const current=validateLearningProgress(saved,now);
  if(current.generation===Number.MAX_SAFE_INTEGER)throw new LearningProgressError(409,'Learning progress cannot be reset again.');
  return {...emptyLearningProgress(current.generation+1),updatedAt:now};
}
