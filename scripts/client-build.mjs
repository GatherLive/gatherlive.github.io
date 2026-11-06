import {build, transform} from 'esbuild';
import {cp, mkdir, readFile, readdir} from 'node:fs/promises';
import {resolve, relative, extname} from 'node:path';
import {projectRoot} from './config.mjs';

export const clientRoot = resolve(projectRoot, 'src/client');

async function clientFiles(directory = clientRoot) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await clientFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

// Preserve public module URLs and lazy loading; TypeScript stays in src/.
export async function buildClient(output) {
  const files = await clientFiles();
  await build({
    entryPoints: files.filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts')),
    outdir: output,
    outbase: clientRoot,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    bundle: false,
    logLevel: 'warning'
  });
  for (const path of files.filter(file => extname(file) === '.css')) {
    const target = resolve(output, relative(clientRoot, path));
    await mkdir(resolve(target, '..'), {recursive: true});
    await cp(path, target);
  }
}

// Transform the requested module in development so edits appear on refresh.
export async function clientAsset(pathname) {
  const name = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (!/\.(?:js|css)$/.test(name)) return null;
  const path = resolve(clientRoot, name.replace(/\.js$/, '.ts'));
  if (!path.startsWith(clientRoot + '/')) return null;
  let source;
  try { source = await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (name.endsWith('.css')) return source;
  return (await transform(source, {loader: 'ts', format: 'esm', target: 'es2022', sourcefile: name})).code;
}
