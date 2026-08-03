-- ===================================================================
-- LIFEOS - MIGRACAO 021: GUMATE LAB
-- Dispositivos autorizados e historico dos comandos do assistente.
-- O token puro nunca e salvo no banco: somente o SHA-256.
-- ===================================================================

create table if not exists gumate_dispositivos (
  id                uuid primary key default gen_random_uuid(),
  casa_id           uuid not null references casa(id) on delete cascade,
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  nome              text not null,
  token_hash        text not null unique check (length(token_hash) = 64),
  permissoes        text[] not null default array['adicionar_compras']::text[],
  ativo             boolean not null default true,
  versao_app        text,
  criado_em         timestamptz not null default now(),
  ultimo_acesso_em  timestamptz
);

create index if not exists gumate_dispositivos_casa_idx
  on gumate_dispositivos (casa_id, ativo);

create table if not exists gumate_comandos (
  id                uuid primary key default gen_random_uuid(),
  dispositivo_id    uuid references gumate_dispositivos(id) on delete set null,
  usuario_id        uuid references usuarios(id) on delete set null,
  casa_id           uuid references casa(id) on delete cascade,
  comando_texto     text not null,
  acao              text,
  interpretacao     jsonb,
  sucesso           boolean not null default false,
  codigo_resultado  text,
  resposta          text,
  duracao_ms        integer,
  criado_em         timestamptz not null default now()
);

create index if not exists gumate_comandos_casa_data_idx
  on gumate_comandos (casa_id, criado_em desc);

-- Estas tabelas sao administradas exclusivamente pelo backend com a
-- SERVICE_ROLE_KEY. Nenhuma politica e criada para o frontend.
alter table gumate_dispositivos enable row level security;
alter table gumate_comandos enable row level security;

comment on table gumate_dispositivos is
  'Aparelhos autorizados a chamar o assistente Gumate.';
comment on column gumate_dispositivos.token_hash is
  'SHA-256 hexadecimal do token. O segredo puro fica apenas no aparelho.';
comment on table gumate_comandos is
  'Historico textual e tecnico dos comandos; nenhum audio e armazenado.';
