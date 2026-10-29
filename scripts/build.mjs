import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setDefaultResultOrder} from 'node:dns';
import {loadConfig} from './config.mjs';
setDefaultResultOrder('ipv4first');
const runtime=await loadConfig();
const apiUrl=(runtime.PUBLIC_API_URL || '').replace(/\/$/,'');
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
  let claims;
  try{claims=JSON.parse(Buffer.from(settings.supabaseKey.split('.')[1],'base64url').toString());}catch{throw new Error('Invalid public Supabase key.');}
  if(claims.role!=='anon')throw new Error('Only a public anonymous Supabase key may be included in the frontend.');
 }else if(!settings.supabaseKey.startsWith('sb_publishable_'))throw new Error('Use a Supabase publishable key.');
 Object.assign(browserConfig,{supabaseUrl:settings.supabaseUrl,supabaseKey:settings.supabaseKey});
}
const output=resolve('dist');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(resolve('public'),output,{recursive:true});
// These settings are already public on the backend. Secrets never enter the build.
// Embedding them avoids startup API requests for every visitor to the static site.
await writeFile(resolve(output,'config.js'),`window.GATHER_CONFIG = ${JSON.stringify(browserConfig,null,2)};\n`);
// One content version covers the entrypoints and every imported browser module.
// A fresh HTML page therefore cannot combine a new entrypoint with cached modules.
const assets=(await readdir(output)).filter(name=>/\.(?:js|css|html)$/.test(name)).sort();
const digest=createHash('sha256');
for(const name of assets)digest.update(name).update(await readFile(resolve(output,name)));
// A data or flag update must invalidate the lazy learning library as well.
async function hashLearning(directory,prefix='learn-data'){
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=prefix+'/'+entry.name,path=resolve(directory,entry.name);
  if(entry.isDirectory())await hashLearning(path,name);
  else if(entry.isFile())digest.update(name).update(await readFile(path));
 }
}
await hashLearning(resolve(output,'learn-data'));
const revision=digest.digest('hex').slice(0,16);
for(const name of assets){
 let source=await readFile(resolve(output,name),'utf8');
 if(name.endsWith('.js'))source=source.replace(/(['"])(\.\/[A-Za-z0-9_./-]+\.(?:js|css|json))\1/g,(_match,quote,path)=>quote+path+'?v='+revision+quote);
 if(name==='index.html')source=source.replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css))"/g,'$1?v='+revision+'"').replace('</head>',`  <meta name="gather-release" content="${revision}">\n</head>`);
 await writeFile(resolve(output,name),source);
}
await writeFile(resolve(output,'.nojekyll'),'');
console.log('Built dist/ for GitHub Pages.');
