-- ===================================================================
-- LIFEOS - MIGRACAO 014: PROJETOS PESSOAIS
-- Projetos pertencem a um usuario, nao a Casa.
-- Tarefas ganham campo privado e projeto_id.
-- ===================================================================

-- Projetos pessoais (visibilidade por usuario, nao por casa)
create table if not exists projetos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid references usuarios(id) on delete cascade,
  nome          text not null,
  descricao     text,
  status        text not null default 'nao_iniciado',
  -- 'nao_iniciado' | 'em_andamento' | 'concluido' | 'pausado'
  frequencia    text not null default 'semanal',
  -- 'diario' | 'semanal' | 'mensal'
  inicio        date,
  termino       date,
  criado_em     timestamptz not null default now()
);

-- Objetivos do projeto (metas descritivas, sem check)
create table if not exists projeto_objetivos (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid references projetos(id) on delete cascade,
  descricao   text not null,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);

-- Itens de estoque vinculados ao projeto
create table if not exists projeto_itens (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid references projetos(id) on delete cascade,
  estoque_id  uuid references estoque(id),
  nome        text not null,  -- nome livre se nao tiver no estoque
  criado_em   timestamptz not null default now()
);

-- Campo privado e projeto_id nas tarefas
alter table tarefas add column if not exists privado     boolean not null default false;
alter table tarefas add column if not exists projeto_id  uuid references projetos(id);

-- RLS: projetos visíveis apenas pelo proprio usuario
alter table projetos enable row level security;
alter table projeto_objetivos enable row level security;
alter table projeto_itens enable row level security;

drop policy if exists proj_ler on projetos;
create policy proj_ler on projetos for select to authenticated
  using (usuario_id = (select id from usuarios where auth_id = auth.uid()));

drop policy if exists proj_ins on projetos;
create policy proj_ins on projetos for insert to authenticated
  with check (usuario_id = (select id from usuarios where auth_id = auth.uid()));

drop policy if exists proj_upd on projetos;
create policy proj_upd on projetos for update to authenticated
  using (usuario_id = (select id from usuarios where auth_id = auth.uid()));

drop policy if exists proj_del on projetos;
create policy proj_del on projetos for delete to authenticated
  using (usuario_id = (select id from usuarios where auth_id = auth.uid()));

-- Objetivos: acesso via projeto do proprio usuario
drop policy if exists pobj_ler on projeto_objetivos;
create policy pobj_ler on projeto_objetivos for select to authenticated
  using (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

drop policy if exists pobj_ins on projeto_objetivos;
create policy pobj_ins on projeto_objetivos for insert to authenticated
  with check (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

drop policy if exists pobj_upd on projeto_objetivos;
create policy pobj_upd on projeto_objetivos for update to authenticated
  using (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

drop policy if exists pobj_del on projeto_objetivos;
create policy pobj_del on projeto_objetivos for delete to authenticated
  using (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

-- Itens: acesso via projeto do proprio usuario
drop policy if exists pitm_ler on projeto_itens;
create policy pitm_ler on projeto_itens for select to authenticated
  using (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

drop policy if exists pitm_ins on projeto_itens;
create policy pitm_ins on projeto_itens for insert to authenticated
  with check (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));

drop policy if exists pitm_del on projeto_itens;
create policy pitm_del on projeto_itens for delete to authenticated
  using (exists (select 1 from projetos p where p.id = projeto_id
    and p.usuario_id = (select id from usuarios where auth_id = auth.uid())));
