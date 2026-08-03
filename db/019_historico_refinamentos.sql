-- LIFEOS — Histórico recuperável: reforço idempotente
-- Execute no SQL Editor do Supabase apenas se a tabela historico_excluidos
-- ainda não existir ou se a tela informar erro de permissão.

create table if not exists historico_excluidos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid references casa(id),
  usuario_id uuid references usuarios(id),
  modulo text not null,
  registro_id uuid,
  dados jsonb not null,
  excluido_em timestamptz not null default now(),
  restaurado_em timestamptz,
  restaurado_por uuid references usuarios(id)
);

create index if not exists he_casa_modulo_idx
  on historico_excluidos (casa_id, modulo, excluido_em desc);

alter table historico_excluidos enable row level security;

drop policy if exists he_ler on historico_excluidos;
create policy he_ler on historico_excluidos
  for select to authenticated using (true);

drop policy if exists he_ins on historico_excluidos;
create policy he_ins on historico_excluidos
  for insert to authenticated with check (true);

drop policy if exists he_upd on historico_excluidos;
create policy he_upd on historico_excluidos
  for update to authenticated using (true) with check (true);
