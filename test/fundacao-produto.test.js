import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('X de fechar nunca é inferido como lixeira', () => {
  const ui = read('../public/ui-refinements.js');
  const acertos = read('../public/acertos.js');

  assert.match(ui, /explicitAction === 'delete'/);
  assert.match(ui, /Um X sem semântica explícita é tratado como fechar/);
  assert.doesNotMatch(ui, /\(label === '×' \|\| label === '✕'\)[\s\S]{0,180}ui-delete/);
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
