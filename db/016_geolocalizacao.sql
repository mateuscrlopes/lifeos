-- ===================================================================
-- LIFEOS - MIGRACAO 016: GEOLOCALIZACAO
-- Locais fisicos de compra com enderecos e mapeamento para
-- locais do estoque. Suporta multiplos enderecos por local.
-- ===================================================================

-- Local fisico de compra (ex: Assaí, Farmácia)
create table if not exists locais_compra (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid references casa(id),
  nome        text not null,           -- ex.: "Assaí Atacadista"
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Enderecos de cada local (um local pode ter varios enderecos)
create table if not exists locais_compra_enderecos (
  id              uuid primary key default gen_random_uuid(),
  local_compra_id uuid references locais_compra(id) on delete cascade,
  endereco        text not null,       -- endereco legivel
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  raio_metros     integer not null default 200  -- raio de deteccao
);

-- Mapeamento: local fisico → locais do estoque que sao comprados la
create table if not exists locais_compra_categorias (
  id              uuid primary key default gen_random_uuid(),
  local_compra_id uuid references locais_compra(id) on delete cascade,
  local_estoque   text not null        -- ex.: "Cozinha - Não perecíveis"
);

-- RLS
alter table locais_compra enable row level security;
alter table locais_compra_enderecos enable row level security;
alter table locais_compra_categorias enable row level security;

drop policy if exists lc_ler on locais_compra;
create policy lc_ler on locais_compra for select to authenticated using (true);
drop policy if exists lc_ins on locais_compra;
create policy lc_ins on locais_compra for insert to authenticated with check (true);
drop policy if exists lc_upd on locais_compra;
create policy lc_upd on locais_compra for update to authenticated using (true);

drop policy if exists lce_ler on locais_compra_enderecos;
create policy lce_ler on locais_compra_enderecos for select to authenticated using (true);
drop policy if exists lce_ins on locais_compra_enderecos;
create policy lce_ins on locais_compra_enderecos for insert to authenticated with check (true);
drop policy if exists lce_del on locais_compra_enderecos;
create policy lce_del on locais_compra_enderecos for delete to authenticated using (true);

drop policy if exists lcc_ler on locais_compra_categorias;
create policy lcc_ler on locais_compra_categorias for select to authenticated using (true);
drop policy if exists lcc_ins on locais_compra_categorias;
create policy lcc_ins on locais_compra_categorias for insert to authenticated with check (true);
drop policy if exists lcc_del on locais_compra_categorias;
create policy lcc_del on locais_compra_categorias for delete to authenticated using (true);

-- ===================================================================
-- DADOS INICIAIS — locais mapeados por Mateus
-- ===================================================================
do $$
declare
  v_casa_id uuid;
  v_assai   uuid;
  v_super   uuid;
  v_mais    uuid;
  v_smart   uuid;
  v_atac    uuid;
  v_droga   uuid;
begin
  select id into v_casa_id from casa order by criada_em limit 1;

  -- Assaí Atacadista
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Assaí Atacadista') returning id into v_assai;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_assai,'Rua João Damasceno, 135, Porto Velho, São Gonçalo - RJ',-22.8821289,-43.1041542);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_assai,'Cozinha - Não perecíveis'),(v_assai,'Cozinha - Hortifruti'),
    (v_assai,'Cozinha - Carnes'),(v_assai,'Cozinha - Café da manhã'),
    (v_assai,'Cozinha - Temperos'),(v_assai,'Banheiro - Higiene pessoal'),
    (v_assai,'Banheiro - Cosméticos'),(v_assai,'Banheiro - Limpeza'),
    (v_assai,'Lavanderia'),(v_assai,'Casa - Limpeza'),(v_assai,'Casa - Utilitários');

  -- Supermarket
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Supermarket') returning id into v_super;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_super,'Rua Comandante Ari Parreiras, 25, Porto Velho, São Gonçalo - RJ',-22.8856,-43.1089);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_super,'Cozinha - Não perecíveis'),(v_super,'Cozinha - Hortifruti'),
    (v_super,'Cozinha - Carnes'),(v_super,'Cozinha - Café da manhã'),
    (v_super,'Cozinha - Temperos'),(v_super,'Banheiro - Higiene pessoal'),
    (v_super,'Banheiro - Cosméticos'),(v_super,'Banheiro - Limpeza'),
    (v_super,'Lavanderia'),(v_super,'Casa - Limpeza');

  -- Supermercado Mais Economia
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Supermercado Mais Economia') returning id into v_mais;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_mais,'Rua Lúcio Tomé Feteira, 2152, Barro Vermelho, São Gonçalo - RJ',-22.8634,-43.0721);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_mais,'Cozinha - Não perecíveis'),(v_mais,'Cozinha - Hortifruti'),
    (v_mais,'Cozinha - Carnes'),(v_mais,'Cozinha - Café da manhã'),
    (v_mais,'Cozinha - Temperos'),(v_mais,'Banheiro - Higiene pessoal'),
    (v_mais,'Banheiro - Limpeza'),(v_mais,'Lavanderia'),(v_mais,'Casa - Limpeza');

  -- Mercado Smart
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Mercado Smart') returning id into v_smart;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_smart,'Rua Doutor Pio Borges, 2855, Barro Vermelho, São Gonçalo - RJ',-22.8651,-43.0698);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_smart,'Cozinha - Não perecíveis'),(v_smart,'Cozinha - Hortifruti'),
    (v_smart,'Cozinha - Carnes'),(v_smart,'Cozinha - Café da manhã'),
    (v_smart,'Cozinha - Temperos'),(v_smart,'Banheiro - Higiene pessoal'),
    (v_smart,'Banheiro - Limpeza'),(v_smart,'Lavanderia'),(v_smart,'Casa - Limpeza');

  -- Atacadão
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Atacadão') returning id into v_atac;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_atac,'Rua Oliveira Botelho, 349, Neves, São Gonçalo - RJ',-22.9012,-43.0534);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_atac,'Cozinha - Não perecíveis'),(v_atac,'Cozinha - Hortifruti'),
    (v_atac,'Cozinha - Carnes'),(v_atac,'Cozinha - Café da manhã'),
    (v_atac,'Cozinha - Temperos'),(v_atac,'Banheiro - Higiene pessoal'),
    (v_atac,'Banheiro - Cosméticos'),(v_atac,'Banheiro - Limpeza'),
    (v_atac,'Lavanderia'),(v_atac,'Casa - Limpeza'),(v_atac,'Casa - Utilitários');

  -- Drogaria Carrefour (mesmo endereço do Atacadão)
  insert into locais_compra (id,casa_id,nome) values (gen_random_uuid(),v_casa_id,'Drogaria Carrefour') returning id into v_droga;
  insert into locais_compra_enderecos (local_compra_id,endereco,latitude,longitude) values
    (v_droga,'Rua Oliveira Botelho, 349, Neves, São Gonçalo - RJ',-22.9012,-43.0534);
  insert into locais_compra_categorias (local_compra_id,local_estoque) values
    (v_droga,'Farmácia / Remédios'),(v_droga,'Banheiro - Higiene pessoal'),
    (v_droga,'Banheiro - Cosméticos');

end $$;
