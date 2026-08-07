import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ler=c=>fs.readFileSync(new URL(`../${c}`,import.meta.url),'utf8');
test('migração adiciona campos da receita',()=>{const s=ler('db/031_receitas_completas.sql');for(const c of ['tempo_minutos','modo_preparo','observacoes','fonte_url'])assert.match(s,new RegExp(c))});
test('RPC evita duplicar ingrediente pendente',()=>{const s=ler('db/031_receitas_completas.sql');assert.match(s,/adicionar_ingredientes_receita_lista/);assert.match(s,/status = 'pendente'/);assert.match(s,/lower\(trim\(lc\.nome\)\)/);assert.match(s,/pg_advisory_xact_lock/);assert.match(s,/'cardapio'/)});
test('app salva campos e identifica receita',()=>{const s=ler('public/app.js');assert.match(s,/tempo_minutos:Number\(el\('refTempo'\)/);assert.match(s,/modo_preparo:el\('refPreparo'\)/);assert.match(s,/linha\.dataset\.receitaId=r\.id/);assert.match(s,/receitas-v2\.js\?v=1/)});
test('tablet expõe id e carrega receitas',()=>{assert.match(ler('public/alimentacao-contextual.js'),/data-ac-receita-id/);assert.match(ler('public/tablet-enhancements.js'),/receitas-v2\.js\?v=1/)});
test('compra é seletiva',()=>{const s=ler('public/receitas-v2.js');assert.match(s,/Desmarque o que vocês já têm em casa/);assert.match(s,/p_ingrediente_ids: selecionados/)});
