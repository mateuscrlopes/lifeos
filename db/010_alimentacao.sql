-- ===================================================================
-- LIFEOS - MIGRACAO 010: ALIMENTACAO E REFEICOES
-- Refeicoes (cadastro com ingredientes) e planejamento semanal.
-- ===================================================================

-- Cadastro de refeicoes reutilizaveis.
create table if not exists refeicoes (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid references casa(id),
  nome        text not null,                    -- ex.: "Frango com batata"
  tipo        text not null default 'almoco',   -- 'almoco' | 'janta' | 'ambos'
  porcoes     integer not null default 2,       -- para quantas pessoas
  criada_por  uuid references usuarios(id),
  criada_em   timestamptz not null default now()
);

-- Ingredientes de cada refeicao.
create table if not exists refeicao_ingredientes (
  id           uuid primary key default gen_random_uuid(),
  refeicao_id  uuid references refeicoes(id) on delete cascade,
  nome         text not null,                  -- ex.: "frango"
  quantidade   numeric,                        -- ex.: 500
  unidade      text                            -- ex.: "g", "unidades"
);

-- Planejamento semanal: uma linha por semana.
create table if not exists planejamento_semana (
  id             uuid primary key default gen_random_uuid(),
  casa_id        uuid references casa(id),
  semana_inicio  date not null,                -- segunda-feira da semana
  responsavel    text,                         -- 'mateus' | 'ghustavo' | 'ambos'
  criado_por     uuid references usuarios(id),
  criado_em      timestamptz not null default now()
);

-- Cada dia do planejamento: almoco e janta.
create table if not exists planejamento_dias (
  id               uuid primary key default gen_random_uuid(),
  planejamento_id  uuid references planejamento_semana(id) on delete cascade,
  dia_semana       integer not null,           -- 1=seg, 2=ter, 3=qua, 4=qui, 5=sex
  tipo             text not null,              -- 'almoco' | 'janta'
  refeicao_id      uuid references refeicoes(id),
  refeicao_nome    text,                       -- nome livre se nao tiver refeicao cadastrada
  observacao       text
);

-- RLS para todas as tabelas (compartilhadas da Casa).
alter table refeicoes enable row level security;
alter table refeicao_ingredientes enable row level security;
alter table planejamento_semana enable row level security;
alter table planejamento_dias enable row level security;

drop policy if exists ref_ler on refeicoes;
create policy ref_ler on refeicoes for select to authenticated using (true);
drop policy if exists ref_ins on refeicoes;
create policy ref_ins on refeicoes for insert to authenticated with check (true);
drop policy if exists ref_upd on refeicoes;
create policy ref_upd on refeicoes for update to authenticated using (true);
drop policy if exists ref_del on refeicoes;
create policy ref_del on refeicoes for delete to authenticated using (true);

drop policy if exists ri_ler on refeicao_ingredientes;
create policy ri_ler on refeicao_ingredientes for select to authenticated using (true);
drop policy if exists ri_ins on refeicao_ingredientes;
create policy ri_ins on refeicao_ingredientes for insert to authenticated with check (true);
drop policy if exists ri_del on refeicao_ingredientes;
create policy ri_del on refeicao_ingredientes for delete to authenticated using (true);

drop policy if exists ps_ler on planejamento_semana;
create policy ps_ler on planejamento_semana for select to authenticated using (true);
drop policy if exists ps_ins on planejamento_semana;
create policy ps_ins on planejamento_semana for insert to authenticated with check (true);
drop policy if exists ps_upd on planejamento_semana;
create policy ps_upd on planejamento_semana for update to authenticated using (true);

drop policy if exists pd_ler on planejamento_dias;
create policy pd_ler on planejamento_dias for select to authenticated using (true);
drop policy if exists pd_ins on planejamento_dias;
create policy pd_ins on planejamento_dias for insert to authenticated with check (true);
drop policy if exists pd_upd on planejamento_dias;
create policy pd_upd on planejamento_dias for update to authenticated using (true);
drop policy if exists pd_del on planejamento_dias;
create policy pd_del on planejamento_dias for delete to authenticated using (true);
