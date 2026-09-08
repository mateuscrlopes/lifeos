import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('exclusão da ficha de planta permanece no fluxo oficial do app', () => {
  const view = ler('public/plantas-view.js');
  const app = ler('public/app.js');
  const refinements = ler('public/ui-refinements.js');

  assert.match(view, /btnRemoverPlanta/);
  assert.match(view, /remover\.dataset\.lifeosDeleteFlow\s*=\s*'app'/);
  assert.match(view, /modal\.dataset\.plantaId\s*=\s*planta\.id/);
  assert.match(view, /remover\.dataset\.plantaId\s*=\s*planta\.id/);

  assert.match(app, /el\('btnRemoverPlanta'\)\.onclick=async\(\)=>/);
  assert.match(app, /if\(!_plantaAberta\)return/);
  assert.match(app, /removerPlanta\(supa,usuario,_plantaAberta\)/);

  assert.match(refinements, /dataset\.lifeosDeleteFlow === 'app'\) return/);
});

test('abrir a ficha preserva o UUID real antes de delegar para o app', () => {
  const view = ler('public/plantas-view.js');
  assert.match(view, /function prepararFichaPlanta\(planta\)/);
  assert.match(view, /prepararFichaPlanta\(planta\);\s*onOpen\(planta\);/);
});
