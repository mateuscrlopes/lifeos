import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('Ritmo entra no shell sem virar aplicativo separado', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');
  assert.match(html, /id="secaoRitmo"/);
  assert.match(html, /LifeOS.*Ritmo/s);
  assert.match(html, /onclick="voltarMais\(\)"/);
  assert.match(app, /secaoRitmo/);
  assert.match(app, /lifeos:ritmo-abrir/);
});

test('Ritmo mantém dados pessoais protegidos por RLS', () => {
  const sql = ler('db/039_ritmo.sql');
  for (const tabela of ['ritmo_perfis','ritmo_medidas','ritmo_checkins','ritmo_fotos','ritmo_planos_alimentares']) {
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
  assert.match(sql, /usuario_id = public\.lifeos_usuario_atual_id\(\)/);
  assert.match(sql, /'ritmo-fotos'/);
  assert.match(sql, /public = false/);
});

test('atividade física é genérica e aceita modalidades além de academia', () => {
  const js = ler('public/ritmo.js');
  for (const tipo of ['academia','corrida','pilates','circo','bicicleta','natacao','outro']) {
    assert.match(js, new RegExp(tipo));
  }
});

test('Ritmo reutiliza Cardápio da Casa em vez de duplicá-lo', () => {
  const js = ler('public/ritmo.js');
  assert.match(js, /planejamento_semana/);
  assert.match(js, /Abrir Cardápio da Casa/);
  assert.match(js, /window\.trocarSub\?\.\('cardapio'\)/);
});

test('check-ins permitem registro contextual e retroativo no mesmo dia', () => {
  const js = ler('public/ritmo.js');
  assert.match(js, /Ver dia completo/);
  assert.match(js, /Feito conforme planejado/);
  assert.match(js, /Fiz com ajustes/);
  assert.match(js, /Não fiz/);
});

test('PDF de plano pessoal é lido localmente e não persiste o arquivo original', () => {
  const src = ler('src/ritmo.js');
  assert.match(src, /PDFParse/);
  assert.match(src, /ritmo_planos_alimentares/);
  assert.match(src, /arquivo original nao e persistido/);
  assert.doesNotMatch(src, /storage\.from\(/);
});

test('biblioteca inicial usa a estrutura de refeições já existente', () => {
  const sql = ler('db/041_ritmo_biblioteca_receitas.sql');
  assert.match(sql, /insert into public\.refeicoes/);
  assert.match(sql, /insert into public\.refeicao_ingredientes/);
  assert.match(sql, /gov\.br\/saude/);
});
