-- ===================================================================
-- LIFEOS - MIGRACAO 003: LISTA DE COMPRAS
-- Cria a tabela de itens da lista de compras compartilhada da Casa,
-- com seguranca por linha (RLS).
-- Seguro rodar de novo.
-- ===================================================================

-- -------------------------------------------------------------------
-- TABELA: lista_compras
-- Itens que a Casa precisa comprar. Comeca simples: nome, quantidade
-- planejada, unidade, categoria, quem adicionou e status.
-- A quantidade REAL comprada entrara quando o modulo de estoque existir.
-- -------------------------------------------------------------------
create table if not exists lista_compras (
  id              uuid primary key default gen_random_uuid(),
  casa_id         uuid references casa(id),          -- a qual casa pertence
  nome            text not null,                     -- ex.: "leite"
  quantidade      numeric,                           -- quantidade planejada, ex.: 2
  unidade         text,                              -- ex.: "litros", "unidades"
  categoria       text,                              -- ex.: "mercado", "farmacia"
  status          text not null default 'pendente',  -- 'pendente' ou 'comprado'
  criado_por      uuid references usuarios(id),      -- quem adicionou
  comprado_por    uuid references usuarios(id),      -- quem marcou como comprado
  criado_em       timestamptz not null default now(),
  comprado_em     timestamptz                        -- quando foi comprado (nulo ate la)
);

-- Indice para listar rapidamente os itens pendentes de uma casa.
create index if not exists lista_compras_casa_status_idx
  on lista_compras (casa_id, status);


-- ===================================================================
-- SEGURANCA POR LINHA (RLS)
-- Apenas usuarios logados acessam a lista. Como a lista e da Casa
-- (compartilhada), os dois moradores podem ler, adicionar e alterar.
-- ===================================================================
alter table lista_compras enable row level security;

drop policy if exists lista_ler on lista_compras;
create policy lista_ler
  on lista_compras for select
  to authenticated
  using (true);

drop policy if exists lista_inserir on lista_compras;
create policy lista_inserir
  on lista_compras for insert
  to authenticated
  with check (true);

drop policy if exists lista_atualizar on lista_compras;
create policy lista_atualizar
  on lista_compras for update
  to authenticated
  using (true);

drop policy if exists lista_remover on lista_compras;
create policy lista_remover
  on lista_compras for delete
  to authenticated
  using (true);
