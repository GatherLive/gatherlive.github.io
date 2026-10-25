import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadConfig,projectRoot} from './config.mjs';
import {configuredChatCodes} from '../shared/chat-access.js';
const runtime=await loadConfig();
const template=JSON.parse(await readFile(resolve(projectRoot,'wrangler.jsonc'),'utf8'));
for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])if(!runtime[key])throw new Error(`Set ${key} in .env before deploying.`);
const config={...template,main:resolve(projectRoot,'worker/index.js'),$schema:resolve(projectRoot,'node_modules/wrangler/config-schema.json'),name:runtime.GATHER_WORKER_NAME || template.name};
if(runtime.CLOUDFLARE_ACCOUNT_ID)config.account_id=runtime.CLOUDFLARE_ACCOUNT_ID;
config.vars={SUPABASE_URL:runtime.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:runtime.SUPABASE_PUBLISHABLE_KEY,ALLOWED_ORIGINS:runtime.ALLOWED_ORIGINS || template.vars.ALLOWED_ORIGINS};
await mkdir(resolve(projectRoot,'.local'),{recursive:true,mode:0o700});
const executable=process.env.WRANGLER_BIN || 'wrangler',flags=process.argv.slice(2);
const hasChatSecrets=!!(runtime.CHAT_CODE_PEPPER||runtime.CHAT_CODE_HASHES);
if(hasChatSecrets&&(!/^[a-f0-9]{64}$/.test(runtime.CHAT_CODE_PEPPER||'')||!configuredChatCodes(runtime).length))throw new Error('Configure both private chat activation secrets before deploying.');
const preview=flags.some(flag=>flag==='--dry-run'||flag.startsWith('--dry-run=')||['--help','-h','--version'].includes(flag));
async function deploy(value,name){
 const path=resolve(projectRoot,'.local',name);
 await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
 const result=spawnSync(executable,['deploy','--config',path,...flags],{stdio:'inherit',cwd:projectRoot,env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status || 1);
 if(hasChatSecrets&&!preview){
  const secrets=JSON.stringify({CHAT_CODE_PEPPER:runtime.CHAT_CODE_PEPPER,CHAT_CODE_HASHES:runtime.CHAT_CODE_HASHES});
  const uploaded=spawnSync(executable,['secret','bulk','--config',path],{input:secrets,stdio:['pipe','inherit','inherit'],cwd:projectRoot,env:process.env});
  if(uploaded.error)throw uploaded.error;
  if(uploaded.status!==0)process.exit(uploaded.status || 1);
 }
}
if(runtime.GATHER_DO_SCRIPT && runtime.GATHER_DO_SCRIPT!==config.name){
 // Keep reused room storage and its implementation current when renaming an API.
 await deploy({...config,name:runtime.GATHER_DO_SCRIPT},'wrangler.storage.json');
 config.durable_objects={bindings:config.durable_objects.bindings.map(binding=>({...binding,script_name:runtime.GATHER_DO_SCRIPT}))};
 delete config.migrations;
}
await deploy(config,'wrangler.deploy.json');
