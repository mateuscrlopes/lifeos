-- ===================================================================
-- LIFEOS - MIGRACAO 004: ESTOQUE (Fatia 1 - unidade contavel)
-- Itens controlados da Casa, medidos por numero de unidades.
-- Outros tipos de medicao (peso, nivel visual, presenca) virao na
-- Fatia 1.5, conforme o BACKLOG.md.
-- Seguro rodar de novo.
-- ===================================================================

-- -------------------------------------------------------------------
-- TABELA: estoque
-- Cada linha e um produto que a Casa decide acompanhar. Estoque
-- SELETIVO: so entra aqui o que vale a pena acompanhar, nao tudo.
-- -------------------------------------------------------------------
create table if not exists estoque (
  id               uuid primary key default gen_random_uuid(),
  casa_id          uuid references casa(id),
  nome             text not null,                    -- ex.: "papel higienico"
  categoria        text,                             -- ex.: "banheiro"
  quantidade       numeric not null default 0,       -- quantas unidades ha hoje
  unidade          text default 'unidades',          -- rotulo, ex.: "rolos", "unidades"
  minimo           numeric not null default 1,       -- abaixo disto, precisa repor
  atualizado_por   uuid references usuarios(id),     -- quem fez o ultimo ajuste
  atualizado_em    timestamptz not null default now(),
  criado_em        timestamptz not null default now()
);

create index if not exists estoque_casa_idx on estoque (casa_id);


-- ===================================================================
-- SEGURANCA POR LINHA (RLS)
-- Estoque e da Casa (compartilhado). Logados leem e alteram.
-- ===================================================================
alter table estoque enable row level security;

drop policy if exists estoque_ler on estoque;
create policy estoque_ler
  on estoque for select
  to authenticated
  using (true);

drop policy if exists estoque_inserir on estoque;
create policy estoque_inserir
  on estoque for insert
  to authenticated
  with check (true);

drop policy if exists estoque_atualizar on estoque;
create policy estoque_atualizar
  on estoque for update
  to authenticated
  using (true);

drop policy if exists estoque_remover on estoque;
create policy estoque_remover
  on estoque for delete
  to authenticated
  using (true);
