-- LIFEOS - MIGRACAO 034: EDICAO SEGURA DE REGRAS DE ACERTO

create or replace function public.atualizar_regra_acerto(
  p_regra_id uuid,
  p_titulo text,
  p_valor numeric,
  p_devedor_id uuid,
  p_credor_id uuid,
  p_gerar_dia integer,
  p_vencimento_tipo text,
  p_vencimento_valor integer,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.acerto_regras r
    where r.id = p_regra_id and r.casa_id = v_casa
  ) then
    raise exception 'Regra nao encontrada.' using errcode = 'P0002';
  end if;

  if p_devedor_id = p_credor_id
     or not exists (select 1 from public.usuarios u where u.id = p_devedor_id and u.casa_id = v_casa)
     or not exists (select 1 from public.usuarios u where u.id = p_credor_id and u.casa_id = v_casa) then
    raise exception 'Participantes invalidos.' using errcode = '22023';
  end if;

  if p_valor <= 0
     or p_gerar_dia not between 1 and 28
     or p_vencimento_valor not between 1 and 28
     or p_vencimento_tipo not in ('dia_mes','dia_util') then
    raise exception 'Configuracao invalida.' using errcode = '22023';
  end if;

  update public.acerto_regras
  set titulo = trim(p_titulo),
      valor = round(p_valor, 2),
      devedor_id = p_devedor_id,
      credor_id = p_credor_id,
      gerar_dia = p_gerar_dia,
      vencimento_tipo = p_vencimento_tipo,
      vencimento_valor = p_vencimento_valor,
      ativo = p_ativo,
      atualizado_em = now()
  where id = p_regra_id
    and casa_id = v_casa;

  -- Mantem instancias historicas intactas. Ajusta somente as que ainda
  -- nao receberam nenhum pagamento e pertencem ao mes atual ou futuro.
  update public.acertos a
  set titulo = trim(p_titulo),
      devedor_id = p_devedor_id,
      credor_id = p_credor_id,
      valor_devido = round(p_valor, 2),
      vencimento = public.lifeos_calcular_vencimento(
        a.competencia,
        p_vencimento_tipo,
        p_vencimento_valor
      ),
      atualizado_em = now()
  where a.regra_id = p_regra_id
    and a.status = 'pendente'
    and a.valor_pago = 0
    and a.competencia >= date_trunc('month', current_date)::date;

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'regra_acerto_atualizada',
    'acerto_regras',
    p_regra_id,
    v_usuario,
    jsonb_build_object(
      'titulo', p_titulo,
      'valor', round(p_valor, 2),
      'gerar_dia', p_gerar_dia,
      'vencimento_tipo', p_vencimento_tipo,
      'vencimento_valor', p_vencimento_valor,
      'ativo', p_ativo
    ),
    'Regra recorrente de acerto atualizada.'
  );
end;
$$;

revoke all on function public.atualizar_regra_acerto(
  uuid, text, numeric, uuid, uuid, integer, text, integer, boolean
) from public;

grant execute on function public.atualizar_regra_acerto(
  uuid, text, numeric, uuid, uuid, integer, text, integer, boolean
) to authenticated;
