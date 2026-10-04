import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve('.');
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(resolve(directory, e.name)) : [resolve(directory, e.name)],
      ),
    )
  ).flat();
}
const files = [
  ...(await walk(resolve('dist'))),
  ...(await walk(resolve('scripts'))),
  ...(await walk(resolve('tests'))),
];
let modules = 0,
  links = 0;
const errors = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (/\.(m?js)$/.test(file)) {
    modules++;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) errors.push(result.stderr);
    for (const match of text.matchAll(/(?:from\s*|import\s*\(?)["'](\.[^"']+)["']/g)) {
      const path = resolve(dirname(file), match[1].split('?')[0]);
      try {
        await stat(path);
        links++;
      } catch {
        errors.push(`${relative(root, file)} imports missing ${match[1]}`);
      }
    }
  }
  if (file.endsWith('.css'))
    for (const match of text.matchAll(/url\(['"]?(\.[^)'"\s]+)['"]?\)/g)) {
      try {
        await stat(resolve(dirname(file), match[1]));
        links++;
      } catch {
        errors.push(`${relative(root, file)} references missing ${match[1]}`);
      }
    }
}
const html = await readFile('dist/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.[^"]+)"/g)) {
  try {
    await stat(resolve('dist', match[1]));
    links++;
  } catch {
    errors.push('Missing entry asset: ' + match[1]);
  }
}
for (const folder of await readdir('dist/packages')) {
  const pkg = JSON.parse(await readFile(`dist/packages/${folder}/package.json`, 'utf8'));
  if (pkg.name !== `@millennium/${folder}`) errors.push('Invalid package name: ' + folder);
  await stat(resolve('dist/packages', folder, pkg.exports['.']));
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${modules} JavaScript modules, ${links} local references, and 10 package entry points.`,
  );
