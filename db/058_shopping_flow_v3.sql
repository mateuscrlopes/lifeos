-- LifeOS — Compras e Estoque v3
-- Separa saldo real, quantidade ideal e preço unitário sem quebrar o fluxo atual.

alter table public.estoque
  add column if not exists quantidade_ideal numeric,
  add column if not exists passo_ajuste numeric not null default 1;

alter table public.lista_compras
  add column if not exists preco_unitario_compra numeric;

alter table public.compras_sessao_itens
  add column if not exists preco_unitario numeric;

comment on column public.estoque.quantidade_ideal is
  'Quantidade que a Casa prefere manter. Diferente do mínimo, que é apenas o ponto de alerta.';
comment on column public.estoque.passo_ajuste is
  'Quanto os controles rápidos + e - alteram na unidade exibida. Padrão: 1.';
comment on column public.lista_compras.preco_unitario_compra is
  'Preço por uma unidade efetivamente comprada. preco_compra continua representando o subtotal da linha.';
comment on column public.compras_sessao_itens.preco_unitario is
  'Preço unitário informado durante a compra, quando disponível.';

alter table public.estoque
  drop constraint if exists estoque_quantidade_ideal_nao_negativa;
alter table public.estoque
  add constraint estoque_quantidade_ideal_nao_negativa
  check (quantidade_ideal is null or quantidade_ideal >= 0);

alter table public.estoque
  drop constraint if exists estoque_passo_ajuste_positivo;
alter table public.estoque
  add constraint estoque_passo_ajuste_positivo
  check (passo_ajuste > 0);

alter table public.lista_compras
  drop constraint if exists lista_preco_unitario_nao_negativo;
alter table public.lista_compras
  add constraint lista_preco_unitario_nao_negativo
  check (preco_unitario_compra is null or preco_unitario_compra >= 0);

-- O histórico recebe o preço unitário sem exigir mudança no fluxo de finalização atual.
create or replace function public.lifeos_historico_preco_unitario()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.preco_unitario is null and new.lista_compra_id is not null then
    select l.preco_unitario_compra
      into new.preco_unitario
    from public.lista_compras l
    where l.id = new.lista_compra_id;
  end if;

  if new.preco_unitario is null
     and new.preco is not null
     and new.quantidade is not null
     and new.quantidade > 0 then
    new.preco_unitario := new.preco / new.quantidade;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_historico_preco_unitario on public.compras_sessao_itens;
create trigger trg_historico_preco_unitario
before insert on public.compras_sessao_itens
for each row
execute function public.lifeos_historico_preco_unitario();
