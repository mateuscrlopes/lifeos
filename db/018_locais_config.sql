-- ===================================================================
-- LIFEOS - MIGRACAO 018: LOCAIS DO ESTOQUE CONFIGURÁVEIS
-- Tira os locais do hardcode e coloca no banco.
-- ===================================================================

create table if not exists locais_estoque (
  id        uuid primary key default gen_random_uuid(),
  casa_id   uuid references casa(id),
  nome      text not null,
  ordem     integer not null default 0,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table locais_estoque enable row level security;

drop policy if exists le_ler on locais_estoque;
create policy le_ler on locais_estoque for select to authenticated using (true);
drop policy if exists le_ins on locais_estoque;
create policy le_ins on locais_estoque for insert to authenticated with check (true);
drop policy if exists le_upd on locais_estoque;
create policy le_upd on locais_estoque for update to authenticated using (true);
drop policy if exists le_del on locais_estoque;
create policy le_del on locais_estoque for delete to authenticated using (true);

-- Inserir os 12 locais atuais
do $$
declare v_casa_id uuid;
begin
  select id into v_casa_id from casa order by criada_em limit 1;
  insert into locais_estoque (casa_id, nome, ordem)
  select v_casa_id, nome, ordem from (values
    ('Cozinha - Não perecíveis', 1),
    ('Cozinha - Hortifruti', 2),
    ('Cozinha - Carnes', 3),
    ('Cozinha - Café da manhã', 4),
    ('Cozinha - Temperos', 5),
    ('Banheiro - Higiene pessoal', 6),
    ('Banheiro - Cosméticos', 7),
    ('Banheiro - Limpeza', 8),
    ('Lavanderia', 9),
    ('Casa - Limpeza', 10),
    ('Casa - Utilitários', 11),
    ('Farmácia / Remédios', 12)
  ) as t(nome, ordem)
  where not exists (select 1 from locais_estoque where casa_id = v_casa_id);
end $$;
