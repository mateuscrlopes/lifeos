-- LifeOS — Compras práticas, destinos configuráveis e histórico de idas
-- Execute depois da migração 022_lista_mercado.sql.

create extension if not exists pgcrypto;

create table if not exists compra_destinos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null,
  nome text not null,
  tipo text not null default 'mercado' check (tipo in ('mercado','farmacia','outros')),
  entra_lista_mercado boolean not null default true,
  padrao boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create unique index if not exists compra_destinos_nome_uq
  on compra_destinos (casa_id, lower(nome));
create unique index if not exists compra_destinos_padrao_uq
  on compra_destinos (casa_id)
  where padrao = true and ativo = true;

-- Cria as opções iniciais para cada casa já existente.
insert into compra_destinos (casa_id, nome, tipo, entra_lista_mercado, padrao, ordem)
select casas.casa_id, valores.nome, valores.tipo, valores.entra, valores.padrao, valores.ordem
from (select distinct casa_id from usuarios where casa_id is not null) casas
cross join (values
  ('Mercado','mercado',true,true,10),
  ('Farmácia','farmacia',false,false,20),
  ('Outros','outros',false,false,30)
) as valores(nome,tipo,entra,padrao,ordem)
on conflict do nothing;

alter table lista_compras
  add column if not exists destino_compra_id uuid references compra_destinos(id) on delete restrict,
  add column if not exists compra_sessao_id uuid;

-- Migra itens existentes sem destino para a opção padrão de cada casa.
update lista_compras l
set destino_compra_id = d.id
from compra_destinos d
where l.destino_compra_id is null
  and d.casa_id = l.casa_id
  and d.padrao = true
  and d.ativo = true;

create or replace function lifeos_definir_destino_compra_padrao()
returns trigger language plpgsql as $$
begin
  if new.destino_compra_id is null then
    select id into new.destino_compra_id
    from compra_destinos
    where casa_id = new.casa_id and padrao = true and ativo = true
    order by ordem, criado_em
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lista_compras_destino_padrao on lista_compras;
create trigger trg_lista_compras_destino_padrao
before insert on lista_compras
for each row execute function lifeos_definir_destino_compra_padrao();

create table if not exists compras_sessoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null,
  local_compra_id uuid references locais_compra(id) on delete set null,
  local_nome text,
  usuario_id uuid,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz not null default now(),
  total_informado numeric(12,2) not null default 0,
  itens_sem_preco integer not null default 0,
  quantidade_itens integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists compras_sessao_itens (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references compras_sessoes(id) on delete cascade,
  lista_compra_id uuid,
  nome text not null,
  quantidade numeric,
  unidade text,
  preco numeric(12,2),
  destino_nome text,
  estoque_id uuid,
  criado_em timestamptz not null default now()
);

alter table lista_compras
  drop constraint if exists lista_compras_compra_sessao_id_fkey;
alter table lista_compras
  add constraint lista_compras_compra_sessao_id_fkey
  foreign key (compra_sessao_id) references compras_sessoes(id) on delete set null;

create index if not exists compras_sessoes_casa_data_idx
  on compras_sessoes (casa_id, finalizada_em desc);
create index if not exists compras_sessao_itens_sessao_idx
  on compras_sessao_itens (sessao_id);
create index if not exists lista_compras_destino_idx
  on lista_compras (casa_id, destino_compra_id, status);

comment on table compra_destinos is 'Destinos editáveis usados para classificar itens de compras.';
comment on table compras_sessoes is 'Histórico de cada ida ou sessão de compra.';
comment on table compras_sessao_itens is 'Cópia histórica dos itens e preços de uma sessão de compra.';
