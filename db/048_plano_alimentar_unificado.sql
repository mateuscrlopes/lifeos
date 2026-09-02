-- LIFEOS - MIGRACAO 048: PLANO ALIMENTAR UNIFICADO E CARBOIDRATOS
-- O Cardapio da Casa passa a cobrir almoco/jantar.
-- Cafe e lanches vem do plano alimentar pessoal do Ritmo.
-- O consumo automatico ganha carboidratos e uma chave estavel de origem.

alter table public.refeicoes
  add column if not exists carboidratos_por_porcao numeric(8,2)
    check (carboidratos_por_porcao is null or carboidratos_por_porcao between 0 and 1000);

alter table public.planejamento_dias
  add column if not exists carboidratos_g numeric(8,2)
    check (carboidratos_g is null or carboidratos_g between 0 and 1000);

alter table public.ritmo_consumos
  add column if not exists carboidratos_g numeric(8,2)
    check (carboidratos_g is null or carboidratos_g between 0 and 1000),
  add column if not exists referencia_chave text;

create unique index if not exists ritmo_consumos_referencia_unica_idx
  on public.ritmo_consumos(usuario_id, data, referencia_chave)
  where referencia_chave is not null;

alter table public.ritmo_checkins
  drop constraint if exists ritmo_checkins_tipo_check;

alter table public.ritmo_checkins
  add constraint ritmo_checkins_tipo_check
  check (tipo in ('cafe','lanche','lanche_manha','almoco','lanche_tarde','jantar','atividade','agua'));

with valores(nome, carbo) as (
  values
    ('Frango cremoso com brócolis',18),
    ('Sassami com mostarda e batata na Air Fryer',35),
    ('Sobrecoxa com cenoura e cebola na Air Fryer',18),
    ('Frango desfiado colorido com legumes',14),
    ('Frango com couve-flor e páprica',12),
    ('Carne moída com abobrinha e cenoura',15),
    ('Carne moída com purê de inhame',42),
    ('Acém de panela com legumes',20),
    ('Bife acebolado com couve',12),
    ('Almôndegas caseiras ao molho de tomate',22),
    ('Filé mignon suíno com mostarda e ervas',8),
    ('Lombo suíno com batata-doce',38),
    ('Tilápia com limão e brócolis',12),
    ('Peixe ao molho rápido de tomate',14),
    ('Sardinha com batata e salada de tomate',35),
    ('Omelete de brócolis e muçarela',8),
    ('Omelete de couve, tomate e cebola',10),
    ('Bowl de arroz, feijão, frango e legumes',55),
    ('Macarrão com atum, tomate e brócolis',60),
    ('Escondidinho de carne moída e aipim',48),
    ('Banana com iogurte e granola',45),
    ('Iogurte natural com maçã e aveia',38),
    ('Sanduíche de ovo e tomate',32),
    ('Sanduíche de frango e salada',35),
    ('Ovos cozidos com fruta',25),
    ('Tapioca com ovo e queijo',40),
    ('Banana morna com canela e iogurte',32),
    ('Copo de frutas com iogurte',40),
    ('Milho cozido com ovos',42),
    ('Batata-doce com ovo mexido',38)
)
update public.refeicoes r
set carboidratos_por_porcao = coalesce(r.carboidratos_por_porcao, v.carbo)
from valores v
where lower(trim(r.nome)) = lower(trim(v.nome));

update public.planejamento_dias pd
set carboidratos_g = coalesce(pd.carboidratos_g, r.carboidratos_por_porcao)
from public.refeicoes r
where pd.refeicao_id = r.id
  and pd.carboidratos_g is null;
