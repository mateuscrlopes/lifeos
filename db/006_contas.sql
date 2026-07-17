-- ===================================================================
-- LIFEOS - MIGRACAO 006: CONTAS (cadastro manual)
-- Contas da Casa: vencimento, valor, status, recorrencia.
-- Contas pessoais e privacidade fina virao depois (BACKLOG).
-- Seguro rodar de novo.
-- ===================================================================

create table if not exists contas (
  id             uuid primary key default gen_random_uuid(),
  casa_id        uuid references casa(id),
  nome           text not null,                    -- ex.: "Aluguel", "Energia"
  categoria      text,                             -- ex.: "moradia", "utilidades"
  valor          numeric,                          -- valor em R$ (pode ser nulo se ainda nao se sabe)
  vencimento     date not null,                    -- quando vence
  paga           boolean not null default false,   -- ja foi paga?
  paga_em        timestamptz,                      -- quando foi marcada como paga
  recorrente     boolean not null default false,   -- repete todo mes?
  dia_vencimento integer,                          -- dia do mes para a recorrencia (1-31)
  criada_por     uuid references usuarios(id),
  criada_em      timestamptz not null default now()
);

create index if not exists contas_casa_venc_idx on contas (casa_id, vencimento);


-- ===================================================================
-- SEGURANCA POR LINHA (RLS) - contas da Casa, compartilhadas
-- ===================================================================
alter table contas enable row level security;

drop policy if exists contas_ler on contas;
create policy contas_ler
  on contas for select to authenticated using (true);

drop policy if exists contas_inserir on contas;
create policy contas_inserir
  on contas for insert to authenticated with check (true);

drop policy if exists contas_atualizar on contas;
create policy contas_atualizar
  on contas for update to authenticated using (true);

drop policy if exists contas_remover on contas;
create policy contas_remover
  on contas for delete to authenticated using (true);
