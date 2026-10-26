import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadConfig,projectRoot} from './config.mjs';
const ignored=new Set(['node_modules','.git','.local','.wrangler','dist','__pycache__','test-results','playwright-report','tests','supabase']);
const binary=/\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|zip|pdf|mp4)$/i;
const ignoredFile=name=>/^run\/(?:publish\.mjs|chat-codes\.mjs|README\.md)$/.test(name)||['AGENTS.md','agent.md','SECURITY.md','VALIDATION.md','scripts/export-source.mjs'].includes(name)||/^scripts\/test-[^/]+\.mjs$/.test(name)||name==='worker/env.d.ts'||(/(^|\/)\.env(?:\.|$)/.test(name)&&name!=='.env.example')||/(^|\/)\.dev\.vars(?:\.|$)/.test(name)||/\.(?:log|pem|key|p12|db|sqlite3?|har)$/.test(name);
// Include the documented .env setup and environment overrides as well as the
// ignored local checkout settings. Never print the values being checked.
const configured=await loadConfig();
const privateValues=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ACCESS_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','GATHER_DO_SCRIPT','PUBLIC_API_URL','CHAT_CODE_PEPPER','CHAT_CODE_HASHES'].map(key=>configured[key]).filter(value=>typeof value==='string'&&value.length>=12&&!/YOUR_|REPLACE_|EXAMPLE_/i.test(value));
try{for(const code of (await readFile(resolve(projectRoot,'.local/chat-access-codes.txt'),'utf8')).split(/\s+/))if(/^\d{12}$/.test(code))privateValues.push(code);}catch(error){if(error.code!=='ENOENT')throw error;}
try{for(const hash of JSON.parse(configured.CHAT_CODE_HASHES||'[]'))if(typeof hash==='string'&&hash.length===64)privateValues.push(hash);}catch{}
const projectId=configured.SUPABASE_URL?.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1];if(projectId)privateValues.push(projectId);
const patterns=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{24,}\b/,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}\b/,
  /\bsk_(?:live|prod)_[A-Za-z0-9]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /https:\/\/[a-z0-9]{20}\.supabase\.co\b/i,
];
const exampleDomain=domain=>/^(?:localhost|(?:[^.]+\.)*(?:example\.(?:com|org|net|test|invalid)|test\.invalid))$/i.test(domain);
function identifyingLiterals(source){
  const emails=source.matchAll(/\b[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g);
  for(const [,domain]of emails)if(!exampleDomain(domain))return true;
  const workers=source.matchAll(/https?:\/\/([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev\b/gi);
  for(const [,worker,account]of workers)if(!/^(?:example|fixture|test|your-worker)$/i.test(worker)&&!/^(?:example|fixture|test|your-subdomain)$/i.test(account))return true;
  return false;
}
const failures=[];
const exclusions=spawnSync('git',['ls-files','--others','--ignored','--exclude-standard','--directory','-z'],{cwd:projectRoot,encoding:'utf8'});
if(exclusions.status!==0)throw new Error('Could not verify local source exclusions.');
const excludedDirectories=new Set(exclusions.stdout.split('\0').filter(name=>name.endsWith('/')).map(name=>name.slice(0,-1)));
// Ignored local files must never enter the public Git index, even if force-added.
const tracked=spawnSync('git',['ls-files','--cached','-z'],{cwd:projectRoot,encoding:'utf8'});
if(tracked.status!==0)throw new Error('Could not verify the public Git index.');
{
 const ignoredTracked=spawnSync('git',['check-ignore','--no-index','--stdin','-z'],{cwd:projectRoot,input:tracked.stdout,encoding:'utf8'});
 if(ignoredTracked.status!==0&&ignoredTracked.status!==1)throw new Error('Could not verify tracked-file exclusions.');
 failures.push(...ignoredTracked.stdout.split('\0').filter(Boolean));
 for(const name of tracked.stdout.split('\0').filter(Boolean)){
  if(/^(?:tests|supabase|\.local|dist|node_modules)\//.test(name)||/(?:^|\/)chat-(?:access-)?codes[^/]*\.txt$/i.test(name)||ignoredFile(name))failures.push(name);
 }
}

async function scan(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(ignored.has(entry.name))continue;
  const path=resolve(directory,entry.name),name=relative(projectRoot,path).replaceAll('\\','/');
  if(entry.isSymbolicLink())continue;
  if(entry.isDirectory()){if(!excludedDirectories.has(name))await scan(path);continue;}
  if(ignoredFile(name)||binary.test(name))continue;
  if((await stat(path)).size>2_000_000)continue;
  const source=await readFile(path,'utf8');
  if(privateValues.some(value=>source.includes(value))||patterns.some(pattern=>pattern.test(source))||identifyingLiterals(source))failures.push(name);
 }
}
await scan(projectRoot);
if(failures.length){console.error('Private configuration found in publishable files:\n'+failures.join('\n'));process.exit(1);}
console.log('Publishable source contains no detected private configuration or credentials.');
