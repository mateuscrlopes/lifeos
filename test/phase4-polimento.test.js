import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ritmo mantém tabs sticky alinhadas ao topo real do scroll', () => {
  const css = read('public/phase4-polish.css');
  assert.match(css, /#secaoRitmo \.ritmo-tabs[\s\S]*top: 0 !important/);
  assert.match(css, /margin: 12px calc\(var\(--shell-gutter, 20px\) \* -1\)/);
  assert.match(css, /border-bottom:/);
});

test('Plantas são reordenadas por vencida, hoje e próximas', () => {
  const js = read('public/phase4-polish.js');
  assert.match(js, /rank: 0, distance: -dias, label: 'vencida'/);
  assert.match(js, /rank: 1, distance: 0, label: 'hoje'/);
  assert.match(js, /rank: 2, distance: emDias, label: 'proxima'/);
  assert.match(js, /rankedCards\.forEach\(\(\{ card \}\) => group\.appendChild\(card\)\)/);
  assert.match(js, /rankedGroups\.forEach\(\(\{ group \}\) => list\.appendChild\(group\)\)/);
});

test('campos e botões do Ritmo respeitam largura e touch target', () => {
  const css = read('public/phase4-polish.css');
  assert.match(css, /#secaoRitmo \.ritmo-field input,[\s\S]*min-height: 44px !important/);
  assert.match(css, /#secaoRitmo \.ritmo-actions \.ritmo-btn:not\(\.ghost\)[\s\S]*min-height: 44px !important/);
  assert.match(css, /box-sizing: border-box/);
});

test('catálogo de exercícios usa dataset public domain com cache e fallback', () => {
  const server = read('src/exercicios-midia.js');
  assert.match(server, /yuhonas\/free-exercise-db\/main\/dist\/exercises\.json/);
  assert.match(server, /Public Domain \/ Unlicense/);
  assert.match(server, /CACHE_TTL_MS = 12 \* 60 \* 60 \* 1000/);
  assert.match(server, /TOKEN_TRANSLATIONS/);
  assert.match(server, /found: false, query: nome/);
});

test('exercícios atuais do plano têm aliases de mídia', () => {
  const server = read('src/exercicios-midia.js');
  const atuais = [
    'leg press', 'supino maquina ou halteres', 'remada sentada', 'stiff rdl', 'elevacao lateral',
    'abdominal na polia', 'agachamento ou hack', 'puxada alta', 'supino inclinado', 'elevacao pelvica',
    'rosca de biceps', 'triceps na polia', 'prancha', 'afundo ou bulgaro', 'mesa flexora',
    'chest press ou crucifixo', 'remada maquina', 'desenvolvimento', 'panturrilha',
    'elevacao de joelhos ou pernas', 'agachamento na maquina', 'cadeira extensora', 'cadeira flexora',
    'remada baixa na polia com triangulo', 'puxada alta na polia', 'supino com halteres',
    'desenvolvimento com halteres', 'triceps corda', 'rosca biceps', 'stiff com halteres',
    'abdutora', 'adutora', 'afundo com halteres', 'panturrilha com halteres',
  ];
  atuais.forEach(nome => assert.ok(server.includes(`'${nome}'`), `alias ausente: ${nome}`));
});

test('mídia é progressiva: treino continua funcional se catálogo falhar', () => {
  const js = read('public/phase4-polish.js');
  assert.match(js, /catch\(\(\) => \(\{ found: false \}\)\)/);
  assert.match(js, /card\.dataset\.phase4Media = 'missing'/);
  assert.match(js, /Ver execução/);
  assert.match(js, /Posição inicial/);
  assert.match(js, /Posição final/);
});

test('loader traz fase 4 depois das camadas anteriores', () => {
  const loader = read('public/app-bootstrap.js');
  const phase3 = loader.indexOf('./phase3-polish.js?v=1');
  const phase4 = loader.indexOf('./phase4-polish.js?v=1');
  assert.ok(phase3 >= 0);
  assert.ok(phase4 > phase3);
});
