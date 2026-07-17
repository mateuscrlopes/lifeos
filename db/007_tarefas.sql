-- ===================================================================
-- LIFEOS - MIGRACAO 007: TAREFAS (Fatia 1)
-- Tarefas da Casa com responsavel e recorrencia simples.
-- Rituais (planejamento semanal, alinhamento do casal) = Fatia 2 (BACKLOG).
-- Seguro rodar de novo.
-- ===================================================================

create table if not exists tarefas (
  id             uuid primary key default gen_random_uuid(),
  casa_id        uuid references casa(id),
  titulo         text not null,                    -- ex.: "Lavar roupa"
  responsavel    text not null default 'ambos',    -- 'mateus' | 'ghustavo' | 'ambos'
  prioridade     text not null default 'normal',   -- 'baixa' | 'normal' | 'alta'
  data           date,                             -- quando fazer (opcional)
  feita          boolean not null default false,
  feita_por      uuid references usuarios(id),
  feita_em       timestamptz,
  recorrente     boolean not null default false,   -- repete?
  recorrencia    text,                             -- texto livre curto, ex.: "2x/semana", "semanal"
  criada_por     uuid references usuarios(id),
  criada_em      timestamptz not null default now()
);

create index if not exists tarefas_casa_idx on tarefas (casa_id, feita, data);


-- ===================================================================
-- SEGURANCA POR LINHA (RLS) - tarefas da Casa, compartilhadas
-- ===================================================================
alter table tarefas enable row level security;

drop policy if exists tarefas_ler on tarefas;
create policy tarefas_ler
  on tarefas for select to authenticated using (true);

drop policy if exists tarefas_inserir on tarefas;
create policy tarefas_inserir
  on tarefas for insert to authenticated with check (true);

drop policy if exists tarefas_atualizar on tarefas;
create policy tarefas_atualizar
  on tarefas for update to authenticated using (true);

drop policy if exists tarefas_remover on tarefas;
create policy tarefas_remover
  on tarefas for delete to authenticated using (true);
