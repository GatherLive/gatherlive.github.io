import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {setDefaultResultOrder} from 'node:dns';
import {loadConfig} from './config.mjs';
setDefaultResultOrder('ipv4first');
const runtime=await loadConfig();
const apiUrl=(runtime.PUBLIC_API_URL||'').replace(/\/$/,'');
if(process.env.GITHUB_ACTIONS==='true'&&!apiUrl)throw new Error('Set the PUBLIC_API_URL repository variable before publishing.');
const browserConfig={apiUrl,supabaseUrl:'',supabaseKey:'',turnstileSiteKey:'0x4AAAAAAFqm15jtYVtkHupb'};
if(apiUrl){
  const endpoint=new URL(apiUrl);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw new Error('PUBLIC_API_URL must be a public HTTPS URL.');
  const response=await fetch(apiUrl+'/api/config',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Could not load the public backend settings.');
  const settings=await response.json();
  if(typeof settings.supabaseUrl!=='string'||!settings.supabaseUrl.startsWith('https://')||typeof settings.supabaseKey!=='string'||!settings.supabaseKey)throw new Error('The backend public settings are incomplete.');
  if(settings.supabaseKey.startsWith('sb_secret_'))throw new Error('A server secret must never be included in the frontend.');
  if(settings.supabaseKey.startsWith('eyJ')){
    let claims;try{claims=JSON.parse(Buffer.from(settings.supabaseKey.split('.')[1],'base64url').toString());}catch{throw new Error('Invalid public Supabase key.');}
    if(claims.role!=='anon')throw new Error('Only a public anonymous Supabase key may be included in the frontend.');
  }else if(!settings.supabaseKey.startsWith('sb_publishable_'))throw new Error('Use a Supabase publishable key.');
  Object.assign(browserConfig,{supabaseUrl:settings.supabaseUrl,supabaseKey:settings.supabaseKey});
}
const output=resolve('dist');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(resolve('public'),output,{recursive:true});
await writeFile(resolve(output,'config.js'),`window.GATHER_CONFIG = ${JSON.stringify(browserConfig,null,2)};\n`);
async function filesIn(directory,prefix=''){
  const files=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const name=prefix+entry.name,path=resolve(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesIn(path,name+'/'));
    else if(entry.isFile())files.push(name);
  }
  return files;
}
// Ship one shared stylesheet while keeping editable component styles separate.
async function inlineStyles(name,stack=[]){
  if(stack.includes(name))throw new Error('Circular stylesheet import: '+name);
  const source=await readFile(resolve(output,name),'utf8');
  const imports=[...source.matchAll(/@import\s+(?:url\(\s*)?['"](\.[^'"]+\.css)['"]\s*\)?\s*;/g)];
  let combined='',offset=0;
  for(const match of imports){
    combined+=rebaseStyles(source.slice(offset,match.index),name);
    const target=posix.normalize(posix.join(posix.dirname(name),match[1]));
    if(target.startsWith('../')||target.startsWith('/'))throw new Error('Stylesheet import leaves public assets.');
    combined+=await inlineStyles(target,[...stack,name]);offset=match.index+match[0].length;
  }
  return combined+rebaseStyles(source.slice(offset),name);
}
function rebaseStyles(source,name){
  return source.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(match,quote,url)=>{
    if(/^(?:[a-z]+:|\/|#)/i.test(url))return match;
    const target=posix.normalize(posix.join(posix.dirname(name),url));
    return 'url('+quote+'./'+target+quote+')';
  });
}
await writeFile(resolve(output,'styles.css'),await inlineStyles('styles.css'));
const files=await filesIn(output),digest=createHash('sha256');
for(const name of files)digest.update(name).update(await readFile(resolve(output,name)));
const revision=digest.digest('hex').slice(0,16);
for(const name of files.filter(name=>/\.(?:js|css|html)$/.test(name)&&!name.startsWith('vendor/'))){
  let source=await readFile(resolve(output,name),'utf8');
  // Version every relative module and stylesheet, including nested feature imports.
  source=source.replace(/(['"])(\.\.?\/[A-Za-z0-9_./-]+\.(?:js|css|json))\1/g,(_,quote,path)=>quote+path+'?v='+revision+quote);
  if(name.endsWith('.css'))source=source.replace(/url\((['"]?)(\.\.?\/[^)'"?]+\.css)\1\)/g,(_,quote,path)=>'url('+quote+path+'?v='+revision+quote+')');
  if(name==='index.html')source=source.replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css))"/g,'$1?v='+revision+'"').replace('</head>',`  <meta name="gather-release" content="${revision}">\n</head>`);
  await writeFile(resolve(output,name),source);
}
// Preserve URLs used by already-open tabs; compatibility files are build output only.
const legacy=JSON.parse(await readFile('scripts/legacy-assets.json','utf8'));
for(const [previous,current]of Object.entries(legacy)){
  if(previous.endsWith('.js'))await writeFile(resolve(output,previous),`export * from './${current}?v=${revision}';\n`);
  else if(previous.endsWith('.css'))await writeFile(resolve(output,previous),`@import url('./${current}?v=${revision}');\n`);
  else await cp(resolve(output,current),resolve(output,previous));
}
await writeFile(resolve(output,'.nojekyll'),'');
console.log('Built dist/ for GitHub Pages.');
