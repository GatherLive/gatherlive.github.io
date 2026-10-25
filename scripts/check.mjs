import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const directory of ['public','shared','worker','scripts']){
 for(const name of await readdir(directory)){
  if(!/\.(?:js|mjs)$/.test(name))continue;
  const result=spawnSync(process.execPath,['--check',`${directory}/${name}`],{stdio:'inherit'});
  if(result.status)process.exit(result.status);
 }
}
const html=await readFile('public/index.html','utf8');
for(const path of ['app.js','styles.css','config.js'])if(!html.includes(path))throw new Error(`Missing frontend asset: ${path}`);
console.log('All JavaScript syntax and entrypoint checks passed.');
