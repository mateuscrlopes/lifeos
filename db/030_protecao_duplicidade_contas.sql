-- LIFEOS - MIGRACAO 030: PROTECAO CONTRA CONTAS DUPLICADAS
-- Prioridade: linha digitavel -> Pix -> fornecedor + vencimento + valor.
-- Seguro rodar novamente.

create or replace function public.normalizar_linha_conta(valor text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(regexp_replace(coalesce(valor, ''), '[^0-9]', '', 'g'), '');
$$;

create or replace function public.normalizar_pix_conta(valor text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    regexp_replace(lower(trim(coalesce(valor, ''))), '[[:space:]]+', '', 'g'),
    ''
  );
$$;

-- Remove somente duplicidades exatas de linha digitavel.
-- Mantem primeiro uma conta paga; se nenhuma estiver paga, mantem a mais antiga.
do $$
declare
  grupo record;
  manter_id uuid;
  remover_id uuid;
begin
  for grupo in
    select
      casa_id,
      public.normalizar_linha_conta(linha_digitavel) as chave
    from public.contas
    where public.normalizar_linha_conta(linha_digitavel) is not null
    group by casa_id, public.normalizar_linha_conta(linha_digitavel)
    having count(*) > 1
  loop
    select id
      into manter_id
    from public.contas
    where casa_id = grupo.casa_id
      and public.normalizar_linha_conta(linha_digitavel) = grupo.chave
    order by paga desc, criada_em asc, id asc
    limit 1;

    for remover_id in
      select id
      from public.contas
      where casa_id = grupo.casa_id
        and public.normalizar_linha_conta(linha_digitavel) = grupo.chave
        and id <> manter_id
    loop
      update public.contas_email_caixa
      set conta_id = manter_id,
          atualizado_em = now()
      where conta_id = remover_id;

      update public.contas destino
      set
        valor = coalesce(destino.valor, origem.valor),
        paga = destino.paga or origem.paga,
        paga_em = coalesce(destino.paga_em, origem.paga_em),
        categoria = coalesce(destino.categoria, origem.categoria),
        fornecedor = coalesce(destino.fornecedor, origem.fornecedor),
        descricao_pagamento = coalesce(destino.descricao_pagamento, origem.descricao_pagamento),
        linha_digitavel = coalesce(destino.linha_digitavel, origem.linha_digitavel),
        pix_copia_cola = coalesce(destino.pix_copia_cola, origem.pix_copia_cola),
        qr_code_url = coalesce(destino.qr_code_url, origem.qr_code_url),
        documento_url = coalesce(destino.documento_url, origem.documento_url),
        pago_por = coalesce(destino.pago_por, origem.pago_por),
        atualizado_em = greatest(destino.atualizado_em, origem.atualizado_em)
      from public.contas origem
      where destino.id = manter_id
        and origem.id = remover_id;

      delete from public.contas where id = remover_id;
    end loop;
  end loop;
end
$$;

-- Depois da limpeza por boleto, remove somente duplicidades exatas de Pix.
do $$
declare
  grupo record;
  manter_id uuid;
  remover_id uuid;
begin
  for grupo in
    select
      casa_id,
      public.normalizar_pix_conta(pix_copia_cola) as chave
    from public.contas
    where public.normalizar_pix_conta(pix_copia_cola) is not null
    group by casa_id, public.normalizar_pix_conta(pix_copia_cola)
    having count(*) > 1
  loop
    select id
      into manter_id
    from public.contas
    where casa_id = grupo.casa_id
      and public.normalizar_pix_conta(pix_copia_cola) = grupo.chave
    order by paga desc, criada_em asc, id asc
    limit 1;

    for remover_id in
      select id
      from public.contas
      where casa_id = grupo.casa_id
        and public.normalizar_pix_conta(pix_copia_cola) = grupo.chave
        and id <> manter_id
    loop
      update public.contas_email_caixa
      set conta_id = manter_id,
          atualizado_em = now()
      where conta_id = remover_id;

      update public.contas destino
      set
        valor = coalesce(destino.valor, origem.valor),
        paga = destino.paga or origem.paga,
        paga_em = coalesce(destino.paga_em, origem.paga_em),
        categoria = coalesce(destino.categoria, origem.categoria),
        fornecedor = coalesce(destino.fornecedor, origem.fornecedor),
        descricao_pagamento = coalesce(destino.descricao_pagamento, origem.descricao_pagamento),
        linha_digitavel = coalesce(destino.linha_digitavel, origem.linha_digitavel),
        pix_copia_cola = coalesce(destino.pix_copia_cola, origem.pix_copia_cola),
        qr_code_url = coalesce(destino.qr_code_url, origem.qr_code_url),
        documento_url = coalesce(destino.documento_url, origem.documento_url),
        pago_por = coalesce(destino.pago_por, origem.pago_por),
        atualizado_em = greatest(destino.atualizado_em, origem.atualizado_em)
      from public.contas origem
      where destino.id = manter_id
        and origem.id = remover_id;

      delete from public.contas where id = remover_id;
    end loop;
  end loop;
end
$$;

create unique index if not exists contas_linha_pagamento_uq
  on public.contas (
    casa_id,
    public.normalizar_linha_conta(linha_digitavel)
  )
  where public.normalizar_linha_conta(linha_digitavel) is not null;

create unique index if not exists contas_pix_pagamento_uq
  on public.contas (
    casa_id,
    public.normalizar_pix_conta(pix_copia_cola)
  )
  where public.normalizar_pix_conta(pix_copia_cola) is not null;

create or replace function public.adicionar_conta_email_protegida(
  p_caixa_id uuid,
  p_casa_id uuid,
  p_usuario_id uuid,
  p_nome text,
  p_categoria text,
  p_valor numeric,
  p_vencimento date,
  p_fornecedor text,
  p_email_message_id text,
  p_email_assunto text,
  p_linha_digitavel text,
  p_pix_copia_cola text
)
returns table (
  conta_id uuid,
  criada boolean,
  motivo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha text := public.normalizar_linha_conta(p_linha_digitavel);
  v_pix text := public.normalizar_pix_conta(p_pix_copia_cola);
  v_referencia text := lower(trim(coalesce(p_fornecedor, p_nome, 'conta')));
  v_existente uuid;
  v_motivo text;
  v_lock text;
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.usuarios u
    where u.id = p_usuario_id
      and u.casa_id = p_casa_id
      and u.auth_id = auth.uid()
  ) then
    raise exception 'Usuario sem acesso a esta Casa.'
      using errcode = '42501';
  end if;

  if p_vencimento is null then
    raise exception 'Vencimento obrigatorio.'
      using errcode = '22004';
  end if;

  v_lock := coalesce(
    case when v_linha is not null then 'linha:' || v_linha end,
    case when v_pix is not null then 'pix:' || v_pix end,
    'referencia:' || v_referencia || ':' || p_vencimento::text || ':' || coalesce(p_valor::text, 'sem-valor')
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_casa_id::text || ':' || v_lock, 0)
  );

  if p_email_message_id is not null then
    select c.id
      into v_existente
    from public.contas c
    where c.casa_id = p_casa_id
      and c.email_message_id = p_email_message_id
    limit 1;

    if v_existente is not null then
      v_motivo := 'email';
    end if;
  end if;

  if v_existente is null and v_linha is not null then
    select c.id
      into v_existente
    from public.contas c
    where c.casa_id = p_casa_id
      and public.normalizar_linha_conta(c.linha_digitavel) = v_linha
    order by c.paga desc, c.criada_em asc
    limit 1;

    if v_existente is not null then
      v_motivo := 'linha_digitavel';
    end if;
  end if;

  if v_existente is null and v_pix is not null then
    select c.id
      into v_existente
    from public.contas c
    where c.casa_id = p_casa_id
      and public.normalizar_pix_conta(c.pix_copia_cola) = v_pix
    order by c.paga desc, c.criada_em asc
    limit 1;

    if v_existente is not null then
      v_motivo := 'pix';
    end if;
  end if;

  -- Apoio para uma conta existente que ainda nao tinha codigo cadastrado.
  if v_existente is null then
    select c.id
      into v_existente
    from public.contas c
    where c.casa_id = p_casa_id
      and lower(trim(coalesce(c.fornecedor, c.nome))) = v_referencia
      and c.vencimento = p_vencimento
      and c.valor is not distinct from p_valor
      and public.normalizar_linha_conta(c.linha_digitavel) is null
      and public.normalizar_pix_conta(c.pix_copia_cola) is null
    order by c.paga desc, c.criada_em asc
    limit 1;

    if v_existente is not null then
      v_motivo := 'fornecedor_vencimento_valor';
    end if;
  end if;

  if v_existente is not null then
    update public.contas
    set
      categoria = coalesce(categoria, p_categoria),
      valor = coalesce(valor, p_valor),
      fornecedor = coalesce(fornecedor, p_fornecedor),
      linha_digitavel = coalesce(linha_digitavel, p_linha_digitavel),
      pix_copia_cola = coalesce(pix_copia_cola, p_pix_copia_cola),
      email_assunto = coalesce(email_assunto, p_email_assunto),
      atualizado_em = now()
    where id = v_existente
      and casa_id = p_casa_id;

    update public.contas_email_caixa
    set
      status = 'importado',
      conta_id = v_existente,
      atualizado_em = now()
    where id = p_caixa_id
      and casa_id = p_casa_id;

    return query select v_existente, false, v_motivo;
    return;
  end if;

  insert into public.contas (
    casa_id,
    nome,
    categoria,
    valor,
    vencimento,
    paga,
    recorrente,
    criada_por,
    origem,
    fornecedor,
    email_message_id,
    email_assunto,
    importada_em,
    revisada,
    linha_digitavel,
    pix_copia_cola,
    atualizado_em
  )
  values (
    p_casa_id,
    trim(p_nome),
    p_categoria,
    p_valor,
    p_vencimento,
    false,
    false,
    p_usuario_id,
    'email',
    p_fornecedor,
    p_email_message_id,
    p_email_assunto,
    now(),
    true,
    p_linha_digitavel,
    p_pix_copia_cola,
    now()
  )
  returning id into v_existente;

  update public.contas_email_caixa
  set
    status = 'importado',
    conta_id = v_existente,
    atualizado_em = now()
  where id = p_caixa_id
    and casa_id = p_casa_id;

  return query select v_existente, true, 'nova';
end;
$$;

revoke all on function public.adicionar_conta_email_protegida(
  uuid, uuid, uuid, text, text, numeric, date, text, text, text, text, text
) from public;

grant execute on function public.adicionar_conta_email_protegida(
  uuid, uuid, uuid, text, text, numeric, date, text, text, text, text, text
) to authenticated;
