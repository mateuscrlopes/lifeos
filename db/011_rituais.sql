-- ===================================================================
-- LIFEOS - MIGRACAO 011: RITUAIS (Tarefas Fatia 2)
-- Rituais com pauta estruturada, sessoes e historico.
-- ===================================================================

-- Definicao de cada ritual (pauta padrao editavel).
create table if not exists rituais (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid references casa(id),
  nome        text not null,           -- ex.: "Planejamento semanal"
  frequencia  text not null,           -- 'semanal' | 'mensal' | 'bimestral'
  pauta       text,                    -- topicos padrao, texto livre com quebras de linha
  privado     boolean not null default false,  -- true = nao exibir no tablet
  criado_em   timestamptz not null default now()
);

-- Sessoes: cada vez que o ritual e realizado.
create table if not exists ritual_sessoes (
  id          uuid primary key default gen_random_uuid(),
  ritual_id   uuid references rituais(id) on delete cascade,
  realizado_em timestamptz not null default now(),
  notas       text,                    -- o que foi decidido/anotado
  proxima_em  date,                    -- quando fazer a proxima
  criado_por  uuid references usuarios(id)
);

-- RLS
alter table rituais enable row level security;
alter table ritual_sessoes enable row level security;

drop policy if exists rit_ler on rituais;
create policy rit_ler on rituais for select to authenticated using (true);
drop policy if exists rit_ins on rituais;
create policy rit_ins on rituais for insert to authenticated with check (true);
drop policy if exists rit_upd on rituais;
create policy rit_upd on rituais for update to authenticated using (true);
drop policy if exists rit_del on rituais;
create policy rit_del on rituais for delete to authenticated using (true);

drop policy if exists rs_ler on ritual_sessoes;
create policy rs_ler on ritual_sessoes for select to authenticated using (true);
drop policy if exists rs_ins on ritual_sessoes;
create policy rs_ins on ritual_sessoes for insert to authenticated with check (true);
drop policy if exists rs_upd on ritual_sessoes;
create policy rs_upd on ritual_sessoes for update to authenticated using (true);

-- Dados iniciais: os tres rituais que faltam (os outros dois ja existem).
-- Inseridos apenas se a casa nao tiver nenhum ritual ainda.
-- (O usuario roda este SQL depois do login, entao usamos a tabela casa.)
