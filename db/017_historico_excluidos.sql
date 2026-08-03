-- ===================================================================
-- LIFEOS - MIGRACAO 017: HISTORICO DE ITENS EXCLUIDOS
-- Tabela generica para guardar registros excluidos com possibilidade
-- de restauracao. Cada modulo envia o registro completo como JSON.
-- ===================================================================

create table if not exists historico_excluidos (
  id            uuid primary key default gen_random_uuid(),
  casa_id       uuid references casa(id),
  usuario_id    uuid references usuarios(id),
  modulo        text not null,      -- 'tarefas' | 'contas' | 'estoque' | 'lista'
  registro_id   uuid,               -- id original do registro
  dados         jsonb not null,     -- snapshot completo do registro
  excluido_em   timestamptz not null default now(),
  restaurado_em timestamptz,
  restaurado_por uuid references usuarios(id)
);

create index if not exists he_casa_modulo_idx on historico_excluidos (casa_id, modulo, excluido_em desc);

alter table historico_excluidos enable row level security;

drop policy if exists he_ler on historico_excluidos;
create policy he_ler on historico_excluidos for select to authenticated using (true);
drop policy if exists he_ins on historico_excluidos;
create policy he_ins on historico_excluidos for insert to authenticated with check (true);
drop policy if exists he_upd on historico_excluidos;
create policy he_upd on historico_excluidos for update to authenticated using (true);
