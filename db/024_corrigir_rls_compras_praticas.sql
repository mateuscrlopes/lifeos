-- LifeOS — correção das políticas RLS para Compras Práticas v2
-- Execute depois de db/023_compras_praticas.sql.
-- Pode ser executado mais de uma vez com segurança.

alter table public.compra_destinos enable row level security;
alter table public.compras_sessoes enable row level security;
alter table public.compras_sessao_itens enable row level security;

grant select, insert, update, delete on table public.compra_destinos to authenticated;
grant select, insert, update, delete on table public.compras_sessoes to authenticated;
grant select, insert, update, delete on table public.compras_sessao_itens to authenticated;

drop policy if exists "compra_destinos_select_casa" on public.compra_destinos;
drop policy if exists "compra_destinos_insert_casa" on public.compra_destinos;
drop policy if exists "compra_destinos_update_casa" on public.compra_destinos;
drop policy if exists "compra_destinos_delete_casa" on public.compra_destinos;

create policy "compra_destinos_select_casa"
on public.compra_destinos
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compra_destinos.casa_id
  )
);

create policy "compra_destinos_insert_casa"
on public.compra_destinos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compra_destinos.casa_id
  )
);

create policy "compra_destinos_update_casa"
on public.compra_destinos
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compra_destinos.casa_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compra_destinos.casa_id
  )
);

create policy "compra_destinos_delete_casa"
on public.compra_destinos
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compra_destinos.casa_id
  )
);

drop policy if exists "compras_sessoes_select_casa" on public.compras_sessoes;
drop policy if exists "compras_sessoes_insert_casa" on public.compras_sessoes;
drop policy if exists "compras_sessoes_update_casa" on public.compras_sessoes;
drop policy if exists "compras_sessoes_delete_casa" on public.compras_sessoes;

create policy "compras_sessoes_select_casa"
on public.compras_sessoes
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compras_sessoes.casa_id
  )
);

create policy "compras_sessoes_insert_casa"
on public.compras_sessoes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compras_sessoes.casa_id
  )
);

create policy "compras_sessoes_update_casa"
on public.compras_sessoes
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compras_sessoes.casa_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compras_sessoes.casa_id
  )
);

create policy "compras_sessoes_delete_casa"
on public.compras_sessoes
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = compras_sessoes.casa_id
  )
);

drop policy if exists "compras_sessao_itens_select_casa" on public.compras_sessao_itens;
drop policy if exists "compras_sessao_itens_insert_casa" on public.compras_sessao_itens;
drop policy if exists "compras_sessao_itens_update_casa" on public.compras_sessao_itens;
drop policy if exists "compras_sessao_itens_delete_casa" on public.compras_sessao_itens;

create policy "compras_sessao_itens_select_casa"
on public.compras_sessao_itens
for select
to authenticated
using (
  exists (
    select 1
    from public.compras_sessoes s
    join public.usuarios u on u.casa_id = s.casa_id
    where s.id = compras_sessao_itens.sessao_id
      and u.auth_id = auth.uid()
  )
);

create policy "compras_sessao_itens_insert_casa"
on public.compras_sessao_itens
for insert
to authenticated
with check (
  exists (
    select 1
    from public.compras_sessoes s
    join public.usuarios u on u.casa_id = s.casa_id
    where s.id = compras_sessao_itens.sessao_id
      and u.auth_id = auth.uid()
  )
);

create policy "compras_sessao_itens_update_casa"
on public.compras_sessao_itens
for update
to authenticated
using (
  exists (
    select 1
    from public.compras_sessoes s
    join public.usuarios u on u.casa_id = s.casa_id
    where s.id = compras_sessao_itens.sessao_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.compras_sessoes s
    join public.usuarios u on u.casa_id = s.casa_id
    where s.id = compras_sessao_itens.sessao_id
      and u.auth_id = auth.uid()
  )
);

create policy "compras_sessao_itens_delete_casa"
on public.compras_sessao_itens
for delete
to authenticated
using (
  exists (
    select 1
    from public.compras_sessoes s
    join public.usuarios u on u.casa_id = s.casa_id
    where s.id = compras_sessao_itens.sessao_id
      and u.auth_id = auth.uid()
  )
);
