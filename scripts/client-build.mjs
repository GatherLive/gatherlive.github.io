import {build, transform} from 'esbuild';
import {cp, mkdir, readFile, readdir, stat} from 'node:fs/promises';
import {resolve, relative, extname} from 'node:path';
import {projectRoot} from './config.mjs';

export const clientRoot = resolve(projectRoot, 'src/client');
const avatarModules = 'features/avatars/providers';
const avatarRoot = resolve(clientRoot, avatarModules);
const avatarEntry = resolve(avatarRoot, 'browser.ts');
const avatarLicenses = {
  'DiceBear.txt': '@dicebear/core/LICENSE',
  'DiceBear-styles.md': '@dicebear/styles/LICENSE.md',
  'Multiavatar.txt': '@multiavatar/multiavatar/LICENSE',
  'Boring-Avatars.txt': 'boring-avatars/LICENSE',
  'React.txt': 'react/LICENSE',
  'React-DOM.txt': 'react-dom/LICENSE'
};

function buildAvatarProviders(outdir, write = true) {
  return build({
    entryPoints: [avatarEntry], outbase: clientRoot, outdir,
    format: 'esm', platform: 'browser', target: 'es2022', bundle: true, splitting: true,
    chunkNames: `${avatarModules}/parts/[name]-[hash]`,
    // Some npm entrypoints use NODE_ENV to select their browser-compatible production code.
    define: {'process.env.NODE_ENV': '"production"'}, minify: true, legalComments: 'inline',
    logLevel: 'warning', write
  });
}

let developmentAvatars;
async function developmentAvatarAsset(name) {
  const outdir = resolve(projectRoot, '.local/avatar-assets');
  const sources = [...await clientFiles(avatarRoot), resolve(projectRoot, 'src/shared/avatars/profile.ts')];
  const revision = (await Promise.all(sources.map(source => stat(source)))).map(info => info.mtimeMs).join(':');
  if (developmentAvatars?.revision !== revision) {
    const assets = buildAvatarProviders(outdir, false).then(result => new Map(result.outputFiles.map(file =>
      [relative(outdir, file.path), file.text])));
    developmentAvatars = {revision, assets};
  }
  try { return (await developmentAvatars.assets).get(name) ?? null; }
  catch (error) { developmentAvatars = null; throw error; }
}

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
    entryPoints: files.filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.startsWith(avatarRoot + '/')),
    outdir: output,
    outbase: clientRoot,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    bundle: false,
    logLevel: 'warning'
  });
  await buildAvatarProviders(output);
  const licenseDirectory = resolve(output, avatarModules, 'licenses');
  await mkdir(licenseDirectory, {recursive: true});
  await Promise.all(Object.entries(avatarLicenses).map(([filename, source]) =>
    cp(resolve(projectRoot, 'node_modules', source), resolve(licenseDirectory, filename))));
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
  if (name.startsWith(avatarModules + '/')) {
    const file = name.slice(avatarModules.length + 1);
    return /^(?:browser|parts\/[a-z\d.-]+)\.js$/i.test(file) ? developmentAvatarAsset(name) : null;
  }
  const path = resolve(clientRoot, name.replace(/\.js$/, '.ts'));
  if (!path.startsWith(clientRoot + '/')) return null;
  let source;
  try { source = await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (name.endsWith('.css')) return source;
  return (await transform(source, {loader: 'ts', format: 'esm', target: 'es2022', sourcefile: name})).code;
}
