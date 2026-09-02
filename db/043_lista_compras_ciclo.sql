-- LIFEOS - MIGRACAO 043: CICLO DA LISTA DE COMPRAS
-- Permite separar a compra grande do mes da reposicao semanal sem criar
-- uma segunda lista paralela.

alter table public.lista_compras
  add column if not exists ciclo_compra text not null default 'semanal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lista_compras_ciclo_compra_check'
      and conrelid = 'public.lista_compras'::regclass
  ) then
    alter table public.lista_compras
      add constraint lista_compras_ciclo_compra_check
      check (ciclo_compra in ('semanal','mensal'));
  end if;
end $$;

create index if not exists lista_compras_casa_ciclo_status_idx
  on public.lista_compras(casa_id, ciclo_compra, status);
