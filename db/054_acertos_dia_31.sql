-- LIFEOS - MIGRACAO 054: DIA DE GERACAO 1 A 31
-- Permite escolher qualquer dia do mes para gerar uma cobranca recorrente.
-- Em meses mais curtos, 29/30/31 significam o ultimo dia disponivel.

alter table public.acerto_regras
  drop constraint if exists acerto_regras_gerar_dia_check;

alter table public.acerto_regras
  add constraint acerto_regras_gerar_dia_check
  check (gerar_dia between 1 and 31);

create or replace function public.criar_regra_acerto_recorrente(
  p_titulo text,
  p_valor numeric,
  p_devedor_id uuid,
  p_credor_id uuid,
  p_gerar_dia integer default 1,
  p_vencimento_tipo text default 'dia_mes',
  p_vencimento_valor integer default 5,
  p_inicia_em date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_regra uuid;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_titulo), '') = ''
     or p_valor <= 0
     or p_gerar_dia not between 1 and 31
     or p_vencimento_valor not between 1 and 28
     or p_vencimento_tipo not in ('dia_mes','dia_util')
     or p_devedor_id = p_credor_id then
    raise exception 'Configuracao invalida.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.id = p_devedor_id and u.casa_id = v_casa
  ) or not exists (
    select 1 from public.usuarios u
    where u.id = p_credor_id and u.casa_id = v_casa
  ) then
    raise exception 'Participantes invalidos.' using errcode = '22023';
  end if;

  insert into public.acerto_regras (
    casa_id, titulo, devedor_id, credor_id, valor, frequencia,
    gerar_dia, vencimento_tipo, vencimento_valor,
    inicia_em, ativo, criada_por
  )
  values (
    v_casa, trim(p_titulo), p_devedor_id, p_credor_id, round(p_valor, 2), 'mensal',
    p_gerar_dia, p_vencimento_tipo, p_vencimento_valor,
    coalesce(p_inicia_em, current_date), true, v_usuario
  )
  returning id into v_regra;

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'regra_acerto_criada', 'acerto_regras', v_regra, v_usuario,
    jsonb_build_object(
      'titulo', trim(p_titulo),
      'valor', round(p_valor, 2),
      'devedor_id', p_devedor_id,
      'credor_id', p_credor_id,
      'gerar_dia', p_gerar_dia,
      'vencimento_tipo', p_vencimento_tipo,
      'vencimento_valor', p_vencimento_valor,
      'inicia_em', coalesce(p_inicia_em, current_date)
    ),
    'Regra recorrente criada na Central Financeira.'
  );

  return v_regra;
end;
$$;

revoke all on function public.criar_regra_acerto_recorrente(
  text, numeric, uuid, uuid, integer, text, integer, date
) from public, anon;

grant execute on function public.criar_regra_acerto_recorrente(
  text, numeric, uuid, uuid, integer, text, integer, date
) to authenticated;

create or replace function public.gerar_acertos_recorrentes(p_data date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_mes date := date_trunc('month', p_data)::date;
  v_ultimo_dia integer := extract(day from (date_trunc('month', p_data) + interval '1 month - 1 day'))::integer;
  v_regra record;
  v_criados integer := 0;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.'
      using errcode = '42501';
  end if;

  for v_regra in
    select *
    from public.acerto_regras r
    where r.casa_id = v_casa
      and r.ativo
      and r.frequencia = 'mensal'
      and r.inicia_em <= (v_mes + interval '1 month - 1 day')::date
      and (r.termina_em is null or r.termina_em >= v_mes)
      and extract(day from p_data)::integer >= least(r.gerar_dia, v_ultimo_dia)
  loop
    if not exists (
      select 1
      from public.acertos a
      where a.regra_id = v_regra.id
        and a.competencia = v_mes
    ) then
      insert into public.acertos (
        casa_id, regra_id, titulo, devedor_id, credor_id, competencia,
        parcela_numero, parcelas_total, valor_devido, vencimento,
        status, origem, criado_por
      )
      values (
        v_regra.casa_id, v_regra.id, v_regra.titulo,
        v_regra.devedor_id, v_regra.credor_id, v_mes,
        1, 1, v_regra.valor,
        public.lifeos_calcular_vencimento(v_mes, v_regra.vencimento_tipo, v_regra.vencimento_valor),
        'pendente', 'regra', v_usuario
      );

      v_criados := v_criados + 1;
    end if;
  end loop;

  return v_criados;
end;
$$;

revoke all on function public.gerar_acertos_recorrentes(date) from public;
grant execute on function public.gerar_acertos_recorrentes(date) to authenticated;
