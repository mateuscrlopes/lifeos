import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('X de fechar nunca é inferido como lixeira', () => {
  const ui = read('../public/ui-refinements.js');
  const acertos = read('../public/acertos.js');

  assert.match(ui, /explicitAction === 'delete'/);
  assert.match(ui, /Um X sem semântica explícita é tratado como fechar/);
  assert.doesNotMatch(ui, /\(label === '×' \|\| label === '✕'\)[\s\S]{0,260}classList\.add\([^)]*ui-delete/);
  assert.match(acertos, /data-ac-close data-ui-action="close" aria-label="Fechar"/);
});

test('ações destrutivas legadas declaram a semântica explicitamente', () => {
  const app = read('../public/app.js');
  assert.match(app, /btnDelL\.dataset\.uiAction='delete'/);
  assert.match(app, /btnDelE\.dataset\.uiAction='delete'/);
});

test('recorrências podem ser arquivadas e restauradas sem apagar histórico', () => {
  const sql = read('../db/052_arquivamento_regras_recorrentes.sql');
  const front = read('../public/acertos.js');

  assert.match(sql, /add column if not exists arquivado_em timestamptz/i);
  assert.match(sql, /create or replace function public\.arquivar_regra_acerto/i);
  assert.match(sql, /create or replace function public\.restaurar_regra_acerto/i);
  assert.match(sql, /Acertos já gerados permanecem intactos/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.acerto_regras/i);
  assert.match(front, /data-ac-restore-rule/);
  assert.match(front, /arquivar_regra_acerto/);
  assert.match(front, /restaurar_regra_acerto/);
  assert.match(front, /Acertos já gerados nunca são apagados/);
});

test('modal de Acertos respeita viewport, foco, Escape e descarte de edição', () => {
  const front = read('../public/acertos.js');
  const css = read('../public/acertos.css');

  assert.match(front, /role="dialog" aria-modal="true"/);
  assert.match(front, /window\.visualViewport/);
  assert.match(front, /event\.key === 'Escape'/);
  assert.match(front, /data-ac-confirm-discard="true"/);
  assert.match(front, /Descartar as alterações feitas nesta janela/);
  assert.match(css, /--ac-viewport-height/);
  assert.match(css, /\.ac-sheet-scroll[\s\S]*overflow-y: auto/);
  assert.match(css, /\.ac-sheet-close[\s\S]*width: 44px[\s\S]*height: 44px/);
  assert.match(css, /\.ac-form-actions[\s\S]*position: sticky/);
});

test('divisão automática funciona para qualquer quantidade de moradores', () => {
  const front = read('../public/acertos.js');

  assert.match(front, /const cents = Math\.round\(total \* 100\)/);
  assert.match(front, /Math\.floor\(cents \/ shareInputs\.length\)/);
  assert.match(front, /cents - used/);
  assert.doesNotMatch(front, /if \(shareInputs\.length !== 2\) return/);
});

test('botão de recorrência mantém contraste de ação primária', () => {
  const css = read('../public/acertos.css');

  assert.match(css, /\.ac-recurring-head button[\s\S]*color: #fff;[\s\S]*background: var\(--sage\)/);
  assert.match(css, /\.ac-recurring-head button[\s\S]*min-height: 44px/);
});

test('Acertos usa data civil local em vez de UTC para hoje', () => {
  const front = read('../public/acertos.js');

  assert.match(front, /const localDateKey =/);
  assert.match(front, /getFullYear\(\)/);
  assert.match(front, /getMonth\(\) \+ 1/);
  assert.doesNotMatch(front, /const today = \(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});


test('RLS legado deixa de aceitar acesso global e passa a isolar por Casa', () => {
  const sql = read('../db/053_hardening_rls_legado.sql');

  assert.match(sql, /lifeos_usuario_na_casa\(casa_id\)/);
  assert.match(sql, /usuario_id = public\.lifeos_usuario_atual_id\(\)/);
  assert.match(sql, /public\.refeicao_ingredientes[\s\S]*public\.refeicoes/);
  assert.match(sql, /public\.planta_rotinas[\s\S]*public\.plantas/);
  assert.match(sql, /public\.locais_compra_enderecos[\s\S]*public\.locais_compra/);
  assert.doesNotMatch(sql, /using\s*\(true\)/i);
  assert.doesNotMatch(sql, /with check\s*\(true\)/i);
});

test('sheets compartilhados respeitam foco, Escape e visual viewport', () => {
  const ui = read('../public/ui-refinements.js');
  const css = read('../public/ui-refinements.css');

  assert.match(ui, /uiSheetReturnFocus/);
  assert.match(ui, /event\.key === 'Escape'/);
  assert.match(ui, /window\.visualViewport/);
  assert.match(ui, /data-ui-action="close"/);
  assert.match(css, /--ui-viewport-height/);
  assert.match(css, /button\.ui-primary\[disabled\]/);
});

test('viewport permite zoom e usa viewport dinâmica', () => {
  const mobile = read('../public/index.html');
  const tablet = read('../public/tablet.html');

  assert.doesNotMatch(mobile, /maximum-scale=1\.0/);
  assert.doesNotMatch(tablet, /maximum-scale=1\.0/);
  assert.match(mobile, /viewport-fit=cover/);
  assert.match(tablet, /viewport-fit=cover/);
  assert.match(mobile, /height:100dvh/);
  assert.match(tablet, /height: 100dvh/);
});


test('conteúdo persistido é escapado antes de entrar em templates HTML', () => {
  const app = read('../public/app.js');
  const tablet = read('../public/tablet.html');

  assert.match(app, /const escapeHtml=/);
  assert.match(app, /escapeHtml\(nomeEspecie\)/);
  assert.match(app, /escapeHtml\(projeto\.descricao\)/);
  assert.match(app, /escapeHtml\(e\.endereco\|\|'Sem endereço'\)/);
  assert.match(app, /escapeHtml\(nome\)/);

  assert.match(tablet, /const tabletEscapeHtml/);
  assert.match(tablet, /tabletEscapeHtml\(t\.titulo\)/);
  assert.match(tablet, /tabletEscapeHtml\(c\.nome\)/);
  assert.match(tablet, /tabletEscapeHtml\(p\.especies\?\.nome_popular\|\|p\.codigo\)/);
});

test('tablet e painel da Casa usam data civil local', () => {
  const tablet = read('../public/tablet.html');
  const painel = read('../public/painel-casa-v4.js');

  assert.match(tablet, /function tabletDataCivil/);
  assert.match(tablet, /function tabletSomarDiasCivil/);
  assert.match(painel, /function hojeIso\(\)[\s\S]*getFullYear\(\)/);
  assert.doesNotMatch(painel, /function hojeIso\(\)[\s\S]{0,120}toISOString\(\)\.slice\(0, 10\)/);
});


test('modais legados recebem semântica, foco e navegação por teclado centralizados', () => {
  const ui = read('../public/ui-refinements.js');

  assert.match(ui, /const legacyModalReturnFocus = new WeakMap/);
  assert.match(ui, /modal\.setAttribute\('role',[\s\S]*'dialog'/);
  assert.match(ui, /modal\.setAttribute\('aria-modal', 'true'\)/);
  assert.match(ui, /button\.dataset\.uiAction = 'close'/);
  assert.match(ui, /event\.key !== 'Tab'/);
  assert.match(ui, /returnFocus\?\.focus/);
});


test('Histórico global inclui recorrências arquivadas e restaura pela RPC', () => {
  const ui = read('../public/ui-refinements.js');

  assert.match(ui, /\['acerto_regras', 'Recorrências'\]/);
  assert.match(ui, /from\('acerto_regras'\)[\s\S]*not\('arquivado_em', 'is', null\)/);
  assert.match(ui, /_ui_archive: 'acerto_regra'/);
  assert.match(ui, /archived \? 'arquivada' : 'excluído'/);
  assert.match(ui, /client\.rpc\('restaurar_regra_acerto'/);
});
