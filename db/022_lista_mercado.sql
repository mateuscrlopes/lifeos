-- LifeOS — Lista do Mercado e conferência pós-compra
-- Migração idempotente: pode ser executada uma vez no SQL Editor do Supabase.

alter table lista_compras
  add column if not exists no_carrinho boolean not null default false,
  add column if not exists preco_compra numeric(12,2),
  add column if not exists aguardando_conferencia boolean not null default false,
  add column if not exists compra_observacao text;

create index if not exists lista_compras_carrinho_idx
  on lista_compras (casa_id, status, no_carrinho)
  where status = 'pendente';

create index if not exists lista_compras_conferencia_idx
  on lista_compras (casa_id, aguardando_conferencia, comprado_em desc)
  where status = 'comprado' and aguardando_conferencia = true;

comment on column lista_compras.no_carrinho is
  'Indica que o item foi colocado no carrinho durante o modo Lista do Mercado.';
comment on column lista_compras.preco_compra is
  'Preço opcional informado durante a compra.';
comment on column lista_compras.aguardando_conferencia is
  'Indica que a compra terminou, mas a atualização do estoque ainda precisa ser revisada.';
comment on column lista_compras.compra_observacao is
  'Observação opcional associada à compra.';
