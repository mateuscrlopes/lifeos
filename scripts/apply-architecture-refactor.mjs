import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content, 'utf8'); }

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Trecho esperado não encontrado: ${label}`);
  return source.replace(search, replacement);
}

const ritmoPath = 'public/ritmo.js';
let ritmo = read(ritmoPath);

ritmo = replaceRequired(
  ritmo,
  'return `<button class="ritmo-tab ${R.aba === id ? \'is-active\' : \'\'}" data-ritmo-tab="${id}">${nome}</button>`;',
  'return `<button type="button" class="ritmo-tab ${R.aba === id ? \'is-active\' : \'\'}" data-ritmo-tab="${id}">${nome}</button>`;',
  'tipo explícito das abas do Ritmo',
);

ritmo = replaceRequired(
  ritmo,
  `  function ligarEventos() {\n    document.querySelectorAll('[data-ritmo-tab]').forEach(b => b.addEventListener('click', () => {\n      R.aba = b.dataset.ritmoTab;\n      render();\n    }));\n    document.querySelectorAll('[data-ritmo-go]').forEach(b => b.addEventListener('click', () => {\n      R.aba = b.dataset.ritmoGo;\n      render();\n    }));`,
  `  function navegarRitmo(aba) {\n    if (!aba) return;\n    R.aba = aba;\n    render();\n    const body = el('appBody');\n    if (body) {\n      body.scrollTop = 0;\n      requestAnimationFrame(() => { body.scrollTop = 0; });\n    }\n  }\n\n  function ligarEventos() {\n    document.querySelectorAll('[data-ritmo-tab]').forEach(b => b.addEventListener('click', () => navegarRitmo(b.dataset.ritmoTab)));\n    document.querySelectorAll('[data-ritmo-go]').forEach(b => b.addEventListener('click', () => navegarRitmo(b.dataset.ritmoGo)));`,
  'navegação interna do Ritmo',
);

ritmo = replaceRequired(
  ritmo,
  `    el('ritmoNovaAtividade')?.addEventListener('click', abrirNovaAtividade);\n    el('ritmoNovaMedida')?.addEventListener('click', abrirNovaMedida);`,
  `    el('ritmoNovaAtividade')?.addEventListener('click', () => abrirNovaAtividade(null));\n    el('ritmoNovaMedida')?.addEventListener('click', () => abrirNovaMedida(null));`,
  'handlers de criação do Ritmo',
);

ritmo = replaceRequired(
  ritmo,
  `    conteudo.innerHTML = html;\n    modal.hidden = false;\n    conteudo.querySelectorAll('[data-fechar-ritmo]')`,
  `    conteudo.innerHTML = html;\n    modal.hidden = false;\n    document.body.classList.add('lifeos-modal-open');\n    conteudo.querySelectorAll('[data-fechar-ritmo]')`,
  'abertura segura do modal do Ritmo',
);

ritmo = replaceRequired(
  ritmo,
  `  function solicitarFecharModal() {\n    if (ritmoModalDirty && !confirm('Deseja sair sem salvar as alterações?')) return;\n    fecharModal();\n  }`,
  `  async function solicitarFecharModal() {\n    if (ritmoModalDirty) {\n      const sair = typeof window.lifeosConfirmAction === 'function'\n        ? await window.lifeosConfirmAction({\n            title: 'Sair sem salvar?',\n            message: 'As alterações feitas neste formulário serão descartadas.',\n            confirmLabel: 'Sair sem salvar',\n            danger: true,\n          })\n        : confirm('Deseja sair sem salvar as alterações?');\n      if (!sair) return;\n    }\n    fecharModal();\n  }`,
  'confirmação de fechamento do modal do Ritmo',
);

ritmo = replaceRequired(
  ritmo,
  `    if (modal) {\n      modal.hidden = true;\n      modal.onclick = null;\n    }\n  }`,
  `    if (modal) {\n      modal.hidden = true;\n      modal.onclick = null;\n    }\n    if (conteudo) conteudo.innerHTML = '';\n    document.body.classList.remove('lifeos-modal-open');\n  }`,
  'limpeza do modal do Ritmo',
);

write(ritmoPath, ritmo);

if (fs.existsSync('public/ritmo-medidas-save.js')) fs.unlinkSync('public/ritmo-medidas-save.js');

const loaderTests = [
  'test/confiabilidade-painel.test.js',
  'test/alimentacao-contextual.test.js',
  'test/ritmo-food-v2.test.js',
  'test/brand-tablet-grid-v7.test.js',
  'test/phase3-telas.test.js',
  'test/auditoria-qa-ui.test.js',
  'test/product-polish-v4.test.js',
  'test/alimentacao-contextual-mobile-fix.test.js',
  'test/phase4-polimento.test.js',
  'test/mobile-qa-v5-1.test.js',
  'test/mobile-shell-v3.test.js',
  'test/mobile-qa-v5.test.js',
];

for (const path of loaderTests) {
  if (!fs.existsSync(path)) continue;
  const before = read(path);
  const after = before.replaceAll("read('public/status-estoque.js')", "read('public/app-bootstrap.js')")
    .replaceAll("ler('public/status-estoque.js')", "ler('public/app-bootstrap.js')");
  write(path, after);
}

write('test/ritmo-medidas-save.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst read = file => fs.readFileSync(file, 'utf8');\n\ntest('Ritmo é o único dono da criação e edição de medidas', () => {\n  const js = read('public/ritmo.js');\n  const bootstrap = read('public/app-bootstrap.js');\n  assert.match(js, /ritmoNovaMedida'\\)\\?\\.addEventListener\\('click', \\(\\) => abrirNovaMedida\\(null\\)\\)/);\n  assert.match(js, /data-editar-medida[\\s\\S]*abrirNovaMedida\\(R\\.medidas\\.find/);\n  assert.doesNotMatch(bootstrap, /ritmo-medidas-save/);\n  assert.equal(fs.existsSync('public/ritmo-medidas-save.js'), false);\n});\n\ntest('criação de atividade também não recebe MouseEvent como plano', () => {\n  const js = read('public/ritmo.js');\n  assert.match(js, /ritmoNovaAtividade'\\)\\?\\.addEventListener\\('click', \\(\\) => abrirNovaAtividade\\(null\\)\\)/);\n});\n\ntest('persistência de medidas continua no módulo proprietário', () => {\n  const js = read('public/ritmo.js');\n  assert.match(js, /from\\('ritmo_medidas'\\)/);\n  assert.match(js, /\\.update\\(payload\\)\\.eq\\('id', medida\\.id\\)/);\n  assert.match(js, /upsert\\(payload, \\{ onConflict: 'usuario_id,data' \\}\\)/);\n});\n\ntest('troca de área do Ritmo reinicia a rolagem da viewport', () => {\n  const js = read('public/ritmo.js');\n  assert.match(js, /function navegarRitmo\\(aba\\)/);\n  assert.match(js, /body\\.scrollTop = 0/);\n  assert.match(js, /data-ritmo-tab[\\s\\S]*navegarRitmo\\(b\\.dataset\\.ritmoTab\\)/);\n  assert.match(js, /data-ritmo-go[\\s\\S]*navegarRitmo\\(b\\.dataset\\.ritmoGo\\)/);\n});\n\ntest('modal do Ritmo sempre libera a interface ao fechar', () => {\n  const js = read('public/ritmo.js');\n  assert.match(js, /document\\.body\\.classList\\.add\\('lifeos-modal-open'\\)/);\n  assert.match(js, /document\\.body\\.classList\\.remove\\('lifeos-modal-open'\\)/);\n  assert.match(js, /if \\(conteudo\\) conteudo\\.innerHTML = ''/);\n  assert.match(js, /window\\.lifeosConfirmAction/);\n});\n\ntest('assets web continuam sem cache persistente de código', () => {\n  const server = read('src/server.js');\n  assert.match(server, /Cache-Control', 'no-cache, must-revalidate'/);\n});\n`);

const validarPath = 'scripts/validar.js';
let validar = read(validarPath);
validar = replaceRequired(
  validar,
  "const arquivos = ['public/app.js'",
  "const arquivos = ['public/app-bootstrap.js', 'public/ui/icons.js', 'public/ui/toast.js', 'public/ui/confirm.js', 'public/ui/modal.js', 'public/ui/index.js', 'public/app.js'",
  'lista de validação sintática',
);
write(validarPath, validar);

for (const path of ['scripts/apply-architecture-refactor.mjs', '.github/workflows/architecture-refactor.yml']) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

console.log('Consolidação estrutural aplicada com sucesso.');
