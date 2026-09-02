-- LIFEOS - MIGRACAO 049: PAGAMENTO DE MULTIPLOS ACERTOS E SALDO A FAVOR
-- Um unico Pix pode quitar varias cobrancas. Diferencas positivas viram credito
-- do devedor com o mesmo recebedor; diferencas negativas permanecem nos acertos.

create table if not exists public.acerto_pagamento_lotes (
  id                  uuid primary key default gen_random_uuid(),
  casa_id             uuid not null references public.casa(id) on delete cascade,
  devedor_id          uuid not null references public.usuarios(id),
  credor_id           uuid not null references public.usuarios(id),
  enviado_por         uuid not null references public.usuarios(id),
  valor_selecionado   numeric(12,2) not null check (valor_selecionado > 0),
  valor_informado     numeric(12,2) not null check (valor_informado > 0),
  valor_extraido      numeric(12,2) check (valor_extraido is null or valor_extraido >= 0),
  valor_confirmado    numeric(12,2) check (valor_confirmado is null or valor_confirmado > 0),
  diferenca_confirmada numeric(12,2),
  saldo_gerado        numeric(12,2) not null default 0 check (saldo_gerado >= 0),
  pago_em_extraido    timestamptz,
  arquivo_nome        text,
  arquivo_tipo        text,
  comprovante_path    text,
  dados_extraidos     jsonb not null default '{}'::jsonb,
  status              text not null default 'aguardando_confirmacao'
                      check (status in ('aguardando_confirmacao','aprovado','recusado','cancelado')),
  revisado_por        uuid references public.usuarios(id),
  revisado_em         timestamptz,
  motivo_recusa       text,
  enviado_em          timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (devedor_id <> credor_id)
);

create index if not exists acerto_pagamento_lotes_casa_status_idx
  on public.acerto_pagamento_lotes(casa_id,status,enviado_em desc);

create index if not exists acerto_pagamento_lotes_pessoas_idx
  on public.acerto_pagamento_lotes(casa_id,devedor_id,credor_id,status);

create table if not exists public.acerto_pagamento_itens (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.acerto_pagamento_lotes(id) on delete cascade,
  acerto_id       uuid not null references public.acertos(id),
  ordem           integer not null default 1 check (ordem >= 1),
  saldo_antes     numeric(12,2) not null check (saldo_antes >= 0),
  valor_previsto  numeric(12,2) not null check (valor_previsto >= 0),
  valor_aplicado  numeric(12,2) not null default 0 check (valor_aplicado >= 0),
  saldo_depois    numeric(12,2) check (saldo_depois is null or saldo_depois >= 0),
  criado_em       timestamptz not null default now(),
  unique(lote_id,acerto_id)
);

create index if not exists acerto_pagamento_itens_acerto_idx
  on public.acerto_pagamento_itens(acerto_id,lote_id);

create table if not exists public.acerto_saldos (
  id              uuid primary key default gen_random_uuid(),
  casa_id         uuid not null references public.casa(id) on delete cascade,
  devedor_id      uuid not null references public.usuarios(id),
  credor_id       uuid not null references public.usuarios(id),
  saldo_credito   numeric(12,2) not null default 0 check (saldo_credito >= 0),
  atualizado_em   timestamptz not null default now(),
  unique(casa_id,devedor_id,credor_id),
  check (devedor_id <> credor_id)
);

create index if not exists acerto_saldos_devedor_idx
  on public.acerto_saldos(casa_id,devedor_id);

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

grant select on public.acerto_pagamento_lotes to authenticated;
grant select on public.acerto_pagamento_itens to authenticated;
grant select on public.acerto_saldos to authenticated;

create or replace function public.revisar_pagamento_lote(
  p_lote_id uuid,
  p_aprovar boolean,
  p_valor_confirmado numeric default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_lote public.acerto_pagamento_lotes%rowtype;
  v_item record;
  v_acerto public.acertos%rowtype;
  v_confirmado numeric(12,2);
  v_disponivel numeric(12,2);
  v_saldo_atual numeric(12,2);
  v_aplicar numeric(12,2);
  v_total_aplicado numeric(12,2) := 0;
  v_saldo_gerado numeric(12,2) := 0;
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
    return jsonb_build_object(
      'status', v_lote.status,
      'valor_confirmado', v_lote.valor_confirmado,
      'saldo_gerado', v_lote.saldo_gerado
    );
  end if;

  if not p_aprovar then
    update public.acerto_pagamento_lotes
    set status = 'recusado',
        revisado_por = v_usuario,
        revisado_em = now(),
        motivo_recusa = nullif(trim(coalesce(p_motivo,'')),''),
        atualizado_em = now()
    where id = p_lote_id;

    insert into public.notificacoes (
      casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
    )
    values (
      v_lote.casa_id, v_lote.devedor_id, 'pagamento_recusado',
      'Pagamento precisa ser revisto',
      coalesce(nullif(trim(p_motivo),''),'O recebedor nao confirmou o pagamento enviado.'),
      'acerto_pagamento_lotes', v_lote.id
    );

    return jsonb_build_object('status','recusado');
  end if;

  v_confirmado := round(coalesce(
    p_valor_confirmado,
    case when coalesce(v_lote.valor_extraido,0) > 0 then v_lote.valor_extraido else null end,
    v_lote.valor_informado
  ), 2);

  if v_confirmado is null or v_confirmado <= 0 then
    raise exception 'Informe o valor efetivamente recebido.' using errcode = '22023';
  end if;

  v_disponivel := v_confirmado;

  for v_item in
    select i.*
    from public.acerto_pagamento_itens i
    where i.lote_id = p_lote_id
    order by i.ordem, i.criado_em
  loop
    select * into v_acerto
    from public.acertos
    where id = v_item.acerto_id
    for update;

    if not found
       or v_acerto.casa_id <> v_lote.casa_id
       or v_acerto.devedor_id <> v_lote.devedor_id
       or v_acerto.credor_id <> v_lote.credor_id then
      raise exception 'Um dos acertos selecionados nao e valido para este pagamento.'
        using errcode = '22023';
    end if;

    v_saldo_atual := greatest(0, round(v_acerto.valor_devido - v_acerto.valor_pago, 2));
    v_aplicar := least(v_saldo_atual, greatest(v_disponivel,0));

    if v_aplicar > 0 then
      update public.acertos
      set valor_pago = least(valor_devido, round(valor_pago + v_aplicar,2)),
          status = case
            when round(valor_pago + v_aplicar,2) >= valor_devido - 0.01 then 'pago'
            else 'parcial'
          end,
          atualizado_em = now()
      where id = v_acerto.id;

      v_disponivel := round(v_disponivel - v_aplicar,2);
      v_total_aplicado := round(v_total_aplicado + v_aplicar,2);
    end if;

    update public.acerto_pagamento_itens
    set valor_aplicado = v_aplicar,
        saldo_depois = greatest(0, round(v_saldo_atual - v_aplicar,2))
    where id = v_item.id;
  end loop;

  v_saldo_gerado := greatest(0, v_disponivel);

  if v_saldo_gerado > 0 then
    insert into public.acerto_saldos (
      casa_id,devedor_id,credor_id,saldo_credito,atualizado_em
    )
    values (
      v_lote.casa_id,v_lote.devedor_id,v_lote.credor_id,v_saldo_gerado,now()
    )
    on conflict (casa_id,devedor_id,credor_id) do update
    set saldo_credito = round(public.acerto_saldos.saldo_credito + excluded.saldo_credito,2),
        atualizado_em = now();
  end if;

  update public.acerto_pagamento_lotes
  set status = 'aprovado',
      valor_confirmado = v_confirmado,
      diferenca_confirmada = round(v_confirmado - valor_selecionado,2),
      saldo_gerado = v_saldo_gerado,
      revisado_por = v_usuario,
      revisado_em = now(),
      motivo_recusa = null,
      atualizado_em = now()
  where id = p_lote_id;

  insert into public.notificacoes (
    casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
  )
  values (
    v_lote.casa_id, v_lote.devedor_id, 'pagamento_aprovado',
    'Pagamento confirmado',
    'O recebedor confirmou seu Pix de R$ ' ||
      trim(to_char(v_confirmado,'FM999G999G990D00')) ||
      case when v_saldo_gerado > 0
        then '. R$ ' || trim(to_char(v_saldo_gerado,'FM999G999G990D00')) || ' ficaram como saldo a favor.'
        else '.'
      end,
    'acerto_pagamento_lotes', v_lote.id
  );

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'pagamento_lote_aprovado','acerto_pagamento_lotes',v_lote.id,v_usuario,
    jsonb_build_object(
      'valor_confirmado',v_confirmado,
      'valor_aplicado',v_total_aplicado,
      'saldo_gerado',v_saldo_gerado
    ),
    'Pagamento de multiplos acertos aprovado pelo recebedor.'
  );

  v_status := case when v_saldo_gerado > 0 then 'aprovado_com_saldo' else 'aprovado' end;

  return jsonb_build_object(
    'status',v_status,
    'valor_confirmado',v_confirmado,
    'valor_aplicado',v_total_aplicado,
    'saldo_gerado',v_saldo_gerado
  );
end;
$$;

revoke all on function public.revisar_pagamento_lote(uuid,boolean,numeric,text)
  from public, anon;
grant execute on function public.revisar_pagamento_lote(uuid,boolean,numeric,text)
  to authenticated;
