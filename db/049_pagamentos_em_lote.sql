-- LIFEOS - MIGRACAO 049: PAGAMENTO EM LOTE, SOBRAS E RECIBO COMPOSTO
-- Um unico Pix pode quitar varias cobrancas. O comprovante fica no lote;
-- os itens registram quanto foi aplicado em cada acerto.

create table if not exists public.acerto_pagamento_lotes (
  id                    uuid primary key default gen_random_uuid(),
  casa_id               uuid not null references public.casa(id) on delete cascade,
  enviado_por           uuid not null references public.usuarios(id),
  credor_id              uuid not null references public.usuarios(id),
  valor_planejado        numeric(12,2) not null check (valor_planejado > 0),
  valor_transferencia    numeric(12,2) not null check (valor_transferencia > 0),
  valor_utilizado        numeric(12,2) not null default 0 check (valor_utilizado >= 0),
  valor_excedente        numeric(12,2) not null default 0 check (valor_excedente >= 0),
  valor_faltante         numeric(12,2) not null default 0 check (valor_faltante >= 0),
  valor_extraido         numeric(12,2),
  pago_em_extraido       timestamptz,
  arquivo_nome           text,
  arquivo_tipo           text,
  comprovante_path       text,
  dados_extraidos        jsonb not null default '{}'::jsonb,
  status                 text not null default 'aguardando_confirmacao'
                         check (status in ('aguardando_confirmacao','aprovado','recusado')),
  revisado_por           uuid references public.usuarios(id),
  revisado_em            timestamptz,
  motivo_recusa          text,
  enviado_em             timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  check (enviado_por <> credor_id),
  check (valor_utilizado <= valor_transferencia + 0.01)
);

create index if not exists acerto_pagamento_lotes_casa_idx
  on public.acerto_pagamento_lotes(casa_id, enviado_em desc);
create index if not exists acerto_pagamento_lotes_enviado_por_idx
  on public.acerto_pagamento_lotes(enviado_por, status);
create index if not exists acerto_pagamento_lotes_credor_idx
  on public.acerto_pagamento_lotes(credor_id, status);

create table if not exists public.acerto_pagamento_itens (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.acerto_pagamento_lotes(id) on delete cascade,
  acerto_id       uuid not null references public.acertos(id) on delete restrict,
  ordem           integer not null default 1 check (ordem >= 1),
  saldo_antes     numeric(12,2) not null check (saldo_antes >= 0),
  valor_alocado   numeric(12,2) not null check (valor_alocado >= 0),
  saldo_depois    numeric(12,2) not null check (saldo_depois >= 0),
  criado_em       timestamptz not null default now(),
  unique(lote_id, acerto_id)
);

create index if not exists acerto_pagamento_itens_acerto_idx
  on public.acerto_pagamento_itens(acerto_id, lote_id);

create table if not exists public.acerto_saldos (
  id              uuid primary key default gen_random_uuid(),
  casa_id         uuid not null references public.casa(id) on delete cascade,
  devedor_id      uuid not null references public.usuarios(id),
  credor_id       uuid not null references public.usuarios(id),
  valor_credito   numeric(12,2) not null default 0 check (valor_credito >= 0),
  atualizado_em   timestamptz not null default now(),
  check (devedor_id <> credor_id),
  unique(casa_id, devedor_id, credor_id)
);

alter table public.acerto_pagamento_lotes enable row level security;
alter table public.acerto_pagamento_itens enable row level security;
alter table public.acerto_saldos enable row level security;

drop policy if exists acerto_pagamento_lotes_ler on public.acerto_pagamento_lotes;
create policy acerto_pagamento_lotes_ler
  on public.acerto_pagamento_lotes for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists acerto_pagamento_itens_ler on public.acerto_pagamento_itens;
create policy acerto_pagamento_itens_ler
  on public.acerto_pagamento_itens for select to authenticated
  using (exists (
    select 1
    from public.acerto_pagamento_lotes l
    where l.id = lote_id
      and public.lifeos_usuario_na_casa(l.casa_id)
  ));

drop policy if exists acerto_saldos_ler on public.acerto_saldos;
create policy acerto_saldos_ler
  on public.acerto_saldos for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

create or replace function public.revisar_pagamento_lote(
  p_lote_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_lote public.acerto_pagamento_lotes%rowtype;
  v_item record;
  v_acerto public.acertos%rowtype;
  v_novo_pago numeric(12,2);
  v_status text;
begin
  select * into v_lote
  from public.acerto_pagamento_lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'Pagamento nao encontrado.' using errcode = 'P0002';
  end if;

  if v_usuario is null or v_lote.credor_id <> v_usuario then
    raise exception 'Somente o recebedor pode confirmar este pagamento.'
      using errcode = '42501';
  end if;

  if v_lote.status <> 'aguardando_confirmacao' then
    return v_lote.status;
  end if;

  if not p_aprovar then
    update public.acerto_pagamento_lotes
    set status = 'recusado',
        revisado_por = v_usuario,
        revisado_em = now(),
        motivo_recusa = nullif(trim(coalesce(p_motivo, '')), ''),
        atualizado_em = now()
    where id = p_lote_id;

    insert into public.notificacoes (
      casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
    )
    values (
      v_lote.casa_id,
      v_lote.enviado_por,
      'pagamento_recusado',
      'Pagamento precisa ser revisto',
      coalesce(nullif(trim(p_motivo), ''), 'O recebedor nao confirmou o Pix enviado.'),
      'acerto_pagamento_lotes',
      v_lote.id
    );

    insert into public.eventos (
      tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
    )
    values (
      'pagamento_lote_recusado', 'acerto_pagamento_lotes', v_lote.id,
      v_usuario,
      jsonb_build_object('motivo', p_motivo),
      'Pagamento em lote recusado pelo recebedor.'
    );

    return 'recusado';
  end if;

  for v_item in
    select *
    from public.acerto_pagamento_itens
    where lote_id = p_lote_id
      and valor_alocado > 0
    order by ordem, id
  loop
    select * into v_acerto
    from public.acertos
    where id = v_item.acerto_id
    for update;

    if not found
       or v_acerto.casa_id <> v_lote.casa_id
       or v_acerto.devedor_id <> v_lote.enviado_por
       or v_acerto.credor_id <> v_lote.credor_id then
      raise exception 'Uma das cobrancas do pagamento nao e valida.'
        using errcode = '22023';
    end if;

    if v_acerto.status = 'cancelado' then
      raise exception 'Uma das cobrancas selecionadas foi cancelada.'
        using errcode = '22023';
    end if;

    v_novo_pago := round(v_acerto.valor_pago + v_item.valor_alocado, 2);

    if v_novo_pago > v_acerto.valor_devido + 0.01 then
      raise exception 'O pagamento ultrapassa o saldo atual de uma das cobrancas.'
        using errcode = '22023';
    end if;

    v_status := case
      when v_novo_pago >= v_acerto.valor_devido - 0.01 then 'pago'
      else 'parcial'
    end;

    update public.acertos
    set valor_pago = least(v_novo_pago, valor_devido),
        status = v_status,
        atualizado_em = now()
    where id = v_acerto.id;
  end loop;

  update public.acerto_pagamento_lotes
  set status = 'aprovado',
      revisado_por = v_usuario,
      revisado_em = now(),
      motivo_recusa = null,
      atualizado_em = now()
  where id = p_lote_id;

  if v_lote.valor_excedente > 0.009 then
    insert into public.acerto_saldos (
      casa_id, devedor_id, credor_id, valor_credito, atualizado_em
    )
    values (
      v_lote.casa_id, v_lote.enviado_por, v_lote.credor_id,
      v_lote.valor_excedente, now()
    )
    on conflict (casa_id, devedor_id, credor_id)
    do update set
      valor_credito = round(public.acerto_saldos.valor_credito + excluded.valor_credito, 2),
      atualizado_em = now();
  end if;

  insert into public.notificacoes (
    casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
  )
  values (
    v_lote.casa_id,
    v_lote.enviado_por,
    'pagamento_aprovado',
    'Pix confirmado',
    'O recebedor confirmou seu Pix de R$ ' ||
      trim(to_char(v_lote.valor_transferencia, 'FM999G999G990D00')) || '.',
    'acerto_pagamento_lotes',
    v_lote.id
  );

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'pagamento_lote_aprovado', 'acerto_pagamento_lotes', v_lote.id,
    v_usuario,
    jsonb_build_object(
      'valor_transferencia', v_lote.valor_transferencia,
      'valor_utilizado', v_lote.valor_utilizado,
      'valor_excedente', v_lote.valor_excedente,
      'valor_faltante', v_lote.valor_faltante
    ),
    'Pagamento em lote aprovado pelo recebedor.'
  );

  return 'aprovado';
end;
$$;

revoke all on function public.revisar_pagamento_lote(uuid, boolean, text)
  from public, anon;
grant execute on function public.revisar_pagamento_lote(uuid, boolean, text)
  to authenticated;
