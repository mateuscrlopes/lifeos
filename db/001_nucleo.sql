-- ===================================================================
-- LIFEOS - MIGRACAO 001: NUCLEO
-- Cria as tres tabelas fundamentais (casa, usuarios, eventos),
-- liga o dado inicial da Casa e ATIVA a seguranca por linha (RLS)
-- com regras de acesso adequadas.
-- Rode este script inteiro no SQL Editor do Supabase.
-- E seguro rodar de novo: usa "if not exists" / "drop policy if exists".
-- ===================================================================


-- -------------------------------------------------------------------
-- TABELA: casa
-- A entidade domestica compartilhada. Por enquanto havera uma so linha
-- (a casa de Mateus e Ghustavo), mas a estrutura ja permite mais de uma.
-- -------------------------------------------------------------------
create table if not exists casa (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criada_em   timestamptz not null default now()
);


-- -------------------------------------------------------------------
-- TABELA: usuarios
-- O PERFIL de cada morador. NAO guarda senha - a senha e o login ficam
-- no cofre de autenticacao do Supabase (auth.users). A coluna auth_id
-- liga este perfil ao login.
-- -------------------------------------------------------------------
create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id),
  nome        text not null,
  casa_id     uuid references casa(id),
  criado_em   timestamptz not null default now()
);


-- -------------------------------------------------------------------
-- TABELA: eventos
-- Registro de rastreabilidade: quem fez o que, quando, valor anterior
-- e novo quando aplicavel.
-- -------------------------------------------------------------------
create table if not exists eventos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,
  entidade       text,
  entidade_id    uuid,
  usuario_id     uuid references usuarios(id),
  valor_anterior jsonb,
  valor_novo     jsonb,
  detalhe        text,
  criado_em      timestamptz not null default now()
);

create index if not exists eventos_criado_em_idx on eventos (criado_em desc);


-- -------------------------------------------------------------------
-- DADO INICIAL: a Casa
-- -------------------------------------------------------------------
insert into casa (nome)
select 'Casa'
where not exists (select 1 from casa);


-- ===================================================================
-- SEGURANCA POR LINHA (RLS)
-- Ativa a trava em todas as tabelas e define quem pode acessar o que.
-- Principio: apenas usuarios AUTENTICADOS (logados) podem ler/escrever.
-- Quem tem so a chave anonima (nao logado) NAO acessa nada.
-- Nesta fase, todo usuario logado enxerga os dados da Casa compartilhada;
-- o refinamento de privacidade pessoal vem em migracoes futuras.
-- ===================================================================

-- Liga a trava (por padrao, com a trava ligada e sem politica, ninguem acessa)
alter table casa     enable row level security;
alter table usuarios enable row level security;
alter table eventos  enable row level security;

-- --- Politicas da tabela casa ---
drop policy if exists casa_ler on casa;
create policy casa_ler
  on casa for select
  to authenticated          -- apenas quem esta logado
  using (true);             -- pode ler a(s) casa(s)

-- --- Politicas da tabela usuarios ---
drop policy if exists usuarios_ler on usuarios;
create policy usuarios_ler
  on usuarios for select
  to authenticated
  using (true);             -- logados enxergam os perfis (Mateus e Ghustavo)

drop policy if exists usuarios_editar_proprio on usuarios;
create policy usuarios_editar_proprio
  on usuarios for update
  to authenticated
  using (auth_id = auth.uid());  -- cada um so edita o proprio perfil

-- --- Politicas da tabela eventos ---
drop policy if exists eventos_ler on eventos;
create policy eventos_ler
  on eventos for select
  to authenticated
  using (true);             -- logados leem o historico compartilhado

drop policy if exists eventos_inserir on eventos;
create policy eventos_inserir
  on eventos for insert
  to authenticated
  with check (true);        -- logados podem registrar eventos
