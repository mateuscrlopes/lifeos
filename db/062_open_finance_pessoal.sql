-- ===================================================================
-- LIFEOS - MIGRACAO 062: OPEN FINANCE PESSOAL
-- Cache privado das contas/transacoes lidas pela ponte Meu Pluggy.
-- Configuracoes de visibilidade permanecem no LifeOS e nunca no codigo.
-- ===================================================================

create table if not exists public.financeiro_open_finance_contas (
  id                         uuid primary key default gen_random_uuid(),
  usuario_id                 uuid not null references public.usuarios(id) on delete cascade,
  provider                   text not null default 'pluggy',
  external_id                text not null,
  item_id                    text,
  nome                       text not null,
  tipo                       text not null check (tipo in ('checking','credit_card','other')),
  subtipo                    text,
  saldo_atual                numeric(14,2),
  limite_credito             numeric(14,2),
  limite_disponivel          numeric(14,2),
  saldo_investido_automatico numeric(14,2),
  moeda                      text not null default 'BRL',
  visivel                    boolean not null default false,
  considerar_disponivel      boolean not null default false,
  sincronizado_em            timestamptz,
  metadata                   jsonb not null default '{}'::jsonb,
  criado_em                  timestamptz not null default now(),
  atualizado_em              timestamptz not null default now(),
  unique (usuario_id, provider, external_id)
);

create index if not exists financeiro_open_finance_contas_usuario_idx
  on public.financeiro_open_finance_contas (usuario_id, visivel, tipo);

create table if not exists public.financeiro_open_finance_transacoes (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios(id) on delete cascade,
  conta_id            uuid not null references public.financeiro_open_finance_contas(id) on delete cascade,
  provider            text not null default 'pluggy',
  external_id         text not null,
  descricao           text not null,
  valor               numeric(14,2) not null,
  direcao             text check (direcao in ('debit','credit')),
  ocorrido_em         timestamptz,
  categoria_provider  text,
  categoria_usuario   text,
  merchant            text,
  status              text,
  moeda               text not null default 'BRL',
  metadata            jsonb not null default '{}'::jsonb,
  sincronizado_em     timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (usuario_id, provider, external_id)
);

create index if not exists financeiro_open_finance_transacoes_usuario_data_idx
  on public.financeiro_open_finance_transacoes (usuario_id, ocorrido_em desc);

create index if not exists financeiro_open_finance_transacoes_conta_idx
  on public.financeiro_open_finance_transacoes (conta_id, ocorrido_em desc);

alter table public.financeiro_fundos_pessoais
  add column if not exists conta_open_finance_id uuid
  references public.financeiro_open_finance_contas(id) on delete set null;

create unique index if not exists financeiro_fundos_conta_ativa_uidx
  on public.financeiro_fundos_pessoais (usuario_id, conta_open_finance_id)
  where conta_open_finance_id is not null and ativo = true;

alter table public.financeiro_open_finance_contas enable row level security;
alter table public.financeiro_open_finance_transacoes enable row level security;

drop policy if exists financeiro_open_finance_contas_owner on public.financeiro_open_finance_contas;
create policy financeiro_open_finance_contas_owner
  on public.financeiro_open_finance_contas
  for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

drop policy if exists financeiro_open_finance_transacoes_owner on public.financeiro_open_finance_transacoes;
create policy financeiro_open_finance_transacoes_owner
  on public.financeiro_open_finance_transacoes
  for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (
    usuario_id = (select public.lifeos_usuario_atual_id())
    and exists (
      select 1
      from public.financeiro_open_finance_contas c
      where c.id = conta_id
        and c.usuario_id = (select public.lifeos_usuario_atual_id())
    )
  );

grant select, insert, update, delete on public.financeiro_open_finance_contas to authenticated;
grant select, insert, update, delete on public.financeiro_open_finance_transacoes to authenticated;
