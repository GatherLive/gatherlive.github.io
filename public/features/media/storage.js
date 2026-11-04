// Ciphertext only: this store never receives image keys, answers or plaintext.
const MAX_BYTES=48*1024*1024,MAX_AGE=86400000;
let database;
function open(){
  if(!globalThis.indexedDB)return Promise.resolve(null);
  database??=new Promise(resolve=>{
    try{
      const request=indexedDB.open('gather-encrypted-images',2);let unavailable=false;
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('downloads'))db.createObjectStore('downloads',{keyPath:'id'});else request.transaction.objectStore('downloads').clear();if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata',{keyPath:'id'});};
      request.onsuccess=()=>{const db=request.result;if(unavailable){db.close();return;}db.onversionchange=()=>{db.close();database=null;};resolve(db);};
      request.onerror=request.onblocked=()=>{unavailable=true;resolve(null);};
    }catch{resolve(null);}
  });
  return database;
}
export async function readImageDownload(id){
  const db=await open();if(!db)return null;
  return new Promise(resolve=>{try{const request=db.transaction('downloads').objectStore('downloads').get(id);request.onsuccess=()=>{const value=request.result;resolve(value&&Date.now()-value.at<MAX_AGE&&value.bytes instanceof Uint8Array?value:null);};request.onerror=()=>resolve(null);}catch{resolve(null);}});
}
export async function saveImageDownload(id,value){
  const db=await open();if(!db||!value.bytes?.byteLength)return;
  await new Promise(resolve=>{try{
    const tx=db.transaction(['downloads','metadata'],'readwrite'),store=tx.objectStore('downloads'),metadata=tx.objectStore('metadata');
    store.put({id,at:Date.now(),etag:value.etag||'',total:value.total||0,bytes:value.bytes});
    metadata.put({id,at:Date.now(),size:value.bytes.byteLength});
    const request=metadata.getAll();request.onsuccess=()=>{const rows=request.result.sort((a,b)=>b.at-a.at);let size=0;for(const row of rows){size+=row.size;if(size>MAX_BYTES||Date.now()-row.at>=MAX_AGE){store.delete(row.id);metadata.delete(row.id);}}};
    tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();
  }catch{resolve();}});
}
export async function deleteImageDownload(id){
  const db=await open();if(!db)return;
  await new Promise(resolve=>{try{const tx=db.transaction(['downloads','metadata'],'readwrite');tx.objectStore('downloads').delete(id);tx.objectStore('metadata').delete(id);tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});
}
