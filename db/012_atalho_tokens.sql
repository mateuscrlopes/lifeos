-- ===================================================================
-- LIFEOS - MIGRACAO 012: TOKENS PARA ATALHOS DO IOS
-- Tokens secretos que identificam cada usuario nos Atalhos do Siri.
-- Nao usa autenticacao do Supabase (Atalhos nao suportam OAuth).
-- ===================================================================

create table if not exists atalho_tokens (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references usuarios(id) on delete cascade,
  token       text not null unique,   -- segredo gerado uma vez, guardado no Atalho
  nome        text,                   -- descricao, ex.: "iPhone de Mateus"
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- RLS: so o proprio usuario ve e gerencia seus tokens.
alter table atalho_tokens enable row level security;

drop policy if exists at_ler on atalho_tokens;
create policy at_ler
  on atalho_tokens for select to authenticated
  using (usuario_id = (select id from usuarios where auth_id = auth.uid()));

drop policy if exists at_ins on atalho_tokens;
create policy at_ins
  on atalho_tokens for insert to authenticated
  with check (usuario_id = (select id from usuarios where auth_id = auth.uid()));

drop policy if exists at_upd on atalho_tokens;
create policy at_upd
  on atalho_tokens for update to authenticated
  using (usuario_id = (select id from usuarios where auth_id = auth.uid()));
