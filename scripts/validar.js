import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const arquivos = ['public/app.js', 'public/contas.js', 'public/plantas.js', 'public/tablet-enhancements.js', 'public/acertos.js', 'public/theme.js', 'public/mobile-shell-v3.js', 'public/product-polish-v4.js', 'src/acertos.js', 'src/financeiro-extracao.js', 'src/integracao-nordestrip.js'];

function verificarSintaxe(arquivo, input) {
  const resultado = spawnSync(process.execPath, ['--check', arquivo || '-'], {
    encoding: 'utf8',
    input,
  });
  if (resultado.status !== 0) {
    throw new Error(resultado.stderr || `Falha ao validar ${arquivo || 'script inline'}.`);
  }
}

for (const arquivo of arquivos) verificarSintaxe(arquivo);

const tablet = await readFile('public/tablet.html', 'utf8');
const scripts = [...tablet.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const scriptPrincipal = scripts.at(-1)?.[1];
if (!scriptPrincipal) throw new Error('Script principal do tablet não encontrado.');
verificarSintaxe(null, scriptPrincipal);

console.log('Validação sintática concluída.');
