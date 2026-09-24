import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const files = ['dist/app.js','dist/config.js','api/consulta.js','lib/ibpt.mjs'];
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
const html = await readFile('dist/index.html', 'utf8');
for (const [,path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) await access('dist/' + path.split('?')[0]);
const publicFiles = await Promise.all(['dist/app.js','dist/config.js','dist/index.html'].map(f => readFile(f,'utf8')));
if (publicFiles.some(s => /token\s*[:=]\s*['"][^'"]+['"]/i.test(s))) throw new Error('Não coloque credenciais em arquivos públicos.');
console.log('Arquivos e referências conferidos. A consulta autenticada ao IBPT exige configuração.');

