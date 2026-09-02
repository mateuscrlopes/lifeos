-- LIFEOS - MIGRACAO 045: CALORIAS NO CARDAPIO E CHECK-IN AUTOMATICO
-- Adiciona valores nutricionais por porcao nas receitas e permite
-- congelar os valores do planejamento da semana para o Ritmo.

alter table public.refeicoes
  add column if not exists calorias_por_porcao integer
    check (calorias_por_porcao is null or calorias_por_porcao between 0 and 5000),
  add column if not exists proteina_por_porcao numeric(8,2)
    check (proteina_por_porcao is null or proteina_por_porcao between 0 and 500);

alter table public.planejamento_dias
  add column if not exists calorias integer
    check (calorias is null or calorias between 0 and 5000),
  add column if not exists proteina_g numeric(8,2)
    check (proteina_g is null or proteina_g between 0 and 500);

alter table public.ritmo_consumos
  add column if not exists planejamento_dia_id uuid
    references public.planejamento_dias(id) on delete set null;

create unique index if not exists ritmo_consumos_plano_unico_idx
  on public.ritmo_consumos(usuario_id, data, refeicao, planejamento_dia_id)
  where planejamento_dia_id is not null;

-- Valores iniciais aproximados por porcao para a biblioteca padrao.
-- Continuam editaveis no app e nunca sobrescrevem valores ja definidos.
with valores(nome, kcal, proteina) as (
  values
    ('Frango cremoso com brócolis',350,38),
    ('Sassami com mostarda e batata na Air Fryer',420,40),
    ('Sobrecoxa com cenoura e cebola na Air Fryer',430,32),
    ('Frango desfiado colorido com legumes',310,34),
    ('Frango com couve-flor e páprica',300,38),
    ('Carne moída com abobrinha e cenoura',370,30),
    ('Carne moída com purê de inhame',480,29),
    ('Acém de panela com legumes',460,34),
    ('Bife acebolado com couve',420,36),
    ('Almôndegas caseiras ao molho de tomate',430,30),
    ('Filé mignon suíno com mostarda e ervas',350,35),
    ('Lombo suíno com batata-doce',440,34),
    ('Tilápia com limão e brócolis',300,36),
    ('Peixe ao molho rápido de tomate',320,34),
    ('Sardinha com batata e salada de tomate',410,28),
    ('Omelete de brócolis e muçarela',330,27),
    ('Omelete de couve, tomate e cebola',290,24),
    ('Bowl de arroz, feijão, frango e legumes',520,42),
    ('Macarrão com atum, tomate e brócolis',500,33),
    ('Escondidinho de carne moída e aipim',520,28),
    ('Banana com iogurte e granola',280,9),
    ('Iogurte natural com maçã e aveia',240,9),
    ('Sanduíche de ovo e tomate',330,20),
    ('Sanduíche de frango e salada',350,30),
    ('Ovos cozidos com fruta',250,14),
    ('Tapioca com ovo e queijo',360,20),
    ('Banana morna com canela e iogurte',210,7),
    ('Copo de frutas com iogurte',230,8),
    ('Milho cozido com ovos',300,16),
    ('Batata-doce com ovo mexido',320,15)
)
update public.refeicoes r
set calorias_por_porcao = coalesce(r.calorias_por_porcao, v.kcal),
    proteina_por_porcao = coalesce(r.proteina_por_porcao, v.proteina)
from valores v
where lower(trim(r.nome)) = lower(trim(v.nome));

-- Planejamentos existentes herdam o valor atual da receita quando houver.
update public.planejamento_dias pd
set calorias = coalesce(pd.calorias, r.calorias_por_porcao),
    proteina_g = coalesce(pd.proteina_g, r.proteina_por_porcao)
from public.refeicoes r
where pd.refeicao_id = r.id
  and (pd.calorias is null or pd.proteina_g is null);
