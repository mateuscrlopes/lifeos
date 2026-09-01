-- LIFEOS - MIGRACAO 036: PONTE FINANCEIRA NORDESTRIP -> LIFEOS
-- O Nordestrip e a fonte de verdade da compra da viagem.
-- O LifeOS e a fonte de verdade do acerto entre Mateus e Ghustavo.

create table if not exists public.integracao_tokens (
  id uuid primary key default gen_random_uuid(),
  origem text not null unique,
  token_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.integracao_tokens enable row level security;
revoke all on public.integracao_tokens from anon, authenticated;
grant select, insert, update, delete on public.integracao_tokens to service_role;

create table if not exists public.integracao_identidades (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  external_user_id text not null,
  usuario_id uuid not null references public.usuarios(id),
  casa_id uuid not null references public.casa(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (origem, external_user_id)
);

create index if not exists integracao_identidades_usuario_idx
  on public.integracao_identidades (usuario_id);

create index if not exists integracao_identidades_casa_idx
  on public.integracao_identidades (casa_id);

alter table public.integracao_identidades enable row level security;
revoke all on public.integracao_identidades from anon, authenticated;
grant select, insert, update, delete on public.integracao_identidades to service_role;

insert into public.integracao_identidades (
  origem, external_user_id, usuario_id, casa_id
)
values
  (
    'nordestrip',
    '5e2bafb7-d6ef-4fe4-8d73-a4f2c37567bf',
    'f0e8537d-7761-43b5-aa55-4eda87919084',
    'c04afd99-e869-4c05-86b5-89e2486e7149'
  ),
  (
    'nordestrip',
    '059c34d6-bcf7-4ec4-b1d8-e5fb111a3092',
    'c196b1eb-e665-41b1-b2ee-af20672aece0',
    'c04afd99-e869-4c05-86b5-89e2486e7149'
  )
on conflict (origem, external_user_id) do update
set usuario_id = excluded.usuario_id,
    casa_id = excluded.casa_id;

alter table public.despesas_compartilhadas
  add column if not exists origem_externa_atualizado_em timestamptz,
  add column if not exists origem_externa_metadados jsonb not null default '{}'::jsonb;

create unique index if not exists despesas_compartilhadas_nordestrip_external_uq
  on public.despesas_compartilhadas (origem, origem_externa_id)
  where origem = 'nordestrip' and origem_externa_id is not null;

create or replace function public.verificar_token_integracao(
  p_origem text,
  p_token text
)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.integracao_tokens t
    where t.origem = p_origem
      and t.ativo = true
      and t.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  );
$$;

revoke all on function public.verificar_token_integracao(text, text) from public, anon, authenticated;
grant execute on function public.verificar_token_integracao(text, text) to service_role;

create or replace function public.sincronizar_despesa_nordestrip(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_external_id text := nullif(btrim(p_payload->>'expense_id'), '');
  v_action text := coalesce(nullif(btrim(p_payload->>'action'), ''), 'upsert');
  v_titulo text := nullif(btrim(p_payload->>'title'), '');
  v_valor_total numeric;
  v_pagador_externo text := nullif(btrim(p_payload->>'payer_user_id'), '');
  v_pagador uuid;
  v_casa uuid;
  v_despesa uuid;
  v_existente public.despesas_compartilhadas%rowtype;
  v_part record;
  v_usuario uuid;
  v_usuario_casa uuid;
  v_soma numeric := 0;
  v_parcelas integer := greatest(coalesce((p_payload->>'installments')::integer, 1), 1);
  v_primeiro_vencimento date;
  v_valor_parte numeric;
  v_valor_base numeric;
  v_valor_parcela numeric;
  v_indice integer;
  v_acertos integer := 0;
  v_payload_hash text := encode(digest(p_payload::text, 'sha256'), 'hex');
  v_hash_existente text;
  v_tem_pagamento boolean := false;
  v_origem_url text := nullif(btrim(p_payload->>'source_url'), '');
  v_trip_name text := nullif(btrim(p_payload->>'trip_name'), '');
  v_note text := nullif(btrim(p_payload->>'notes'), '');
begin
  if v_external_id is null then
    raise exception 'expense_id ausente.' using errcode = '22023';
  end if;

  select *
    into v_existente
  from public.despesas_compartilhadas d
  where d.origem = 'nordestrip'
    and d.origem_externa_id = v_external_id
  limit 1;

  if found then
    v_hash_existente := v_existente.origem_externa_metadados->>'payload_hash';

    if v_hash_existente = v_payload_hash then
      return jsonb_build_object(
        'status', 'unchanged',
        'despesa_id', v_existente.id
      );
    end if;

    select exists (
      select 1
      from public.acertos a
      left join public.acerto_pagamentos p on p.acerto_id = a.id
      where a.despesa_id = v_existente.id
        and (
          a.valor_pago > 0
          or p.id is not null
        )
    ) into v_tem_pagamento;

    if v_tem_pagamento then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'lifeos_has_payment_history',
        'despesa_id', v_existente.id
      );
    end if;
  end if;

  if v_action in ('cancel', 'delete', 'archive') then
    if v_existente.id is null then
      return jsonb_build_object('status', 'unchanged', 'reason', 'not_found');
    end if;

    update public.acertos
    set status = 'cancelado',
        atualizado_em = now()
    where despesa_id = v_existente.id
      and status <> 'pago';

    update public.despesas_compartilhadas
    set origem_externa_atualizado_em = now(),
        origem_externa_metadados = coalesce(origem_externa_metadados, '{}'::jsonb)
          || jsonb_build_object(
            'payload_hash', v_payload_hash,
            'last_action', v_action,
            'cancelled', true,
            'synced_at', now()
          ),
        atualizado_em = now()
    where id = v_existente.id;

    return jsonb_build_object(
      'status', 'cancelled',
      'despesa_id', v_existente.id
    );
  end if;

  if v_titulo is null then
    raise exception 'Titulo ausente.' using errcode = '22023';
  end if;

  begin
    v_valor_total := round((p_payload->>'amount')::numeric, 2);
  exception when others then
    raise exception 'Valor total invalido.' using errcode = '22023';
  end;

  if v_valor_total <= 0 then
    raise exception 'Valor total invalido.' using errcode = '22023';
  end if;

  if v_parcelas < 1 or v_parcelas > 60 then
    raise exception 'Parcelamento invalido.' using errcode = '22023';
  end if;

  begin
    v_primeiro_vencimento := (p_payload->>'first_due')::date;
  exception when others then
    v_primeiro_vencimento := null;
  end;

  if v_primeiro_vencimento is null then
    v_primeiro_vencimento := current_date;
  end if;

  select i.usuario_id, i.casa_id
    into v_pagador, v_casa
  from public.integracao_identidades i
  where i.origem = 'nordestrip'
    and i.external_user_id = v_pagador_externo;

  if v_pagador is null or v_casa is null then
    raise exception 'Pagador do Nordestrip nao possui mapeamento no LifeOS.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'splits') <> 'array' then
    raise exception 'Divisao ausente.' using errcode = '22023';
  end if;

  for v_part in
    select
      nullif(btrim(item->>'user_id'), '') as external_user_id,
      round((item->>'amount')::numeric, 2) as amount
    from jsonb_array_elements(p_payload->'splits') item
  loop
    if v_part.external_user_id is null or v_part.amount < 0 then
      raise exception 'Divisao invalida.' using errcode = '22023';
    end if;

    select i.usuario_id, i.casa_id
      into v_usuario, v_usuario_casa
    from public.integracao_identidades i
    where i.origem = 'nordestrip'
      and i.external_user_id = v_part.external_user_id;

    if v_usuario is null or v_usuario_casa <> v_casa then
      raise exception 'Participante do Nordestrip nao possui mapeamento compativel no LifeOS.' using errcode = '22023';
    end if;

    v_soma := v_soma + v_part.amount;
  end loop;

  if abs(round(v_soma, 2) - v_valor_total) > 0.01 then
    raise exception 'A divisao do Nordestrip nao fecha o valor total.' using errcode = '22023';
  end if;

  if v_existente.id is null then
    insert into public.despesas_compartilhadas (
      casa_id,
      titulo,
      valor_total,
      pago_por,
      meio_pagamento,
      parcelas,
      primeiro_vencimento,
      origem,
      origem_externa_id,
      origem_url,
      observacoes,
      criada_por,
      origem_externa_atualizado_em,
      origem_externa_metadados
    )
    values (
      v_casa,
      v_titulo,
      v_valor_total,
      v_pagador,
      'credit_card',
      v_parcelas,
      v_primeiro_vencimento,
      'nordestrip',
      v_external_id,
      v_origem_url,
      concat_ws(' · ', nullif('Nordestrip' || case when v_trip_name is not null then ': ' || v_trip_name else '' end, ''), v_note),
      v_pagador,
      now(),
      jsonb_build_object(
        'payload_hash', v_payload_hash,
        'trip_id', p_payload->>'trip_id',
        'trip_name', v_trip_name,
        'source_updated_at', p_payload->>'updated_at',
        'last_action', 'upsert',
        'synced_at', now()
      )
    )
    returning id into v_despesa;
  else
    v_despesa := v_existente.id;

    delete from public.acertos
    where despesa_id = v_despesa;

    delete from public.despesa_compartilhada_partes
    where despesa_id = v_despesa;

    update public.despesas_compartilhadas
    set titulo = v_titulo,
        valor_total = v_valor_total,
        pago_por = v_pagador,
        meio_pagamento = 'credit_card',
        parcelas = v_parcelas,
        primeiro_vencimento = v_primeiro_vencimento,
        origem_url = v_origem_url,
        observacoes = concat_ws(' · ', nullif('Nordestrip' || case when v_trip_name is not null then ': ' || v_trip_name else '' end, ''), v_note),
        origem_externa_atualizado_em = now(),
        origem_externa_metadados = jsonb_build_object(
          'payload_hash', v_payload_hash,
          'trip_id', p_payload->>'trip_id',
          'trip_name', v_trip_name,
          'source_updated_at', p_payload->>'updated_at',
          'last_action', 'upsert',
          'synced_at', now()
        ),
        atualizado_em = now()
    where id = v_despesa;
  end if;

  for v_part in
    select
      nullif(btrim(item->>'user_id'), '') as external_user_id,
      round((item->>'amount')::numeric, 2) as amount
    from jsonb_array_elements(p_payload->'splits') item
  loop
    select i.usuario_id
      into v_usuario
    from public.integracao_identidades i
    where i.origem = 'nordestrip'
      and i.external_user_id = v_part.external_user_id;

    insert into public.despesa_compartilhada_partes (
      despesa_id,
      usuario_id,
      valor,
      percentual
    )
    values (
      v_despesa,
      v_usuario,
      v_part.amount,
      case
        when v_valor_total > 0
          then round((v_part.amount / v_valor_total) * 100, 4)
        else null
      end
    );

    if v_usuario <> v_pagador and v_part.amount > 0 then
      v_valor_parte := v_part.amount;
      v_valor_base := round(v_valor_parte / v_parcelas, 2);

      for v_indice in 1..v_parcelas loop
        if v_indice = v_parcelas then
          v_valor_parcela := round(v_valor_parte - (v_valor_base * (v_parcelas - 1)), 2);
        else
          v_valor_parcela := v_valor_base;
        end if;

        insert into public.acertos (
          casa_id,
          despesa_id,
          titulo,
          devedor_id,
          credor_id,
          competencia,
          parcela_numero,
          parcelas_total,
          valor_devido,
          vencimento,
          status,
          origem,
          origem_externa_id,
          criado_por
        )
        values (
          v_casa,
          v_despesa,
          v_titulo,
          v_usuario,
          v_pagador,
          date_trunc(
            'month',
            (v_primeiro_vencimento + ((v_indice - 1) || ' month')::interval)
          )::date,
          v_indice,
          v_parcelas,
          v_valor_parcela,
          (v_primeiro_vencimento + ((v_indice - 1) || ' month')::interval)::date,
          'pendente',
          'nordestrip',
          v_external_id || ':' || v_part.external_user_id || ':p' || v_indice::text,
          v_pagador
        );

        v_acertos := v_acertos + 1;
      end loop;
    end if;
  end loop;

  insert into public.eventos (
    tipo,
    entidade,
    entidade_id,
    usuario_id,
    valor_novo,
    detalhe
  )
  values (
    case when v_existente.id is null
      then 'despesa_nordestrip_sincronizada'
      else 'despesa_nordestrip_atualizada'
    end,
    'despesas_compartilhadas',
    v_despesa,
    v_pagador,
    jsonb_build_object(
      'origem_externa_id', v_external_id,
      'valor_total', v_valor_total,
      'parcelas', v_parcelas,
      'acertos_criados', v_acertos
    ),
    'Despesa de cartao do Nordestrip sincronizada com a Central Financeira.'
  );

  return jsonb_build_object(
    'status', case when v_existente.id is null then 'created' else 'updated' end,
    'despesa_id', v_despesa,
    'acertos_count', v_acertos
  );
end;
$$;

revoke all on function public.sincronizar_despesa_nordestrip(jsonb)
  from public, anon, authenticated;
grant execute on function public.sincronizar_despesa_nordestrip(jsonb)
  to service_role;
