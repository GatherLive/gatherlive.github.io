import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function parseEnv(source){
  const result={};
  for(const line of source.split(/\r?\n/)){
    const match=line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!match)continue;
    let value=match[2];
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    else value=value.replace(/\s+#.*$/,'').trim();
    result[match[1]]=value;
  }
  return result;
}
export async function loadConfig(){
  let local={},file={};
  try{local=JSON.parse(await readFile(resolve(projectRoot,'.local/config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  try{file=parseEnv(await readFile(resolve(projectRoot,'.env'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  return {...local,...file,...Object.fromEntries(Object.entries(process.env).filter(([,value])=>value!==undefined))};
}
