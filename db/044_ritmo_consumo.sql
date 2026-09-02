-- LIFEOS - MIGRACAO 044: CONSUMO ALIMENTAR PESSOAL DO RITMO
-- Registro opcional e leve para acompanhar calorias/proteina contra as metas.

create table if not exists public.ritmo_consumos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  refeicao text not null default 'outro'
    check (refeicao in ('cafe','lanche_manha','almoco','lanche_tarde','jantar','ceia','outro')),
  descricao text,
  calorias integer check (calorias is null or calorias between 0 and 5000),
  proteina_g numeric(8,2) check (proteina_g is null or proteina_g between 0 and 500),
  fonte text not null default 'manual'
    check (fonte in ('manual','plano','receita')),
  criado_em timestamptz not null default now()
);

create index if not exists ritmo_consumos_usuario_data_idx
  on public.ritmo_consumos(usuario_id, data desc);

alter table public.ritmo_consumos enable row level security;

drop policy if exists ritmo_consumos_ler on public.ritmo_consumos;
create policy ritmo_consumos_ler
  on public.ritmo_consumos for select to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id());

drop policy if exists ritmo_consumos_inserir on public.ritmo_consumos;
create policy ritmo_consumos_inserir
  on public.ritmo_consumos for insert to authenticated
  with check (usuario_id = public.lifeos_usuario_atual_id());

drop policy if exists ritmo_consumos_atualizar on public.ritmo_consumos;
create policy ritmo_consumos_atualizar
  on public.ritmo_consumos for update to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id())
  with check (usuario_id = public.lifeos_usuario_atual_id());

drop policy if exists ritmo_consumos_excluir on public.ritmo_consumos;
create policy ritmo_consumos_excluir
  on public.ritmo_consumos for delete to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id());

grant select, insert, update, delete on public.ritmo_consumos to authenticated;
