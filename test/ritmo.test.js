import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('Ritmo entra no shell sem virar aplicativo separado', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');
  assert.match(html, /id="secaoRitmo"/);
  assert.match(html, /LifeOS.*Ritmo/s);
  assert.match(html, /onclick="voltarContexto\(\)"/);
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

test('Cardápio sugere a semana usando receitas e estoque sem salvar automaticamente', () => {
  const app = ler('public/app.js');
  const html = ler('public/index.html');
  assert.match(html, /id="btnSugerirPlan"/);
  assert.match(app, /async function sugerirPlanejamentoSemana/);
  assert.match(app, /refeicao_ingredientes/);
  assert.match(app, /from\('estoque'\)/);
  assert.match(app, /renderizarSlotsCardapio\(\)/);
});

test('Lista de compras separa ciclo semanal e mensal na mesma estrutura', () => {
  const sql = ler('db/043_lista_compras_ciclo.sql');
  const app = ler('public/app.js');
  const html = ler('public/index.html');
  assert.match(sql, /ciclo_compra/);
  assert.match(sql, /'semanal','mensal'/);
  assert.match(html, /id="novoItemCiclo"/);
  assert.match(html, /id="elCicloCompra"/);
  assert.match(app, /Compra semanal/);
  assert.match(app, /Compra do mês/);
});

test('Treinos do Ritmo podem editar exercícios sem alterar código', () => {
  const js = ler('public/ritmo.js');
  assert.match(js, /Editar exercícios/);
  assert.match(js, /abrirEditorItensPlano/);
  assert.match(js, /ritmo_plano_itens/);
  assert.match(js, /data-remover-item-plano/);
});

test('Foto só conclui registro visual com frente, lado e costas', () => {
  const js = ler('public/ritmo.js');
  assert.match(js, /\['frente','lado','costas'\]\.every/);
  assert.match(js, /registro completo/);
});

test('Déficit pode ser acompanhado sem obrigar microregistro de ingredientes', () => {
  const sql = ler('db/044_ritmo_consumo.sql');
  const js = ler('public/ritmo.js');
  assert.match(sql, /create table if not exists public\.ritmo_consumos/);
  assert.match(sql, /enable row level security/);
  assert.match(js, /Registrar alimentação/);
  assert.match(js, /ritmo_consumos/);
  assert.match(js, /meta registrada/);
});

test('navegação pessoal volta para a origem real e Hoje é a única home', () => {
  const app = ler('public/app.js');
  const html = ler('public/index.html');
  const shell = ler('public/mobile-shell-v3.js');
  assert.match(app, /function voltarContexto\(\)/);
  assert.match(app, /_origensSecao/);
  assert.match(html, /onclick="voltarContexto\(\)"/);
  assert.match(html, />\s*Hoje\s*<\/button>/);
  assert.match(shell, /removeLegacyHomeShortcuts/);
  assert.doesNotMatch(shell, /installHomeShortcuts\(\);\s*normalizeActions/);
});

test('Ritmo é item principal e ciclo é gerenciável pela interface', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');
  const js = ler('public/ritmo.js');
  assert.match(html, /data-tab="ritmo"/);
  assert.doesNotMatch(html, /data-tab="casa"/);
  assert.match(app, /function abrirRitmoContextual/);
  assert.match(js, /function abrirEditarCiclo/);
  assert.match(js, /ritmoSalvarCiclo/);
  assert.match(js, /ritmoEncerrarCiclo/);
  assert.match(js, /ritmoExcluirCiclo/);
  assert.match(js, /METAS_PADRAO_CICLO/);
});

test('modais do Ritmo têm fechamento separado de exclusão', () => {
  const js = ler('public/ritmo.js');
  const css = ler('public/ritmo.css');
  const refinements = ler('public/ui-refinements.js');
  assert.match(js, /data-fechar-ritmo aria-label="Fechar"/);
  assert.match(js, /m6 6 12 12M18 6 6 18/);
  assert.match(refinements, /button\.classList\.contains\('ritmo-close'\)/);
  assert.match(refinements, /if \(closeControl\) return false/);
  assert.match(js, /Deseja sair sem salvar as alterações/);
  assert.match(js, /ritmo-icon-danger/);
  assert.match(css, /\.ritmo-modal[\s\S]*align-items:\s*center/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.ritmo-form-grid[\s\S]*grid-template-columns:\s*1fr/);
});

test('semana do movimento abre o plano ao tocar no dia', () => {
  const js = ler('public/ritmo.js');
  assert.match(js, /ritmo-activity-open/);
  assert.match(js, /data-abrir-atividade/);
  assert.match(js, /abrirAtividadeAgenda/);
});

test('cardápio aceita sete dias e versões por pessoa', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');
  const hoje = ler('public/hoje.js');
  assert.match(html, />Sáb</);
  assert.match(html, />Dom</);
  assert.match(html, /id="btnLimparPlan"/);
  assert.match(app, /CARDAPIO_RESPONSAVEIS=\['ambos','mateus','ghustavo'\]/);
  assert.match(app, /for\(let d=1;d<=7;d\+\+\)/);
  assert.match(app, /_planDiasPorResp/);
  assert.match(hoje, /diaSemana === 0 \? 7 : diaSemana/);
});
