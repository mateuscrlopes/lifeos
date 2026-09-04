import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`Nenhuma alteração aplicada em ${path}`);
  fs.writeFileSync(path, after, 'utf8');
}

edit('test/acertos-financeiros.test.js', source => source.replace(
`test('interface carrega acertos e tema', () => {\n  const status = fs.readFileSync(new URL('../public/status-estoque.js', import.meta.url), 'utf8');\n  assert.match(status, /acertos\\.js\\?v=5/);\n  assert.match(status, /theme\\.js\\?v=1/);\n});`,
`test('interface carrega acertos e tema pelo bootstrap', () => {\n  const bootstrap = fs.readFileSync(new URL('../public/app-bootstrap.js', import.meta.url), 'utf8');\n  assert.match(bootstrap, /acertos\\.js\\?v=5/);\n  assert.match(bootstrap, /theme\\.js\\?v=1/);\n});`
));

edit('test/auditoria-qa-ui.test.js', source => source
  .replace("  assert.match(html, /app\\.js\\?v=13/);", "  assert.match(html, /app-bootstrap\\.js\\?v=1/);\n  assert.match(status, /app\\.js\\?v=14/);")
);

edit('test/phase3-telas.test.js', source => source
  .replace(`status.indexOf("import './product-polish-v4.js?v=4'")`, `status.indexOf('./product-polish-v4.js?v=4')`)
  .replace(`status.indexOf("import './phase3-polish.js?v=1'")`, `status.indexOf('./phase3-polish.js?v=1')`)
);

edit('test/phase4-polimento.test.js', source => source
  .replace(`loader.indexOf("import './phase3-polish.js?v=1'")`, `loader.indexOf('./phase3-polish.js?v=1')`)
  .replace(`loader.indexOf("import './phase4-polish.js?v=1'")`, `loader.indexOf('./phase4-polish.js?v=1')`)
);

console.log('Contratos do bootstrap atualizados.');
