-- ===================================================================
-- LIFEOS - MIGRACAO 009: INVENTARIO ROTATIVO (Fatia 3)
-- Adiciona local e critico ao estoque. Cria tabela inventarios.
-- ===================================================================

-- Local de armazenamento (ambiente para o inventario rotativo).
alter table estoque
  add column if not exists local text;

-- Item critico: sempre entra no inventario, independente dos outros criterios.
alter table estoque
  add column if not exists critico boolean not null default false;

-- Tabela de sessoes de inventario: registra quem fez, quando e qual ambiente.
create table if not exists inventarios (
  id           uuid primary key default gen_random_uuid(),
  casa_id      uuid references casa(id),
  local        text not null,
  feito_por    uuid references usuarios(id),
  iniciado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  itens_count  integer default 0   -- quantos itens foram conferidos
);

alter table inventarios enable row level security;

drop policy if exists inventarios_ler on inventarios;
create policy inventarios_ler
  on inventarios for select to authenticated using (true);

drop policy if exists inventarios_inserir on inventarios;
create policy inventarios_inserir
  on inventarios for insert to authenticated with check (true);

drop policy if exists inventarios_atualizar on inventarios;
create policy inventarios_atualizar
  on inventarios for update to authenticated using (true);
