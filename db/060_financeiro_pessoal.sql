-- ===================================================================
-- LIFEOS - MIGRACAO 060: FINANCEIRO PESSOAL (IPHONE)
-- Camada privada por usuario para carteiras, fundos, dividas e planejamento.
-- Nao substitui as contas/acertos da Casa.
-- ===================================================================

create table if not exists public.financeiro_pessoal_config (
  usuario_id                 uuid primary key references public.usuarios(id) on delete cascade,
  renda_mensal_referencia    numeric(12,2) check (renda_mensal_referencia is null or renda_mensal_referencia >= 0),
  proxima_renda              date,
  margem_seguranca           numeric(12,2) not null default 0 check (margem_seguranca >= 0),
  vr_mensal_referencia       numeric(12,2) not null default 0 check (vr_mensal_referencia >= 0),
  vr_reservado_terceiros     numeric(12,2) not null default 0 check (vr_reservado_terceiros >= 0),
  atualizado_em              timestamptz not null default now()
);

create table if not exists public.financeiro_carteiras_pessoais (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references public.usuarios(id) on delete cascade,
  nome                  text not null,
  tipo                  text not null check (tipo in ('conta','cartao','vr','dinheiro','outro')),
  instituicao           text,
  saldo_atual           numeric(12,2) not null default 0,
  saldo_reservado       numeric(12,2) not null default 0 check (saldo_reservado >= 0),
  limite_credito        numeric(12,2) check (limite_credito is null or limite_credito >= 0),
  fatura_atual          numeric(12,2) check (fatura_atual is null or fatura_atual >= 0),
  fechamento_dia        integer check (fechamento_dia is null or fechamento_dia between 1 and 31),
  vencimento_dia        integer check (vencimento_dia is null or vencimento_dia between 1 and 31),
  considerar_disponivel boolean not null default true,
  ativo                 boolean not null default true,
  ordem                 integer not null default 0,
  observacoes           text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (saldo_reservado <= greatest(saldo_atual, 0))
);

create index if not exists financeiro_carteiras_pessoais_usuario_idx
  on public.financeiro_carteiras_pessoais (usuario_id, ativo, ordem);

create table if not exists public.financeiro_fundos_pessoais (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  nome            text not null,
  slug            text not null,
  saldo_atual     numeric(12,2) not null default 0 check (saldo_atual >= 0),
  meta_valor      numeric(12,2) check (meta_valor is null or meta_valor >= 0),
  aporte_minimo   numeric(12,2) not null default 0 check (aporte_minimo >= 0),
  segregado       boolean not null default false,
  ativo           boolean not null default true,
  ordem           integer not null default 0,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (usuario_id, slug)
);

create index if not exists financeiro_fundos_pessoais_usuario_idx
  on public.financeiro_fundos_pessoais (usuario_id, ativo, ordem);

create table if not exists public.financeiro_fundo_movimentos (
  id            uuid primary key default gen_random_uuid(),
  fundo_id      uuid not null references public.financeiro_fundos_pessoais(id) on delete cascade,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  tipo          text not null check (tipo in ('aporte','retirada','ajuste')),
  valor         numeric(12,2) not null check (valor > 0),
  data          date not null default current_date,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create index if not exists financeiro_fundo_movimentos_usuario_data_idx
  on public.financeiro_fundo_movimentos (usuario_id, data desc);

create table if not exists public.financeiro_dividas_pessoais (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references public.usuarios(id) on delete cascade,
  nome                 text not null,
  tipo                 text not null default 'outro'
                       check (tipo in ('emprestimo','mensalidade','servico','cartao','outro')),
  origem               text,
  credor_atual         text,
  cobrador             text,
  valor_referencia     numeric(12,2) check (valor_referencia is null or valor_referencia >= 0),
  data_referencia      date,
  negativada           boolean not null default false,
  status               text not null default 'em_levantamento'
                       check (status in ('em_levantamento','mapeada','negociar','em_pagamento','resolvida','contestada')),
  proxima_acao         text,
  parcela_mensal       numeric(12,2) check (parcela_mensal is null or parcela_mensal >= 0),
  parcelas_restantes   integer check (parcelas_restantes is null or parcelas_restantes >= 0),
  parcelas_total       integer check (parcelas_total is null or parcelas_total >= 0),
  vencimento_final     date,
  observacoes          text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index if not exists financeiro_dividas_pessoais_usuario_status_idx
  on public.financeiro_dividas_pessoais (usuario_id, status, negativada);

create table if not exists public.financeiro_compromissos_pessoais (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios(id) on delete cascade,
  titulo              text not null,
  tipo                text not null default 'outro'
                      check (tipo in ('conta','emprestimo','cartao','assinatura','outro')),
  valor               numeric(12,2) not null check (valor >= 0),
  vencimento          date,
  recorrente          boolean not null default false,
  dia_vencimento      integer check (dia_vencimento is null or dia_vencimento between 1 and 31),
  parcelas_restantes  integer check (parcelas_restantes is null or parcelas_restantes >= 0),
  parcelas_total      integer check (parcelas_total is null or parcelas_total >= 0),
  carteira_id         uuid references public.financeiro_carteiras_pessoais(id) on delete set null,
  ativo               boolean not null default true,
  protegido           boolean not null default true,
  observacoes         text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists financeiro_compromissos_pessoais_usuario_idx
  on public.financeiro_compromissos_pessoais (usuario_id, ativo, vencimento);

alter table public.financeiro_pessoal_config enable row level security;
alter table public.financeiro_carteiras_pessoais enable row level security;
alter table public.financeiro_fundos_pessoais enable row level security;
alter table public.financeiro_fundo_movimentos enable row level security;
alter table public.financeiro_dividas_pessoais enable row level security;
alter table public.financeiro_compromissos_pessoais enable row level security;

drop policy if exists financeiro_pessoal_config_owner on public.financeiro_pessoal_config;
create policy financeiro_pessoal_config_owner
  on public.financeiro_pessoal_config for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

drop policy if exists financeiro_carteiras_pessoais_owner on public.financeiro_carteiras_pessoais;
create policy financeiro_carteiras_pessoais_owner
  on public.financeiro_carteiras_pessoais for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

drop policy if exists financeiro_fundos_pessoais_owner on public.financeiro_fundos_pessoais;
create policy financeiro_fundos_pessoais_owner
  on public.financeiro_fundos_pessoais for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

drop policy if exists financeiro_fundo_movimentos_owner on public.financeiro_fundo_movimentos;
create policy financeiro_fundo_movimentos_owner
  on public.financeiro_fundo_movimentos for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (
    usuario_id = (select public.lifeos_usuario_atual_id())
    and exists (
      select 1
      from public.financeiro_fundos_pessoais f
      where f.id = fundo_id and f.usuario_id = (select public.lifeos_usuario_atual_id())
    )
  );

drop policy if exists financeiro_dividas_pessoais_owner on public.financeiro_dividas_pessoais;
create policy financeiro_dividas_pessoais_owner
  on public.financeiro_dividas_pessoais for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

drop policy if exists financeiro_compromissos_pessoais_owner on public.financeiro_compromissos_pessoais;
create policy financeiro_compromissos_pessoais_owner
  on public.financeiro_compromissos_pessoais for all to authenticated
  using (usuario_id = (select public.lifeos_usuario_atual_id()))
  with check (usuario_id = (select public.lifeos_usuario_atual_id()));

grant select, insert, update, delete on public.financeiro_pessoal_config to authenticated;
grant select, insert, update, delete on public.financeiro_carteiras_pessoais to authenticated;
grant select, insert, update, delete on public.financeiro_fundos_pessoais to authenticated;
grant select, insert, update, delete on public.financeiro_fundo_movimentos to authenticated;
grant select, insert, update, delete on public.financeiro_dividas_pessoais to authenticated;
grant select, insert, update, delete on public.financeiro_compromissos_pessoais to authenticated;

create or replace function public.lifeos_movimentar_fundo_pessoal(
  p_fundo_id uuid,
  p_tipo text,
  p_valor numeric,
  p_observacao text default null
)
returns public.financeiro_fundos_pessoais
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_fundo public.financeiro_fundos_pessoais%rowtype;
  v_novo_saldo numeric(12,2);
begin
  if v_usuario is null then
    raise exception 'Sessao invalida.' using errcode = '42501';
  end if;

  if p_tipo not in ('aporte','retirada','ajuste') or p_valor is null or p_valor <= 0 then
    raise exception 'Movimentacao invalida.' using errcode = '22023';
  end if;

  select * into v_fundo
  from public.financeiro_fundos_pessoais
  where id = p_fundo_id and usuario_id = v_usuario
  for update;

  if not found then
    raise exception 'Fundo nao encontrado.' using errcode = 'P0002';
  end if;

  if p_tipo = 'retirada' then
    v_novo_saldo := v_fundo.saldo_atual - p_valor;
  else
    v_novo_saldo := v_fundo.saldo_atual + p_valor;
  end if;

  if v_novo_saldo < 0 then
    raise exception 'Saldo insuficiente no fundo.' using errcode = '22003';
  end if;

  update public.financeiro_fundos_pessoais
  set saldo_atual = v_novo_saldo,
      atualizado_em = now()
  where id = p_fundo_id
  returning * into v_fundo;

  insert into public.financeiro_fundo_movimentos
    (fundo_id, usuario_id, tipo, valor, observacao)
  values
    (p_fundo_id, v_usuario, p_tipo, p_valor, p_observacao);

  return v_fundo;
end;
$$;

revoke all on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) from public;
revoke all on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) from anon;
grant execute on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) to authenticated;
